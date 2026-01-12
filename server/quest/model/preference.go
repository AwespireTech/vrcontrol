package model

import "time"

// UserPreference 使用者偏好設定
type UserPreference struct {
	// 設備狀態輪詢間隔（秒）
	PollIntervalSec int `json:"poll_interval_sec"`

	// 批次大小
	BatchSize int `json:"batch_size"`

	// 最大併發數
	MaxConcurrency int `json:"max_concurrency"`

	// 自動重連冷卻時間（秒）
	ReconnectCooldownSec int `json:"reconnect_cooldown_sec"`

	// 自動重連最大重試次數
	ReconnectMaxRetries int `json:"reconnect_max_retries"`

	// 更新時間
	UpdatedAt time.Time `json:"updated_at"`
}

// DefaultUserPreference 返回預設使用者偏好
func DefaultUserPreference() *UserPreference {
	return &UserPreference{
		PollIntervalSec:      15,
		BatchSize:            8,
		MaxConcurrency:       8,
		ReconnectCooldownSec: 30,
		ReconnectMaxRetries:  5,
		UpdatedAt:            time.Now(),
	}
}
