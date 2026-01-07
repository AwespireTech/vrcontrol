package model

import "time"

// QuestDevice Quest 設備模型
type QuestDevice struct {
	DeviceID       string    `json:"device_id"`
	Serial         string    `json:"serial"`
	Alias          string    `json:"alias"`
	Name           string    `json:"name"`
	Model          string    `json:"model"`
	AndroidVersion string    `json:"android_version"`
	IP             string    `json:"ip"`
	Port           int       `json:"port"`
	Status         string    `json:"status"` // online, offline, connecting, error, disconnected
	Battery        int       `json:"battery"`
	Temperature    float64   `json:"temperature"`
	IsCharging     bool      `json:"is_charging"`
	PingMS         float64   `json:"ping_ms"`
	RoomID         string    `json:"room_id"`
	Notes          string    `json:"notes"`
	SortOrder      int       `json:"sort_order"`
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
