package service

import (
	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/repository"
)

// PreferenceService 使用者偏好服務
type PreferenceService struct {
	preferenceRepo *repository.PreferenceRepository
}

// NewPreferenceService 創建新的偏好服務
func NewPreferenceService(preferenceRepo *repository.PreferenceRepository) *PreferenceService {
	return &PreferenceService{
		preferenceRepo: preferenceRepo,
	}
}

// Get 獲取使用者偏好
func (s *PreferenceService) Get() *model.UserPreference {
	return s.preferenceRepo.Get()
}

// Update 更新使用者偏好
func (s *PreferenceService) Update(pref *model.UserPreference) error {
	// 驗證數值合理性
	if pref.PollIntervalSec < 5 {
		pref.PollIntervalSec = 5
	}
	if pref.PollIntervalSec > 300 {
		pref.PollIntervalSec = 300
	}

	if pref.BatchSize < 1 {
		pref.BatchSize = 1
	}
	if pref.BatchSize > 50 {
		pref.BatchSize = 50
	}

	if pref.MaxConcurrency < 1 {
		pref.MaxConcurrency = 1
	}
	if pref.MaxConcurrency > 20 {
		pref.MaxConcurrency = 20
	}

	return s.preferenceRepo.Update(pref)
}
