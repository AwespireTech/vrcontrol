package service

import (
	"fmt"
	"sync"
	"time"

	"vrcontrol/server/quest/adb"
	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/repository"
)

// ActionService 動作管理服務
type ActionService struct {
	actionRepo *repository.ActionRepository
	deviceRepo *repository.DeviceRepository
	adbManager *adb.ADBManager
}

// ActionPatch 動作局部更新（嚴格白名單）
type ActionPatch struct {
	Name        *string                 `json:"name"`
	Description *string                 `json:"description"`
	ActionType  *string                 `json:"action_type"`
	Params      *map[string]interface{} `json:"params"`
}

// NewActionService 創建新的動作服務
func NewActionService(actionRepo *repository.ActionRepository, deviceRepo *repository.DeviceRepository, adbManager *adb.ADBManager) *ActionService {
	return &ActionService{
		actionRepo: actionRepo,
		deviceRepo: deviceRepo,
		adbManager: adbManager,
	}
}

// GetAllActions 獲取所有動作
func (s *ActionService) GetAllActions() []*model.QuestAction {
	return s.actionRepo.GetAll()
}

// GetAction 獲取單個動作
func (s *ActionService) GetAction(actionID string) (*model.QuestAction, error) {
	return s.actionRepo.GetByID(actionID)
}

// CreateAction 創建新動作
func (s *ActionService) CreateAction(action *model.QuestAction) error {
	// 生成 ActionID
	if action.ActionID == "" {
		action.ActionID = fmt.Sprintf("ACT-%d", time.Now().UnixNano()%1000000)
	}

	return s.actionRepo.Create(action)
}

// UpdateAction 更新動作
func (s *ActionService) UpdateAction(action *model.QuestAction) error {
	return s.actionRepo.Update(action)
}

// PatchAction 局部更新動作（嚴格白名單）
func (s *ActionService) PatchAction(actionID string, patch ActionPatch) (*model.QuestAction, error) {
	existing, err := s.actionRepo.GetByID(actionID)
	if err != nil {
		return nil, err
	}

	if patch.Name != nil {
		existing.Name = *patch.Name
	}
	if patch.Description != nil {
		existing.Description = *patch.Description
	}
	if patch.ActionType != nil {
		existing.ActionType = *patch.ActionType
	}
	if patch.Params != nil {
		existing.Params = *patch.Params
	}

	if err := s.actionRepo.Update(existing); err != nil {
		return nil, err
	}

	return existing, nil
}

// DeleteAction 刪除動作
func (s *ActionService) DeleteAction(actionID string) error {
	return s.actionRepo.Delete(actionID)
}

// ExecuteAction 執行動作到單個設備
func (s *ActionService) ExecuteAction(actionID, deviceID string) (*model.ExecutionResult, error) {
	action, err := s.actionRepo.GetByID(actionID)
	if err != nil {
		return nil, err
	}

	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}

	result := s.executeActionToDevice(action, device)

	// 更新執行統計
	s.actionRepo.UpdateExecutionStats(actionID, result.Success)

	return result, nil
}

// ExecuteActionBatch 批量執行動作到多個設備
func (s *ActionService) ExecuteActionBatch(actionID string, deviceIDs []string, maxWorkers int) []*model.ExecutionResult {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	action, err := s.actionRepo.GetByID(actionID)
	if err != nil {
		return []*model.ExecutionResult{{
			Success: false,
			Error:   err.Error(),
		}}
	}

	results := make([]*model.ExecutionResult, len(deviceIDs))
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxWorkers)

	for i, deviceID := range deviceIDs {
		wg.Add(1)
		go func(index int, id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			device, err := s.deviceRepo.GetByID(id)
			if err != nil {
				results[index] = &model.ExecutionResult{
					DeviceID: id,
					Success:  false,
					Error:    err.Error(),
				}
				return
			}

			results[index] = s.executeActionToDevice(action, device)
		}(i, deviceID)
	}

	wg.Wait()

	// 更新執行統計
	successCount := 0
	for _, result := range results {
		if result.Success {
			successCount++
		}
	}
	s.actionRepo.UpdateExecutionStats(actionID, successCount > 0)

	return results
}

// executeActionToDevice 執行動作到設備
func (s *ActionService) executeActionToDevice(action *model.QuestAction, device *model.QuestDevice) *model.ExecutionResult {
	result := &model.ExecutionResult{
		DeviceID: device.DeviceID,
		Success:  false,
	}

	if device.Serial == "" {
		result.Error = "device not connected"
		return result
	}

	var err error

	switch action.ActionType {
	case model.ActionTypeWakeUp:
		err = s.adbManager.WakeDevice(device.Serial)
		result.Message = "Device woken up"

	case model.ActionTypeSleep:
		force := getBoolParam(action.Params, "force", false)
		err = s.adbManager.SleepDevice(device.Serial, force)
		result.Message = "Device put to sleep"

	case model.ActionTypeLaunchApp:
		pkg := getStringParam(action.Params, "package", "")
		activity := getStringParam(action.Params, "activity", "")
		if pkg == "" {
			result.Error = "Missing required parameter: package for launch_app action"
			return result
		}
		// 提取 extras
		extras := make(map[string]any)
		if extrasData, ok := action.Params["extras"].(map[string]interface{}); ok {
			extras = extrasData
		}
		err = s.adbManager.LaunchApp(device.Serial, pkg, activity, extras)
		result.Message = fmt.Sprintf("App %s launched", pkg)

	case model.ActionTypeStopApp:
		pkg := getStringParam(action.Params, "package", "")
		method := getStringParam(action.Params, "method", "force-stop")
		if pkg == "" {
			result.Error = "Missing required parameter: package for stop_app action"
			return result
		}
		err = s.adbManager.StopApp(device.Serial, pkg, method)
		result.Message = fmt.Sprintf("App %s stopped", pkg)

	case model.ActionTypeRestartApp:
		pkg := getStringParam(action.Params, "package", "")
		activity := getStringParam(action.Params, "activity", "")
		delay := getIntParam(action.Params, "delay", 1000)
		if pkg == "" {
			result.Error = "Missing required parameter: package for restart_app action"
			return result
		}
		// 停止應用
		err = s.adbManager.StopApp(device.Serial, pkg, "force-stop")
		if err == nil {
			// 等待
			time.Sleep(time.Duration(delay) * time.Millisecond)
			// 啟動應用
			err = s.adbManager.LaunchApp(device.Serial, pkg, activity, nil)
		}
		result.Message = fmt.Sprintf("App %s restarted", pkg)

	case model.ActionTypeSendKey:
		keycode := getIntParam(action.Params, "keycode", 0)
		repeat := getIntParam(action.Params, "repeat", 1)
		if keycode == 0 {
			result.Error = "Missing required parameter: keycode for send_key action"
			return result
		}
		err = s.adbManager.SendKey(device.Serial, keycode, repeat)
		result.Message = fmt.Sprintf("Sent keycode %d", keycode)

	case model.ActionTypeInstallAPK:
		apkPath := getStringParam(action.Params, "apk_path", "")
		replace := getBoolParam(action.Params, "replace", true)
		grantPerms := getBoolParam(action.Params, "grant_permissions", true)
		if apkPath == "" {
			result.Error = "Missing required parameter: apk_path for install_apk action"
			return result
		}
		err = s.adbManager.InstallAPK(device.Serial, apkPath, replace, grantPerms)
		result.Message = "APK installed"

	default:
		result.Error = fmt.Sprintf("unknown action type: %s", action.ActionType)
		return result
	}

	if err != nil {
		result.Error = err.Error()
		return result
	}

	result.Success = true
	return result
}

// Helper functions to extract parameters
func getStringParam(params map[string]interface{}, key, defaultValue string) string {
	if val, ok := params[key].(string); ok {
		return val
	}
	return defaultValue
}

func getIntParam(params map[string]interface{}, key string, defaultValue int) int {
	if val, ok := params[key].(float64); ok {
		return int(val)
	}
	if val, ok := params[key].(int); ok {
		return val
	}
	return defaultValue
}

func getBoolParam(params map[string]interface{}, key string, defaultValue bool) bool {
	if val, ok := params[key].(bool); ok {
		return val
	}
	return defaultValue
}
