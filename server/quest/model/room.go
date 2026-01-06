package model

import "time"

// QuestRoom Quest 房間模型
type QuestRoom struct {
	RoomID        string          `json:"room_id"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	MaxDevices    int             `json:"max_devices"`
	DeviceIDs     []string        `json:"device_ids"`
	SocketIP      string          `json:"socket_ip"`
	SocketPort    int             `json:"socket_port"`
	SocketRunning bool            `json:"socket_running"`
	Parameters    []RoomParameter `json:"parameters"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// RoomParameter 房間參數
type RoomParameter struct {
	Key          string                 `json:"key"`
	Type         string                 `json:"type"` // string, boolean, integer, float, array
	GlobalValue  interface{}            `json:"global_value"`
	DeviceValues map[string]interface{} `json:"device_values"` // device_id -> value
}

// ParameterType 參數類型常量
const (
	ParamTypeString  = "string"
	ParamTypeBoolean = "boolean"
	ParamTypeInteger = "integer"
	ParamTypeFloat   = "float"
	ParamTypeArray   = "array"
)
