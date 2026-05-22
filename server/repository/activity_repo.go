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
	activities map[string]*model.ActivityIndex
	mu         sync.RWMutex
}

func NewActivityRepository(filePath string) *ActivityRepository {
	return &ActivityRepository{
		repo:       NewJSONRepository(filePath),
		activities: make(map[string]*model.ActivityIndex),
	}
}

func (r *ActivityRepository) Load() error {
	var activities []*model.ActivityIndex
	if err := r.repo.Load(&activities); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.activities = make(map[string]*model.ActivityIndex)
	for _, activity := range activities {
		if activity == nil || activity.ActivityID == "" {
			continue
		}
		r.activities[activity.ActivityID] = cloneActivityIndex(activity)
	}

	return nil
}

func (r *ActivityRepository) save() error {
	activities := make([]*model.ActivityIndex, 0, len(r.activities))
	for _, activity := range r.activities {
		activities = append(activities, cloneActivityIndex(activity))
	}
	return r.repo.Save(activities)
}

func (r *ActivityRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.save()
}

func (r *ActivityRepository) GetAll() []*model.ActivityIndex {
	r.mu.RLock()
	defer r.mu.RUnlock()

	activities := make([]*model.ActivityIndex, 0, len(r.activities))
	for _, activity := range r.activities {
		activities = append(activities, cloneActivityIndex(activity))
	}

	return activities
}

func (r *ActivityRepository) GetByID(activityID string) (*model.ActivityIndex, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	activity, exists := r.activities[activityID]
	if !exists {
		return nil, fmt.Errorf("activity not found: %s", activityID)
	}

	return cloneActivityIndex(activity), nil
}

func (r *ActivityRepository) GetByRoomID(roomID string) []*model.ActivityIndex {
	r.mu.RLock()
	defer r.mu.RUnlock()

	activities := make([]*model.ActivityIndex, 0)
	for _, activity := range r.activities {
		if activity.RoomID == roomID {
			activities = append(activities, cloneActivityIndex(activity))
		}
	}

	return activities
}

func (r *ActivityRepository) Create(activity *model.ActivityIndex) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.activities[activity.ActivityID]; exists {
		return fmt.Errorf("activity already exists: %s", activity.ActivityID)
	}

	now := time.Now()
	if activity.CreatedAt.IsZero() {
		activity.CreatedAt = now
	}

	r.activities[activity.ActivityID] = cloneActivityIndex(activity)

	return r.save()
}

func (r *ActivityRepository) Update(activity *model.ActivityIndex) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	existing, exists := r.activities[activity.ActivityID]
	if !exists {
		return fmt.Errorf("activity not found: %s", activity.ActivityID)
	}

	if activity.CreatedAt.IsZero() {
		activity.CreatedAt = existing.CreatedAt
	}

	r.activities[activity.ActivityID] = cloneActivityIndex(activity)

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

func cloneActivityIndex(activity *model.ActivityIndex) *model.ActivityIndex {
	if activity == nil {
		return nil
	}
	cloned := *activity
	if activity.StartedAt != nil {
		startedAt := *activity.StartedAt
		cloned.StartedAt = &startedAt
	}
	if activity.EndedAt != nil {
		endedAt := *activity.EndedAt
		cloned.EndedAt = &endedAt
	}
	return &cloned
}
