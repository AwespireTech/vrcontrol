package repository

import (
	"log"
	"sync"
	"time"

	"vrcontrol/server/model"
)

// PreferenceRepository 使用者偏好資料存儲
type PreferenceRepository struct {
	repo       *JSONRepository
	preference *model.UserPreference
	mu         sync.RWMutex
}

// NewPreferenceRepository 創建新的偏好 Repository
func NewPreferenceRepository(filePath string) *PreferenceRepository {
	return &PreferenceRepository{
		repo:       NewJSONRepository(filePath),
		preference: model.DefaultUserPreference(),
	}
}

// Load 加載偏好設定
func (r *PreferenceRepository) Load() error {
	var pref model.UserPreference
	err := r.repo.Load(&pref)

	r.mu.Lock()
	defer r.mu.Unlock()

	if err != nil {
		// 讀取失敗時使用預設值並保存
		log.Printf("[PreferenceRepo] 讀取偏好失敗: %v，使用預設值\n", err)
		r.preference = model.DefaultUserPreference()
		if saveErr := r.save(); saveErr != nil {
			log.Printf("[PreferenceRepo] 警告: 保存預設偏好失敗: %v\n", saveErr)
			// 即使保存失敗，仍然使用預設值（記憶體中）
			return nil
		}
		log.Println("[PreferenceRepo] 已創建預設偏好檔案")
		return nil
	}

	// 檢查是否為空（檔案不存在或為空 / 缺必要欄位）
	if pref.PollIntervalSec == 0 {
		// 使用預設值並保存
		log.Println("[PreferenceRepo] 偏好檔案為空，使用預設值")
		r.preference = model.DefaultUserPreference()
		if saveErr := r.save(); saveErr != nil {
			log.Printf("[PreferenceRepo] 警告: 保存預設偏好失敗: %v\n", saveErr)
			return nil
		}
		log.Println("[PreferenceRepo] 已創建預設偏好檔案")
		return nil
	}

	// 逐欄位補齊預設，支援舊版檔案缺新欄位
	defaults := model.DefaultUserPreference()
	changed := false
	if pref.BatchSize == 0 {
		pref.BatchSize = defaults.BatchSize
		changed = true
	}
	if pref.MaxConcurrency == 0 {
		pref.MaxConcurrency = defaults.MaxConcurrency
		changed = true
	}
	if pref.ReconnectCooldownSec == 0 {
		pref.ReconnectCooldownSec = defaults.ReconnectCooldownSec
		changed = true
	}
	if pref.ReconnectMaxRetries == 0 {
		pref.ReconnectMaxRetries = defaults.ReconnectMaxRetries
		changed = true
	}
	if pref.UpdatedAt.IsZero() {
		pref.UpdatedAt = time.Now()
		changed = true
	}

	r.preference = &pref
	if changed {
		if saveErr := r.save(); saveErr != nil {
			log.Printf("[PreferenceRepo] 警告: 回寫補齊後的偏好失敗: %v\n", saveErr)
		} else {
			log.Println("[PreferenceRepo] 已補齊偏好缺失欄位並回寫")
		}
	}

	log.Printf("[PreferenceRepo] 成功載入偏好: 輪詢=%ds, 批大小=%d, 併發=%d, 重連冷卻=%ds, 重連重試=%d\n",
		pref.PollIntervalSec, pref.BatchSize, pref.MaxConcurrency, pref.ReconnectCooldownSec, pref.ReconnectMaxRetries)
	return nil
}

// save 內部保存方法（不加鎖）
func (r *PreferenceRepository) save() error {
	return r.repo.Save(r.preference)
}

// Save 保存偏好設定
func (r *PreferenceRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.save()
}

// Get 獲取偏好設定
func (r *PreferenceRepository) Get() *model.UserPreference {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// 確保不會返回 nil
	if r.preference == nil {
		log.Println("[PreferenceRepo] 警告: preference 為 nil，返回預設值")
		r.preference = model.DefaultUserPreference()
	}

	// 返回副本避免外部修改
	pref := *r.preference
	return &pref
}

// Update 更新偏好設定
func (r *PreferenceRepository) Update(pref *model.UserPreference) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	pref.UpdatedAt = time.Now()
	r.preference = pref

	return r.save()
}
