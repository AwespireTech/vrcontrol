package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"vrcontrol/server/model"
	"vrcontrol/server/repository"
)

var ErrActivityArtifactNotFound = errors.New("activity artifact not found")

type ActivityDraftPatch struct {
	Name            *string                `json:"name"`
	ActivityContext *model.ActivityContext `json:"activity_context"`
}

type ActivityListQuery struct {
	Limit         int
	Offset        int
	SortBy        string
	Order         string
	Status        string
	RoomID        string
	CreatedBefore *time.Time
	CreatedAfter  *time.Time
	StartedBefore *time.Time
	StartedAfter  *time.Time
}

type ActivityListResult struct {
	Items   []*model.Activity
	Total   int
	Limit   int
	Offset  int
	SortBy  string
	Order   string
	Filters map[string]string
}

// ActivityService 管理活動生命週期與結果封存。
type ActivityService struct {
	activityRepo *repository.ActivityRepository
	artifactRoot string
}

func NewActivityService(activityRepo *repository.ActivityRepository, artifactRoot string) *ActivityService {
	return &ActivityService{
		activityRepo: activityRepo,
		artifactRoot: artifactRoot,
	}
}

func (s *ActivityService) ListActivities() []*model.Activity {
	result, err := s.QueryActivities(ActivityListQuery{})
	if err != nil {
		log.Printf("[activity] failed to list activities: %v", err)
		return []*model.Activity{}
	}
	return result.Items
}

func (s *ActivityService) QueryActivities(query ActivityListQuery) (*ActivityListResult, error) {
	indices := s.activityRepo.GetAll()
	activities := make([]*model.Activity, 0, len(indices))
	for _, index := range indices {
		activity, err := s.composeActivity(index)
		if err != nil {
			log.Printf("[activity] failed to load detail for %s: %v", index.ActivityID, err)
			activity = buildActivityFromIndexAndDetail(index, nil)
		}
		activities = append(activities, activity)
	}
	filtered := filterActivities(activities, query)
	normalizedSortBy := normalizeActivitySortBy(query.SortBy)
	normalizedOrder := normalizeActivitySortOrder(query.Order)
	sortActivities(filtered, normalizedSortBy, normalizedOrder)

	total := len(filtered)
	limit := normalizeActivityLimit(query.Limit)
	offset := normalizeActivityOffset(query.Offset, total)
	end := offset + limit
	if end > total {
		end = total
	}
	paged := make([]*model.Activity, 0, end-offset)
	if offset < total {
		paged = append(paged, filtered[offset:end]...)
	}

	return &ActivityListResult{
		Items:   paged,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		SortBy:  normalizedSortBy,
		Order:   normalizedOrder,
		Filters: buildActivityListFilters(query),
	}, nil
}

func (s *ActivityService) ListActivitiesByRoom(roomID string) []*model.Activity {
	result, err := s.QueryActivities(ActivityListQuery{RoomID: roomID})
	if err != nil {
		log.Printf("[activity] failed to list activities by room %s: %v", roomID, err)
		return []*model.Activity{}
	}
	return result.Items
}

func (s *ActivityService) GetActivity(activityID string) (*model.Activity, error) {
	index, err := s.activityRepo.GetByID(activityID)
	if err != nil {
		return nil, err
	}
	return s.composeActivity(index)
}

func (s *ActivityService) GetActivityContext(activityID string) (model.ActivityContext, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	return cloneActivityContext(activity.ActivityContext), nil
}

func (s *ActivityService) GetLanternResult(activityID string) (*model.ActivityLanternResult, error) {
	if _, err := s.GetActivity(activityID); err != nil {
		return nil, err
	}
	content, err := s.loadArtifact(activityID, "lantern")
	if err != nil {
		return nil, err
	}
	var lantern model.ActivityLanternResult
	if err := json.Unmarshal(content, &lantern); err != nil {
		return nil, err
	}
	return &lantern, nil
}

func (s *ActivityService) CreateDraft(activity *model.Activity) error {
	if activity.ActivityID == "" {
		activity.ActivityID = s.generateActivityID()
	}
	if activity.Status == "" {
		activity.Status = model.ActivityStatusDraft
	}
	if activity.Status != model.ActivityStatusDraft {
		return fmt.Errorf("new activity must start in draft status")
	}
	if activity.ActivityContext == nil {
		activity.ActivityContext = model.DefaultActivityContext()
	}
	activity.ActivityContext = cloneActivityContext(activity.ActivityContext)
	activity.ArtifactRefs = cloneArtifactRefs(activity.ArtifactRefs)
	index := buildIndexFromActivity(activity)
	if err := s.activityRepo.Create(index); err != nil {
		return err
	}
	activity.CreatedAt = index.CreatedAt
	activity.UpdatedAt = index.CreatedAt
	activity.StartedAt = cloneTimePointer(index.StartedAt)
	activity.EndedAt = cloneTimePointer(index.EndedAt)
	if err := s.saveDetail(activity); err != nil {
		_ = s.activityRepo.Delete(activity.ActivityID)
		return err
	}
	return nil
}

func (s *ActivityService) UpdateDraft(activityID string, patch ActivityDraftPatch) (*model.Activity, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	if activity.Status != model.ActivityStatusDraft {
		return nil, fmt.Errorf("only draft activity can be updated")
	}
	if patch.Name != nil {
		activity.Name = *patch.Name
	}
	if patch.ActivityContext != nil {
		activity.ActivityContext = cloneActivityContext(*patch.ActivityContext)
	}
	activity.UpdatedAt = time.Now()
	if err := s.persistActivity(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) StartActivity(activityID string, runtime *model.ActivityRuntimeInfo) (*model.Activity, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	if activity.Status != model.ActivityStatusDraft {
		return nil, fmt.Errorf("only draft activity can be started")
	}
	if err := s.ensureRoomHasNoRunningActivity(activity.RoomID, activity.ActivityID); err != nil {
		return nil, err
	}
	now := time.Now()
	activity.Status = model.ActivityStatusRunning
	activity.StartedAt = &now
	activity.ActivityContext = cloneActivityContext(activity.ActivityContext)
	if runtime == nil {
		runtime = &model.ActivityRuntimeInfo{}
	}
	if runtime.Seed <= 0 {
		runtime.Seed = rand.Intn(10000) + 1
	}
	if runtime != nil {
		copied := *runtime
		copied.LastUpdatedAt = now
		activity.RuntimeSnapshot = &copied
	}
	activity.UpdatedAt = now
	if err := s.persistActivity(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) EndActivity(activityID string, summary *model.ActivitySummary) (*model.Activity, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	if activity.Status != model.ActivityStatusRunning {
		return nil, fmt.Errorf("only running activity can be ended")
	}
	now := time.Now()
	activity.Status = model.ActivityStatusEnded
	activity.EndedAt = &now
	if summary != nil {
		activity.ResultSummary = cloneSummary(summary)
	}
	if activity.ResultSummary != nil && activity.StartedAt != nil {
		activity.ResultSummary.DurationSec = int64(now.Sub(*activity.StartedAt).Seconds())
	}
	if activity.RuntimeSnapshot != nil {
		activity.RuntimeSnapshot.LastUpdatedAt = now
	}
	activity.UpdatedAt = now
	if err := s.persistActivity(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) CancelActivity(activityID string) (*model.Activity, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	if activity.Status != model.ActivityStatusDraft && activity.Status != model.ActivityStatusRunning {
		return nil, fmt.Errorf("only draft or running activity can be cancelled")
	}
	now := time.Now()
	activity.Status = model.ActivityStatusCancelled
	activity.EndedAt = &now
	if activity.RuntimeSnapshot != nil {
		activity.RuntimeSnapshot.LastUpdatedAt = now
	}
	activity.UpdatedAt = now
	if err := s.persistActivity(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) DeleteActivity(activityID string) error {
	if err := s.activityRepo.Delete(activityID); err != nil {
		return err
	}
	if s.artifactRoot != "" {
		if err := os.RemoveAll(filepath.Join(s.artifactRoot, activityID)); err != nil {
			return err
		}
	}
	return nil
}

func (s *ActivityService) AppendEventStats(activityID string, eventType string, increment int) (*model.Activity, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	if increment <= 0 {
		increment = 1
	}
	if activity.ResultSummary == nil {
		activity.ResultSummary = &model.ActivitySummary{EventCounts: make(map[string]int)}
	}
	if activity.ResultSummary.EventCounts == nil {
		activity.ResultSummary.EventCounts = make(map[string]int)
	}
	activity.ResultSummary.EventCounts[eventType] += increment
	if activity.RuntimeSnapshot != nil {
		activity.RuntimeSnapshot.LastEventAt = time.Now()
		activity.RuntimeSnapshot.LastUpdatedAt = time.Now()
	}
	activity.UpdatedAt = time.Now()
	if err := s.persistActivity(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) AttachArtifact(activityID string, artifact model.ActivityArtifactRef, payload any) (*model.Activity, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	if artifact.Name == "" {
		return nil, fmt.Errorf("artifact name is required")
	}
	artifactPath, err := s.writeArtifact(activityID, artifact.Name, payload)
	if err != nil {
		return nil, err
	}
	artifact.Path = artifactPath
	activity.ArtifactRefs = append(activity.ArtifactRefs, artifact)
	if activity.RuntimeSnapshot != nil {
		activity.RuntimeSnapshot.LastUpdatedAt = time.Now()
	}
	activity.UpdatedAt = time.Now()
	if err := s.persistActivity(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) BuildResultSummary(activityID string, participantCount int) (*model.ActivitySummary, error) {
	activity, err := s.GetActivity(activityID)
	if err != nil {
		return nil, err
	}
	summary := &model.ActivitySummary{
		ParticipantCount: participantCount,
		EventCounts:      make(map[string]int),
	}
	if activity.ResultSummary != nil && activity.ResultSummary.EventCounts != nil {
		for key, value := range activity.ResultSummary.EventCounts {
			summary.EventCounts[key] = value
		}
	}
	if activity.StartedAt != nil {
		endedAt := time.Now()
		if activity.EndedAt != nil {
			endedAt = *activity.EndedAt
		}
		summary.DurationSec = int64(endedAt.Sub(*activity.StartedAt).Seconds())
	}
	return summary, nil
}

func (s *ActivityService) ensureRoomHasNoRunningActivity(roomID string, excludeActivityID string) error {
	indices := s.activityRepo.GetByRoomID(roomID)
	for _, activity := range indices {
		if activity == nil || activity.ActivityID == excludeActivityID {
			continue
		}
		if activity.Status == model.ActivityStatusRunning {
			return fmt.Errorf("room %s already has a running activity: %s", roomID, activity.ActivityID)
		}
	}
	return nil
}

func (s *ActivityService) writeArtifact(activityID string, name string, payload any) (string, error) {
	if s.artifactRoot == "" {
		return "", fmt.Errorf("artifact root is not configured")
	}
	activityDir := filepath.Join(s.artifactRoot, activityID)
	if err := os.MkdirAll(activityDir, 0755); err != nil {
		return "", err
	}
	path := filepath.Join(activityDir, name+".json")
	if err := saveJSONFile(path, payload); err != nil {
		return "", err
	}
	return path, nil
}

func (s *ActivityService) persistActivity(activity *model.Activity) error {
	if err := s.activityRepo.Update(buildIndexFromActivity(activity)); err != nil {
		return err
	}
	return s.saveDetail(activity)
}

func (s *ActivityService) composeActivity(index *model.ActivityIndex) (*model.Activity, error) {
	detail, err := s.loadDetail(index.ActivityID)
	if err != nil {
		return nil, err
	}
	return buildActivityFromIndexAndDetail(index, detail), nil
}

func (s *ActivityService) loadDetail(activityID string) (*model.ActivityDetail, error) {
	if s.artifactRoot == "" {
		return nil, nil
	}
	path := filepath.Join(s.artifactRoot, activityID, "detail.json")
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	if len(content) == 0 {
		return nil, nil
	}
	var detail model.ActivityDetail
	if err := json.Unmarshal(content, &detail); err != nil {
		return nil, err
	}
	if detail.ActivityContext == nil {
		detail.ActivityContext = model.DefaultActivityContext()
	}
	if detail.ArtifactManifest == nil {
		detail.ArtifactManifest = []model.ActivityArtifactRef{}
	}
	return &detail, nil
}

func (s *ActivityService) loadArtifact(activityID string, name string) ([]byte, error) {
	if s.artifactRoot == "" {
		return nil, fmt.Errorf("artifact root is not configured")
	}
	path := filepath.Join(s.artifactRoot, activityID, name+".json")
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s for activity %s", ErrActivityArtifactNotFound, name, activityID)
		}
		return nil, err
	}
	if len(content) == 0 {
		return nil, fmt.Errorf("%w: %s for activity %s", ErrActivityArtifactNotFound, name, activityID)
	}
	return content, nil
}

func (s *ActivityService) saveDetail(activity *model.Activity) error {
	if s.artifactRoot == "" {
		return fmt.Errorf("artifact root is not configured")
	}
	activityDir := filepath.Join(s.artifactRoot, activity.ActivityID)
	if err := os.MkdirAll(activityDir, 0755); err != nil {
		return err
	}
	return saveJSONFile(filepath.Join(activityDir, "detail.json"), buildDetailFromActivity(activity))
}

func (s *ActivityService) generateActivityID() string {
	timestamp := time.Now().UnixMilli()
	for {
		activityID := fmt.Sprintf("ACTIVITY-%d", timestamp)
		if !s.activityRepo.Exists(activityID) {
			return activityID
		}
		timestamp++
	}
}

func cloneActivityContext(context model.ActivityContext) model.ActivityContext {
	if context == nil {
		return model.DefaultActivityContext()
	}
	bytes, err := json.Marshal(context)
	if err != nil {
		cloned := make(model.ActivityContext, len(context))
		for key, value := range context {
			cloned[key] = value
		}
		return cloned
	}
	var cloned model.ActivityContext
	if err := json.Unmarshal(bytes, &cloned); err != nil {
		fallback := make(model.ActivityContext, len(context))
		for key, value := range context {
			fallback[key] = value
		}
		return fallback
	}
	return cloned
}

func cloneArtifactRefs(refs []model.ActivityArtifactRef) []model.ActivityArtifactRef {
	if refs == nil {
		return []model.ActivityArtifactRef{}
	}
	cloned := make([]model.ActivityArtifactRef, len(refs))
	copy(cloned, refs)
	return cloned
}

func cloneRuntimeSnapshot(runtime *model.ActivityRuntimeInfo) *model.ActivityRuntimeInfo {
	if runtime == nil {
		return nil
	}
	cloned := *runtime
	return &cloned
}

func cloneTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func buildIndexFromActivity(activity *model.Activity) *model.ActivityIndex {
	if activity == nil {
		return nil
	}
	return &model.ActivityIndex{
		ActivityID: activity.ActivityID,
		RoomID:     activity.RoomID,
		Name:       activity.Name,
		Status:     activity.Status,
		CreatedAt:  activity.CreatedAt,
		StartedAt:  cloneTimePointer(activity.StartedAt),
		EndedAt:    cloneTimePointer(activity.EndedAt),
	}
}

func buildDetailFromActivity(activity *model.Activity) *model.ActivityDetail {
	if activity == nil {
		return nil
	}
	return &model.ActivityDetail{
		ActivityID:       activity.ActivityID,
		RoomID:           activity.RoomID,
		Name:             activity.Name,
		Status:           activity.Status,
		CreatedAt:        activity.CreatedAt,
		UpdatedAt:        activity.UpdatedAt,
		StartedAt:        cloneTimePointer(activity.StartedAt),
		EndedAt:          cloneTimePointer(activity.EndedAt),
		ActivityContext:  cloneActivityContext(activity.ActivityContext),
		RuntimeSnapshot:  cloneRuntimeSnapshot(activity.RuntimeSnapshot),
		ResultSummary:    cloneSummary(activity.ResultSummary),
		ArtifactManifest: cloneArtifactRefs(activity.ArtifactRefs),
	}
}

func buildActivityFromIndexAndDetail(index *model.ActivityIndex, detail *model.ActivityDetail) *model.Activity {
	if index == nil {
		return nil
	}
	activity := &model.Activity{
		ActivityID:      index.ActivityID,
		RoomID:          index.RoomID,
		Name:            index.Name,
		Status:          index.Status,
		ActivityContext: model.DefaultActivityContext(),
		ArtifactRefs:    []model.ActivityArtifactRef{},
		CreatedAt:       index.CreatedAt,
		StartedAt:       cloneTimePointer(index.StartedAt),
		EndedAt:         cloneTimePointer(index.EndedAt),
		UpdatedAt:       index.CreatedAt,
	}
	if detail == nil {
		return activity
	}
	activity.UpdatedAt = detail.UpdatedAt
	activity.ActivityContext = cloneActivityContext(detail.ActivityContext)
	activity.RuntimeSnapshot = cloneRuntimeSnapshot(detail.RuntimeSnapshot)
	activity.ResultSummary = cloneSummary(detail.ResultSummary)
	activity.ArtifactRefs = cloneArtifactRefs(detail.ArtifactManifest)
	if activity.ActivityContext == nil {
		activity.ActivityContext = model.DefaultActivityContext()
	}
	if activity.ArtifactRefs == nil {
		activity.ArtifactRefs = []model.ActivityArtifactRef{}
	}
	return activity
}

func saveJSONFile(path string, payload any) error {
	content, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	tempFile := path + ".tmp"
	if err := os.WriteFile(tempFile, content, 0644); err != nil {
		return err
	}
	if err := os.Rename(tempFile, path); err != nil {
		_ = os.Remove(tempFile)
		return err
	}
	return nil
}

func cloneSummary(summary *model.ActivitySummary) *model.ActivitySummary {
	if summary == nil {
		return nil
	}
	cloned := &model.ActivitySummary{
		ParticipantCount: summary.ParticipantCount,
		DurationSec:      summary.DurationSec,
	}
	if summary.EventCounts != nil {
		cloned.EventCounts = make(map[string]int, len(summary.EventCounts))
		for key, value := range summary.EventCounts {
			cloned.EventCounts[key] = value
		}
	}
	return cloned
}

func normalizeActivityLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit > 200 {
		return 200
	}
	return limit
}

func normalizeActivityOffset(offset int, total int) int {
	if offset <= 0 {
		return 0
	}
	if offset > total {
		return total
	}
	return offset
}

func normalizeActivitySortBy(sortBy string) string {
	switch strings.ToLower(strings.TrimSpace(sortBy)) {
	case "name":
		return "name"
	case "started_at":
		return "started_at"
	case "ended_at":
		return "ended_at"
	default:
		return "created_at"
	}
}

func normalizeActivitySortOrder(order string) string {
	if strings.EqualFold(strings.TrimSpace(order), "asc") {
		return "asc"
	}
	return "desc"
}

func buildActivityListFilters(query ActivityListQuery) map[string]string {
	filters := make(map[string]string)
	if query.Status != "" {
		filters["status"] = query.Status
	}
	if query.RoomID != "" {
		filters["room_id"] = query.RoomID
	}
	if query.CreatedBefore != nil {
		filters["created_before"] = query.CreatedBefore.Format(time.RFC3339)
	}
	if query.CreatedAfter != nil {
		filters["created_after"] = query.CreatedAfter.Format(time.RFC3339)
	}
	if query.StartedBefore != nil {
		filters["started_before"] = query.StartedBefore.Format(time.RFC3339)
	}
	if query.StartedAfter != nil {
		filters["started_after"] = query.StartedAfter.Format(time.RFC3339)
	}
	return filters
}

func filterActivities(activities []*model.Activity, query ActivityListQuery) []*model.Activity {
	filtered := make([]*model.Activity, 0, len(activities))
	for _, activity := range activities {
		if activity == nil {
			continue
		}
		if query.Status != "" && !strings.EqualFold(string(activity.Status), query.Status) {
			continue
		}
		if query.RoomID != "" && activity.RoomID != query.RoomID {
			continue
		}
		if query.CreatedBefore != nil && activity.CreatedAt.After(*query.CreatedBefore) {
			continue
		}
		if query.CreatedAfter != nil && activity.CreatedAt.Before(*query.CreatedAfter) {
			continue
		}
		if query.StartedBefore != nil {
			if activity.StartedAt == nil || activity.StartedAt.After(*query.StartedBefore) {
				continue
			}
		}
		if query.StartedAfter != nil {
			if activity.StartedAt == nil || activity.StartedAt.Before(*query.StartedAfter) {
				continue
			}
		}
		filtered = append(filtered, activity)
	}
	return filtered
}

func sortActivities(activities []*model.Activity, sortBy string, order string) {
	sort.SliceStable(activities, func(i, j int) bool {
		left := activities[i]
		right := activities[j]
		comparison := compareActivities(left, right, sortBy)
		if comparison == 0 {
			comparison = compareActivities(left, right, "created_at")
		}
		if comparison == 0 && left != nil && right != nil {
			comparison = strings.Compare(left.ActivityID, right.ActivityID)
		}
		if order == "asc" {
			return comparison < 0
		}
		return comparison > 0
	})
}

func compareActivities(left *model.Activity, right *model.Activity, sortBy string) int {
	if left == nil || right == nil {
		switch {
		case left == nil && right == nil:
			return 0
		case left == nil:
			return -1
		default:
			return 1
		}
	}
	switch sortBy {
	case "name":
		return strings.Compare(strings.ToLower(left.Name), strings.ToLower(right.Name))
	case "started_at":
		return compareOptionalTimes(left.StartedAt, right.StartedAt)
	case "ended_at":
		return compareOptionalTimes(left.EndedAt, right.EndedAt)
	default:
		switch {
		case left.CreatedAt.Before(right.CreatedAt):
			return -1
		case left.CreatedAt.After(right.CreatedAt):
			return 1
		default:
			return 0
		}
	}
}

func compareOptionalTimes(left *time.Time, right *time.Time) int {
	if left == nil || right == nil {
		switch {
		case left == nil && right == nil:
			return 0
		case left == nil:
			return -1
		default:
			return 1
		}
	}
	switch {
	case left.Before(*right):
		return -1
	case left.After(*right):
		return 1
	default:
		return 0
	}
}
