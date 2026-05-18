package service

import (
	"encoding/json"
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

type ActivityDraftPatch struct {
	Name            *string                `json:"name"`
	ActivityContext *model.ActivityContext `json:"activity_context"`
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
	sort.SliceStable(activities, func(i, j int) bool {
		left := activities[i]
		right := activities[j]
		if left == nil || right == nil {
			return left != nil
		}
		if left.CreatedAt.Equal(right.CreatedAt) {
			return strings.ToLower(left.Name) < strings.ToLower(right.Name)
		}
		return left.CreatedAt.After(right.CreatedAt)
	})
	return activities
}

func (s *ActivityService) ListActivitiesByRoom(roomID string) []*model.Activity {
	indices := s.activityRepo.GetByRoomID(roomID)
	activities := make([]*model.Activity, 0, len(indices))
	for _, index := range indices {
		activity, err := s.composeActivity(index)
		if err != nil {
			log.Printf("[activity] failed to load detail for %s: %v", index.ActivityID, err)
			activity = buildActivityFromIndexAndDetail(index, nil)
		}
		activities = append(activities, activity)
	}
	sort.SliceStable(activities, func(i, j int) bool {
		left := activities[i]
		right := activities[j]
		if left.CreatedAt.Equal(right.CreatedAt) {
			return left.ActivityID < right.ActivityID
		}
		return left.CreatedAt.After(right.CreatedAt)
	})
	return activities
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
