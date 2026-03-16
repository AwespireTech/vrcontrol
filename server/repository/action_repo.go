package repository

import (
	"fmt"
	"sync"
	"time"

	"vrcontrol/server/model"
)

// ActionRepository 動作資料存儲
type ActionRepository struct {
	repo    *JSONRepository
	actions map[string]*model.Action
	mu      sync.RWMutex
}

// NewActionRepository 創建新的動作 Repository
func NewActionRepository(filePath string) *ActionRepository {
	return &ActionRepository{
		repo:    NewJSONRepository(filePath),
		actions: make(map[string]*model.Action),
	}
}

// Load 加載所有動作
func (r *ActionRepository) Load() error {
	var actions []*model.Action
	if err := r.repo.Load(&actions); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.actions = make(map[string]*model.Action)
	for _, action := range actions {
		r.actions[action.ActionID] = action
	}

	return nil
}

// save 內部保存方法（不加鎖）
func (r *ActionRepository) save() error {
	actions := make([]*model.Action, 0, len(r.actions))
	for _, action := range r.actions {
		actions = append(actions, action)
	}
	return r.repo.Save(actions)
}

// Save 保存所有動作
func (r *ActionRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.save()
}

// GetAll 獲取所有動作
func (r *ActionRepository) GetAll() []*model.Action {
	r.mu.RLock()
	defer r.mu.RUnlock()

	actions := make([]*model.Action, 0, len(r.actions))
	for _, action := range r.actions {
		actions = append(actions, action)
	}

	return actions
}

// GetByID 根據 ID 獲取動作
func (r *ActionRepository) GetByID(actionID string) (*model.Action, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	action, exists := r.actions[actionID]
	if !exists {
		return nil, fmt.Errorf("action not found: %s", actionID)
	}

	return action, nil
}

// GetByType 根據類型獲取動作
func (r *ActionRepository) GetByType(actionType string) []*model.Action {
	r.mu.RLock()
	defer r.mu.RUnlock()

	actions := make([]*model.Action, 0)
	for _, action := range r.actions {
		if action.ActionType == actionType {
			actions = append(actions, action)
		}
	}

	return actions
}

// Create 創建新動作
func (r *ActionRepository) Create(action *model.Action) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.actions[action.ActionID]; exists {
		return fmt.Errorf("action already exists: %s", action.ActionID)
	}

	now := time.Now()
	action.CreatedAt = now
	action.UpdatedAt = now

	if action.Params == nil {
		action.Params = make(map[string]interface{})
	}

	r.actions[action.ActionID] = action

	return r.save()
}

// Update 更新動作
func (r *ActionRepository) Update(action *model.Action) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.actions[action.ActionID]; !exists {
		return fmt.Errorf("action not found: %s", action.ActionID)
	}

	action.UpdatedAt = time.Now()
	r.actions[action.ActionID] = action

	return r.save()
}

// Delete 刪除動作
func (r *ActionRepository) Delete(actionID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.actions[actionID]; !exists {
		return fmt.Errorf("action not found: %s", actionID)
	}

	delete(r.actions, actionID)

	return r.save()
}

// UpdateExecutionStats 更新執行統計
func (r *ActionRepository) UpdateExecutionStats(actionID string, success bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	action, exists := r.actions[actionID]
	if !exists {
		return fmt.Errorf("action not found: %s", actionID)
	}

	action.ExecutionCount++
	if success {
		action.SuccessCount++
	} else {
		action.FailureCount++
	}

	now := time.Now()
	action.LastExecutedAt = &now
	action.UpdatedAt = now

	return r.save()
}

// Count 獲取動作總數
func (r *ActionRepository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.actions)
}

// Exists 檢查動作是否存在
func (r *ActionRepository) Exists(actionID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.actions[actionID]
	return exists
}
