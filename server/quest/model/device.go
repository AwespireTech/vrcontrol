package model

import "time"

// QuestDevice Quest 設備模型
type QuestDevice struct {
	DeviceID       string  `json:"device_id"`
	Serial         string  `json:"serial"`
	Alias          string  `json:"alias"`
	Name           string  `json:"name"`
	Model          string  `json:"model"`
	AndroidVersion string  `json:"android_version"`
	IP             string  `json:"ip"`
	Port           int     `json:"port"`
	Status         string  `json:"status"` // online, offline, connecting, error, disconnected
	Battery        int     `json:"battery"`
	Temperature    float64 `json:"temperature"`
	IsCharging     bool    `json:"is_charging"`
	PingMS         float64 `json:"ping_ms"`
	PingStatus     string  `json:"ping_status"` // ok, fail, timeout, unknown
	RoomID         string  `json:"room_id"`
	Notes          string  `json:"notes"`
	SortOrder      int     `json:"sort_order"`

	// 是否允許監控服務進行自動重連（概念與 disconnected 分離）
	AutoReconnectEnabled bool `json:"auto_reconnect_enabled"`

	// 自動重連狀態（供監控服務與 UI 顯示使用）
	AutoReconnectDisabledReason string     `json:"auto_reconnect_disabled_reason,omitempty"` // manual_disconnect | max_retries_exhausted | adb_not_found | adb_connect_failed | unknown
	AutoReconnectRetryCount     int        `json:"auto_reconnect_retry_count,omitempty"`
	AutoReconnectNextAttemptAt  *time.Time `json:"auto_reconnect_next_attempt_at,omitempty"`
	AutoReconnectLastError      string     `json:"auto_reconnect_last_error,omitempty"`

	LastSeen       time.Time `json:"last_seen"`
	FirstConnected time.Time `json:"first_connected"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// DeviceStatus 設備狀態常量
const (
	DeviceStatusOnline       = "online"
	DeviceStatusOffline      = "offline"
	DeviceStatusConnecting   = "connecting"
	DeviceStatusError        = "error"
	DeviceStatusDisconnected = "disconnected"
)

// PingStatus 網路層 ping 狀態常量
const (
	PingStatusOK      = "ok"
	PingStatusFail    = "fail"
	PingStatusTimeout = "timeout"
	PingStatusUnknown = "unknown"
)

// GetDisplayName 獲取設備顯示名稱，優先使用 Alias，其次使用 Name，最後使用 DeviceID
func (d *QuestDevice) GetDisplayName() string {
	if d.Alias != "" {
		return d.Alias
	}
	if d.Name != "" {
		return d.Name
	}
	return d.DeviceID
}
