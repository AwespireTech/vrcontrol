package service

import (
	"encoding/json"
	"fmt"
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
	activities := s.activityRepo.GetAll()
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
	activities := s.activityRepo.GetByRoomID(roomID)
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
	return s.activityRepo.GetByID(activityID)
}

func (s *ActivityService) GetActivityContext(activityID string) (model.ActivityContext, error) {
	activity, err := s.activityRepo.GetByID(activityID)
	if err != nil {
		return nil, err
	}
	return cloneActivityContext(activity.ActivityContext), nil
}

func (s *ActivityService) CreateDraft(activity *model.Activity) error {
	if activity.ActivityID == "" {
		activity.ActivityID = fmt.Sprintf("ACTIVITY-%d", time.Now().UnixNano()%1000000000)
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
	return s.activityRepo.Create(activity)
}

func (s *ActivityService) UpdateDraft(activityID string, patch ActivityDraftPatch) (*model.Activity, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	if err := s.activityRepo.Update(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) StartActivity(activityID string, runtime *model.ActivityRuntimeInfo) (*model.Activity, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	if runtime != nil {
		copied := *runtime
		copied.LastUpdatedAt = now
		activity.RuntimeSnapshot = &copied
	}
	if err := s.activityRepo.Update(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) EndActivity(activityID string, summary *model.ActivitySummary) (*model.Activity, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	if err := s.activityRepo.Update(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) CancelActivity(activityID string) (*model.Activity, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	if err := s.activityRepo.Update(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) DeleteActivity(activityID string) error {
	return s.activityRepo.Delete(activityID)
}

func (s *ActivityService) AppendEventStats(activityID string, eventType string, increment int) (*model.Activity, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	if err := s.activityRepo.Update(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) AttachArtifact(activityID string, artifact model.ActivityArtifactRef, payload any) (*model.Activity, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	if err := s.activityRepo.Update(activity); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) BuildResultSummary(activityID string, participantCount int) (*model.ActivitySummary, error) {
	activity, err := s.activityRepo.GetByID(activityID)
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
	activities := s.activityRepo.GetByRoomID(roomID)
	for _, activity := range activities {
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
	bytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, bytes, 0644); err != nil {
		return "", err
	}
	return path, nil
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
