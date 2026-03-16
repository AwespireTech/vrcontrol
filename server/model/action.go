package model

import "time"

// Action 動作模型
type Action struct {
	ActionID       string                 `json:"action_id"`
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	ActionType     string                 `json:"action_type"`
	Params         map[string]interface{} `json:"params"`
	ExecutionCount int                    `json:"execution_count"`
	SuccessCount   int                    `json:"success_count"`
	FailureCount   int                    `json:"failure_count"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
	LastExecutedAt *time.Time             `json:"last_executed_at,omitempty"`
}

// ActionType 動作類型常量
const (
	ActionTypeWakeUp     = "wake_up"
	ActionTypeSleep      = "sleep"
	ActionTypeKeepAwake  = "keep_awake"
	ActionTypeLaunchApp  = "launch_app"
	ActionTypeStopApp    = "stop_app"
	ActionTypeRestartApp = "restart_app"
	ActionTypeSendKey    = "send_key"
	ActionTypeInstallAPK = "install_apk"
)

// ExecutionResult 執行結果
type ExecutionResult struct {
	DeviceID string `json:"device_id"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	Error    string `json:"error,omitempty"`
}
