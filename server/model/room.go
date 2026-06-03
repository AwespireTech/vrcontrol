package model

import "time"

type RoomActivityDefaults struct {
	Name            string         `json:"name"`
	ActivityContext map[string]any `json:"activity_context"`
	Seed            *int           `json:"seed,omitempty"`
}

type RoomOperationProfile struct {
	ActivityDefaults          RoomActivityDefaults `json:"activity_defaults"`
	BatchActionIDs            []string             `json:"batch_action_ids"`
	LaunchActionID            string               `json:"launch_action_id,omitempty"`
	StopActionID              string               `json:"stop_action_id,omitempty"`
	AllowActivityNameOverride bool                 `json:"allow_activity_name_override"`
	AllowSeedOverride         bool                 `json:"allow_seed_override"`
}

// Room 房間模型
type Room struct {
	RoomID            string               `json:"room_id"`
	Name              string               `json:"name"`
	Description       string               `json:"description"`
	MaxDevices        int                  `json:"max_devices"`
	DeviceIDs         []string             `json:"device_ids"`
	AssignedSequences map[string]int       `json:"assigned_sequences"`
	SocketIP          string               `json:"socket_ip"`
	SocketPort        int                  `json:"socket_port"`
	SocketRunning     bool                 `json:"socket_running"`
	Parameters        map[string]any       `json:"parameters"`
	OperationProfile  RoomOperationProfile `json:"operation_profile"`
	CreatedAt         time.Time            `json:"created_at"`
	UpdatedAt         time.Time            `json:"updated_at"`
}

// RoomParameter 房間參數
type RoomParameter struct {
	Key          string         `json:"key"`
	Type         string         `json:"type"` // string, boolean, integer, float, array
	GlobalValue  any            `json:"global_value"`
	DeviceValues map[string]any `json:"device_values"` // device_id -> value
}

// ParameterType 參數類型常量
const (
	ParamTypeString  = "string"
	ParamTypeBoolean = "boolean"
	ParamTypeInteger = "integer"
	ParamTypeFloat   = "float"
	ParamTypeArray   = "array"
)
