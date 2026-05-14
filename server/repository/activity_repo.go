package repository

import (
	"fmt"
	"sync"
	"time"

	"vrcontrol/server/model"
)

// ActivityRepository 活動資料存儲。
type ActivityRepository struct {
	repo       *JSONRepository
	activities map[string]*model.Activity
	mu         sync.RWMutex
}

func NewActivityRepository(filePath string) *ActivityRepository {
	return &ActivityRepository{
		repo:       NewJSONRepository(filePath),
		activities: make(map[string]*model.Activity),
	}
}

func (r *ActivityRepository) Load() error {
	var activities []*model.Activity
	if err := r.repo.Load(&activities); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.activities = make(map[string]*model.Activity)
	for _, activity := range activities {
		r.activities[activity.ActivityID] = activity
	}

	return nil
}

func (r *ActivityRepository) save() error {
	activities := make([]*model.Activity, 0, len(r.activities))
	for _, activity := range r.activities {
		activities = append(activities, activity)
	}
	return r.repo.Save(activities)
}

func (r *ActivityRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.save()
}

func (r *ActivityRepository) GetAll() []*model.Activity {
	r.mu.RLock()
	defer r.mu.RUnlock()

	activities := make([]*model.Activity, 0, len(r.activities))
	for _, activity := range r.activities {
		activities = append(activities, activity)
	}

	return activities
}

func (r *ActivityRepository) GetByID(activityID string) (*model.Activity, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	activity, exists := r.activities[activityID]
	if !exists {
		return nil, fmt.Errorf("activity not found: %s", activityID)
	}

	return activity, nil
}

func (r *ActivityRepository) GetByRoomID(roomID string) []*model.Activity {
	r.mu.RLock()
	defer r.mu.RUnlock()

	activities := make([]*model.Activity, 0)
	for _, activity := range r.activities {
		if activity.RoomID == roomID {
			activities = append(activities, activity)
		}
	}

	return activities
}

func (r *ActivityRepository) Create(activity *model.Activity) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.activities[activity.ActivityID]; exists {
		return fmt.Errorf("activity already exists: %s", activity.ActivityID)
	}

	now := time.Now()
	activity.CreatedAt = now
	activity.UpdatedAt = now
	if activity.ActivityContext == nil {
		activity.ActivityContext = model.DefaultActivityContext()
	}
	if activity.ArtifactRefs == nil {
		activity.ArtifactRefs = []model.ActivityArtifactRef{}
	}

	r.activities[activity.ActivityID] = activity

	return r.save()
}

func (r *ActivityRepository) Update(activity *model.Activity) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.activities[activity.ActivityID]; !exists {
		return fmt.Errorf("activity not found: %s", activity.ActivityID)
	}

	activity.UpdatedAt = time.Now()
	if activity.ActivityContext == nil {
		activity.ActivityContext = model.DefaultActivityContext()
	}
	if activity.ArtifactRefs == nil {
		activity.ArtifactRefs = []model.ActivityArtifactRef{}
	}

	r.activities[activity.ActivityID] = activity

	return r.save()
}

func (r *ActivityRepository) Delete(activityID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.activities[activityID]; !exists {
		return fmt.Errorf("activity not found: %s", activityID)
	}

	delete(r.activities, activityID)

	return r.save()
}

func (r *ActivityRepository) Exists(activityID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.activities[activityID]
	return exists
}
