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

	// 更新時間
	UpdatedAt time.Time `json:"updated_at"`
}

// DefaultUserPreference 返回預設使用者偏好
func DefaultUserPreference() *UserPreference {
	return &UserPreference{
		PollIntervalSec: 15,
		BatchSize:       8,
		MaxConcurrency:  8,
		UpdatedAt:       time.Now(),
	}
}
