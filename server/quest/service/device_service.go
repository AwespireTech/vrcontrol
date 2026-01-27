package service

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"vrcontrol/server/quest/adb"
	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/repository"
)

// DeviceService 設備管理服務
type DeviceService struct {
	deviceRepo  *repository.DeviceRepository
	adbManager  *adb.ADBManager
	pingManager *adb.PingManager
	mu          sync.RWMutex
}

// NewDeviceService 創建新的設備服務
func NewDeviceService(deviceRepo *repository.DeviceRepository, adbManager *adb.ADBManager, pingManager *adb.PingManager) *DeviceService {
	return &DeviceService{
		deviceRepo:  deviceRepo,
		adbManager:  adbManager,
		pingManager: pingManager,
	}
}

// SyncOnlineStatusFromADBAtStartup 啟動時用 ADB 裝置清單校正「在線」狀態（僅更新 Status）
func (s *DeviceService) SyncOnlineStatusFromADBAtStartup() {
	adbDevices, err := s.adbManager.GetDevices()
	if err != nil {
		log.Printf("[DeviceService] 啟動校正失敗: 取得 ADB 裝置清單錯誤 - %v\n", err)
		return
	}

	onlineSerials := make(map[string]struct{}, len(adbDevices))
	for _, d := range adbDevices {
		if d.State == "device" {
			onlineSerials[d.Serial] = struct{}{}
		}
	}

	checked := 0
	offlined := 0
	devices := s.deviceRepo.GetAll()
	for _, device := range devices {
		if device.Status != model.DeviceStatusOnline {
			continue
		}

		checked++
		if s.isDeviceOnlineInADB(device, onlineSerials) {
			continue
		}

		device.Status = model.DeviceStatusOffline
		if err := s.deviceRepo.Update(device); err != nil {
			log.Printf("[DeviceService] 啟動校正失敗: 更新裝置 %s 狀態錯誤 - %v\n", device.DeviceID, err)
			continue
		}
		offlined++
		log.Printf("[DeviceService] 啟動校正: 裝置 %s 不在 ADB 清單，已設為離線\n", device.GetDisplayName())
	}

	log.Printf("[DeviceService] 啟動校正完成: 檢查在線=%d, 轉離線=%d\n", checked, offlined)
}

func (s *DeviceService) isDeviceOnlineInADB(device *model.QuestDevice, onlineSerials map[string]struct{}) bool {
	if device.Serial != "" {
		if _, ok := onlineSerials[device.Serial]; ok {
			return true
		}
	}

	if device.IP == "" {
		return false
	}

	port := device.Port
	if port == 0 {
		port = 5555
	}

	addr := fmt.Sprintf("%s:%d", device.IP, port)
	if _, ok := onlineSerials[addr]; ok {
		return true
	}

	return false
}

// GetAllDevices 獲取所有設備
func (s *DeviceService) GetAllDevices() []*model.QuestDevice {
	return s.deviceRepo.GetAll()
}

// GetDevice 獲取單個設備
func (s *DeviceService) GetDevice(deviceID string) (*model.QuestDevice, error) {
	return s.deviceRepo.GetByID(deviceID)
}

// CreateDevice 創建新設備
func (s *DeviceService) CreateDevice(device *model.QuestDevice) error {
	log.Println("[DeviceService] CreateDevice: 開始創建設備")
	// 生成 DeviceID
	if device.DeviceID == "" {
		device.DeviceID = fmt.Sprintf("QQ-%d", time.Now().UnixNano()%1000000)
	}
	log.Printf("[DeviceService] CreateDevice: 設備 ID 生成 - %s\n", device.DeviceID)

	// 設置預設值
	if device.Port == 0 {
		device.Port = 5555
	}
	if device.Status == "" {
		device.Status = model.DeviceStatusDisconnected
	}
	if device.PingStatus == "" {
		device.PingStatus = model.PingStatusUnknown
	}
	// 預設允許自動重連（概念與 disconnected 分離）
	if !device.AutoReconnectEnabled {
		device.AutoReconnectEnabled = true
	}

	log.Println("[DeviceService] CreateDevice: 調用 Repository Create")
	err := s.deviceRepo.Create(device)
	if err != nil {
		log.Printf("[DeviceService] CreateDevice: Repository Create 失敗 - %v\n", err)
	} else {
		log.Println("[DeviceService] CreateDevice: Repository Create 成功")
	}
	return err
}

// DevicePatch 可局部更新的設備欄位（嚴格白名單）
type DevicePatch struct {
	Alias                *string `json:"alias"`
	Name                 *string `json:"name"`
	IP                   *string `json:"ip"`
	Port                 *int    `json:"port"`
	Notes                *string `json:"notes"`
	RoomID               *string `json:"room_id"` // read-only, use room API
	AutoReconnectEnabled *bool   `json:"auto_reconnect_enabled"`
}

// PatchDevice 嚴格白名單的局部更新（避免 partial PUT 清空欄位）
func (s *DeviceService) PatchDevice(deviceID string, patch DevicePatch) (*model.QuestDevice, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}

	if patch.Alias != nil {
		device.Alias = *patch.Alias
	}
	if patch.Name != nil {
		device.Name = *patch.Name
	}
	if patch.IP != nil {
		device.IP = *patch.IP
	}
	if patch.Port != nil {
		device.Port = *patch.Port
	}
	if patch.Notes != nil {
		device.Notes = *patch.Notes
	}
	if patch.AutoReconnectEnabled != nil {
		device.AutoReconnectEnabled = *patch.AutoReconnectEnabled
	}

	if err := s.deviceRepo.Update(device); err != nil {
		return nil, err
	}
	return device, nil
}

// SetAutoReconnectEnabledBatch 批次設定 auto_reconnect_enabled
func (s *DeviceService) SetAutoReconnectEnabledBatch(deviceIDs []string, enabled bool) (map[string]string, int) {
	failed := map[string]string{}
	successCount := 0

	for _, id := range deviceIDs {
		_, err := s.PatchDevice(id, DevicePatch{AutoReconnectEnabled: &enabled})
		if err != nil {
			failed[id] = err.Error()
			continue
		}
		successCount++
	}

	return failed, successCount
}

// ResetAutoReconnect 依規則重置自動重連狀態
// 規則：
// - 僅 error → offline
// - disconnected 不改（包含不清除重連狀態）
// - 其他狀態不改，只清 retry/disabled/next/last_error
func (s *DeviceService) ResetAutoReconnect(deviceID string) (*model.QuestDevice, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}

	if device.Status == model.DeviceStatusDisconnected {
		return device, nil
	}

	if device.Status == model.DeviceStatusError {
		device.Status = model.DeviceStatusOffline
	}

	device.AutoReconnectDisabledReason = ""
	device.AutoReconnectRetryCount = 0
	device.AutoReconnectNextAttemptAt = nil
	device.AutoReconnectLastError = ""

	if err := s.deviceRepo.Update(device); err != nil {
		return nil, err
	}

	return device, nil
}

// ResetAutoReconnectBatch 批次重置自動重連狀態
func (s *DeviceService) ResetAutoReconnectBatch(deviceIDs []string) (map[string]string, int) {
	failed := map[string]string{}
	successCount := 0

	for _, id := range deviceIDs {
		_, err := s.ResetAutoReconnect(id)
		if err != nil {
			failed[id] = err.Error()
			continue
		}
		successCount++
	}

	return failed, successCount
}

// UpdateDevice 更新設備
func (s *DeviceService) UpdateDevice(device *model.QuestDevice) error {
	return s.deviceRepo.Update(device)
}

// DeleteDevice 刪除設備
func (s *DeviceService) DeleteDevice(deviceID string) error {
	return s.deviceRepo.Delete(deviceID)
}

// ConnectDevice 連接設備
func (s *DeviceService) ConnectDevice(deviceID string) error {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}

	// 使用者手動連接：清除自動重連停用/重試狀態
	device.AutoReconnectDisabledReason = ""
	device.AutoReconnectRetryCount = 0
	device.AutoReconnectNextAttemptAt = nil
	device.AutoReconnectLastError = ""

	// 更新狀態為連接中
	device.Status = model.DeviceStatusConnecting
	s.deviceRepo.Update(device)

	// 執行連接
	if err := s.adbManager.Connect(device.IP, device.Port); err != nil {
		device.Status = model.DeviceStatusError
		s.deviceRepo.Update(device)
		return fmt.Errorf("failed to connect: %w", err)
	}

	// 獲取設備資訊
	devices, err := s.adbManager.GetDevices()
	if err != nil {
		log.Printf("Warning: failed to get devices after connect: %v", err)
	} else {
		// 找到對應的設備並更新 serial
		for _, d := range devices {
			if d.State == "device" {
				device.Serial = d.Serial
				if d.Model != "" {
					device.Model = d.Model
				}
				break
			}
		}
	}

	// 嘗試獲取設備詳細資訊
	if device.Serial != "" {
		if info, err := s.adbManager.GetDeviceInfo(device.Serial); err == nil {
			if info.Model != "" {
				device.Model = info.Model
			}
			// 不再自動更新 Name，保持用戶設定或 ADB 初次連接時的值
			// if info.Name != "" {
			// 	device.Name = info.Name
			// }
			if info.AndroidVersion != "" {
				device.AndroidVersion = info.AndroidVersion
			}
		}
	}

	// 更新狀態為在線
	device.Status = model.DeviceStatusOnline
	device.LastSeen = time.Now()

	if err := s.deviceRepo.Update(device); err != nil {
		return err
	}

	// 連接成功後立即查詢設備狀態（電量、溫度）
	if device.Serial != "" {
		status, err := s.adbManager.GetDeviceStatus(device.Serial)
		if err != nil {
			log.Printf("[DeviceService] 警告: 連接後查詢設備狀態失敗 - %v\n", err)
		} else {
			device.Battery = status.Battery
			device.Temperature = status.Temperature
			device.IsCharging = status.IsCharging
			s.deviceRepo.Update(device)
			log.Printf("[DeviceService] 設備 %s 狀態更新: 電量=%d%%, 溫度=%.1f°C\n", device.DeviceID, status.Battery, status.Temperature)
		}
	}

	return nil
}

// DisconnectDevice 斷開設備連接
func (s *DeviceService) DisconnectDevice(deviceID string) error {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}

	if err := s.adbManager.Disconnect(device.IP, device.Port); err != nil {
		return err
	}

	device.Status = model.DeviceStatusDisconnected
	// disconnected 代表使用者手動斷開：停用自動重連
	device.AutoReconnectDisabledReason = "manual_disconnect"
	device.AutoReconnectRetryCount = 0
	device.AutoReconnectNextAttemptAt = nil
	device.AutoReconnectLastError = ""
	return s.deviceRepo.Update(device)
}

// GetDeviceStatus 獲取設備狀態
func (s *DeviceService) GetDeviceStatus(deviceID string) (*adb.DeviceStatus, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}

	if device.Serial == "" {
		return nil, fmt.Errorf("device not connected")
	}

	status, err := s.adbManager.GetDeviceStatus(device.Serial)
	if err != nil {
		return nil, err
	}

	// 更新設備資訊
	device.Battery = status.Battery
	device.Temperature = status.Temperature
	device.IsCharging = status.IsCharging
	s.deviceRepo.Update(device)

	return status, nil
}

// PingDevice Ping 設備
func (s *DeviceService) PingDevice(deviceID string) (float64, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return 0, err
	}

	result := s.pingManager.Ping(device.IP)
	pingStatus := model.PingStatusFail
	pingMS := 0.0
	if result.Success {
		pingStatus = model.PingStatusOK
		pingMS = result.Latency
	} else if result.Error != nil && strings.Contains(strings.ToLower(result.Error.Error()), "timeout") {
		pingStatus = model.PingStatusTimeout
	}

	_ = s.deviceRepo.UpdatePingStatus(deviceID, pingStatus, pingMS)

	if !result.Success {
		return 0, result.Error
	}

	return result.Latency, nil
}

// ConnectBatch 批量連接設備
func (s *DeviceService) ConnectBatch(deviceIDs []string, maxWorkers int) map[string]error {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	results := make(map[string]error)
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxWorkers)

	for _, deviceID := range deviceIDs {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			err := s.ConnectDevice(id)

			mu.Lock()
			results[id] = err
			mu.Unlock()
		}(deviceID)
	}

	wg.Wait()
	return results
}

// GetDeviceStatusBatch 批量獲取設備狀態
func (s *DeviceService) GetDeviceStatusBatch(deviceIDs []string, maxWorkers int) []map[string]interface{} {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	results := make([]map[string]interface{}, 0, len(deviceIDs))
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxWorkers)

	for _, deviceID := range deviceIDs {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := map[string]interface{}{
				"device_id": id,
			}

			status, err := s.GetDeviceStatus(id)
			if err != nil {
				result["error"] = err.Error()
				result["battery"] = 0
				result["temperature"] = 0.0
				result["is_charging"] = false
			} else {
				result["battery"] = status.Battery
				result["temperature"] = status.Temperature
				result["is_charging"] = status.IsCharging
				result["error"] = ""
			}

			mu.Lock()
			results = append(results, result)
			mu.Unlock()
		}(deviceID)
	}

	wg.Wait()
	return results
}

// PingBatch 批量 Ping 設備
func (s *DeviceService) PingBatch(deviceIDs []string, maxWorkers int) map[string]float64 {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	// 獲取設備 IP 列表
	devices := make(map[string]string) // deviceID -> IP
	for _, deviceID := range deviceIDs {
		if device, err := s.deviceRepo.GetByID(deviceID); err == nil {
			devices[deviceID] = device.IP
		}
	}

	// 批量 Ping
	ips := make([]string, 0, len(devices))
	ipToDeviceID := make(map[string]string)
	for deviceID, ip := range devices {
		ips = append(ips, ip)
		ipToDeviceID[ip] = deviceID
	}

	pingResults := s.pingManager.PingBatch(ips, maxWorkers)

	// 處理結果並更新設備狀態
	results := make(map[string]float64)
	for ip, result := range pingResults {
		deviceID := ipToDeviceID[ip]
		pingStatus := model.PingStatusFail
		pingMS := 0.0
		if result.Success {
			pingStatus = model.PingStatusOK
			pingMS = result.Latency
		} else if result.Error != nil && strings.Contains(strings.ToLower(result.Error.Error()), "timeout") {
			pingStatus = model.PingStatusTimeout
		}
		results[deviceID] = pingMS
		_ = s.deviceRepo.UpdatePingStatus(deviceID, pingStatus, pingMS)
	}

	return results
}

// GetDevicesByRoom 獲取房間內的設備
func (s *DeviceService) GetDevicesByRoom(roomID string) []*model.QuestDevice {
	return s.deviceRepo.GetByRoomID(roomID)
}

// UpdateDeviceRoom 更新設備所在房間
func (s *DeviceService) UpdateDeviceRoom(deviceID, roomID string) error {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}

	device.RoomID = roomID
	return s.deviceRepo.Update(device)
}
