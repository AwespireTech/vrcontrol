package service

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"vrcontrol/server/adb"
	"vrcontrol/server/model"
	"vrcontrol/server/repository"
)

func classifyAdbErrorMessage(message string) string {
	lower := strings.ToLower(message)

	// adb binary missing / not found
	if strings.Contains(lower, "executable file not found") ||
		strings.Contains(lower, "not recognized") ||
		strings.Contains(lower, "no such file or directory") ||
		strings.Contains(lower, "system cannot find the file") {
		return "adb_not_found"
	}

	// common connect/transport failures
	if strings.Contains(lower, "failed to connect") ||
		strings.Contains(lower, "connection failed") ||
		strings.Contains(lower, "cannot connect") ||
		strings.Contains(lower, "unable to connect") ||
		strings.Contains(lower, "unable") && strings.Contains(lower, "connect") {
		return "adb_connect_failed"
	}

	return "unknown"
}

func classifyAdbError(err error) string {
	if err == nil {
		return "unknown"
	}
	return classifyAdbErrorMessage(err.Error())
}

// MonitoringService 監控服務
type MonitoringService struct {
	deviceRepo     *repository.DeviceRepository
	pingManager    *adb.PingManager
	adbManager     *adb.ADBManager
	preferenceRepo *repository.PreferenceRepository
	interval       time.Duration
	stopChan       chan struct{}
	running        bool
	mutex          sync.RWMutex
	monitorMu      sync.Mutex
}

// NewMonitoringService 創建新的監控服務
func NewMonitoringService(
	deviceRepo *repository.DeviceRepository,
	pingManager *adb.PingManager,
	adbManager *adb.ADBManager,
	preferenceRepo *repository.PreferenceRepository,
) *MonitoringService {
	return &MonitoringService{
		deviceRepo:     deviceRepo,
		pingManager:    pingManager,
		adbManager:     adbManager,
		preferenceRepo: preferenceRepo,
		interval:       10 * time.Second, // 預設 10 秒
		stopChan:       make(chan struct{}),
	}
}

// SetInterval 設置監控間隔
func (s *MonitoringService) SetInterval(interval time.Duration) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.interval = interval
}

// Start 啟動監控服務
func (s *MonitoringService) Start() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.running {
		return nil
	}

	s.running = true
	s.stopChan = make(chan struct{})

	go s.monitorLoop()

	log.Println("[MonitoringService] Started with interval:", s.interval)
	return nil
}

// Stop 停止監控服務
func (s *MonitoringService) Stop() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return
	}

	close(s.stopChan)
	s.running = false

	log.Println("[MonitoringService] Stopped")
}

// IsRunning 檢查服務是否正在運行
func (s *MonitoringService) IsRunning() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.running
}

// monitorLoop 監控循環
func (s *MonitoringService) monitorLoop() {
	// 使用 timer，每輪都讀取最新 interval，讓 SetInterval 可動態生效
	timer := time.NewTimer(0)
	defer timer.Stop()

	for {
		select {
		case <-timer.C:
			s.monitorMu.Lock()
			s.performMonitoring()
			s.monitorMu.Unlock()

			s.mutex.RLock()
			interval := s.interval
			s.mutex.RUnlock()
			if interval <= 0 {
				interval = 10 * time.Second
			}
			timer.Reset(interval)
		case <-s.stopChan:
			return
		}
	}
}

// performMonitoring 執行一次監控
func (s *MonitoringService) performMonitoring() {
	devices := s.deviceRepo.GetAll()

	// 讀取自動重連設定（可調）
	cooldown := 30 * time.Second
	maxRetries := 5
	if s.preferenceRepo != nil {
		pref := s.preferenceRepo.Get()
		if pref.ReconnectCooldownSec > 0 {
			cooldown = time.Duration(pref.ReconnectCooldownSec) * time.Second
		}
		if pref.ReconnectMaxRetries >= 0 {
			maxRetries = pref.ReconnectMaxRetries
		}
	}

	// 以 ADB 裝置清單作為主要在線判斷
	adbDevices, adbErr := s.adbManager.GetDevices()
	if adbErr != nil {
		log.Printf("[MonitoringService] Failed to get ADB device list: %v\n", adbErr)
	}

	onlineSerials := make(map[string]struct{}, len(adbDevices))
	for _, d := range adbDevices {
		if d.State == "device" {
			onlineSerials[d.Serial] = struct{}{}
		}
	}

	// 過濾需要監控的設備
	var monitorDevices []*model.QuestDevice
	for _, device := range devices {
		// 跳過連接中與手動斷開的設備（disconnected 完全不 ping、不自動重連）
		if device.Status == model.DeviceStatusConnecting || device.Status == model.DeviceStatusDisconnected {
			continue
		}
		// 只監控有 IP 地址的設備
		if device.IP != "" {
			monitorDevices = append(monitorDevices, device)
		}
	}

	if len(monitorDevices) == 0 {
		return
	}

	log.Printf("[MonitoringService] Monitoring %d devices\n", len(monitorDevices))

	// 先用 ADB 狀態更新可操作性
	for _, device := range monitorDevices {
		// 安全起見：手動斷開的設備不應被監控覆寫
		if device.Status == model.DeviceStatusDisconnected {
			continue
		}

		oldStatus := device.Status
		now := time.Now()

		adbOnline := s.isDeviceOnlineInADB(device, onlineSerials)
		if adbOnline {
			if device.Status != model.DeviceStatusOnline {
				device.Status = model.DeviceStatusOnline
				_ = s.deviceRepo.UpdateStatus(device.DeviceID, device.Status)
			}
			// 若已在線，清理重連狀態
			if device.AutoReconnectRetryCount > 0 || device.AutoReconnectDisabledReason != "" || device.AutoReconnectLastError != "" {
				device.AutoReconnectRetryCount = 0
				device.AutoReconnectDisabledReason = ""
				device.AutoReconnectNextAttemptAt = nil
				device.AutoReconnectLastError = ""
				_ = s.deviceRepo.Update(device)
			}
		} else {
			// ADB 未連線，視為不可操作
			if device.Status != model.DeviceStatusOffline && device.Status != model.DeviceStatusError {
				log.Printf("[MonitoringService] Device %s offline (adb not connected)\n", device.GetDisplayName())
				device.Status = model.DeviceStatusOffline
				_ = s.deviceRepo.UpdateStatus(device.DeviceID, device.Status)
			}

			// auto_reconnect_enabled=false：不做自動重連
			if !device.AutoReconnectEnabled {
				// no-op
			} else if device.AutoReconnectDisabledReason != "" {
				// no-op
			} else if maxRetries == 0 {
				// no-op
			} else if device.AutoReconnectRetryCount >= maxRetries {
				reason := classifyAdbErrorMessage(device.AutoReconnectLastError)
				if reason == "unknown" {
					reason = "max_retries_exhausted"
				}
				device.Status = model.DeviceStatusError
				device.AutoReconnectDisabledReason = reason
				device.AutoReconnectNextAttemptAt = nil
				_ = s.deviceRepo.Update(device)
			} else if device.AutoReconnectNextAttemptAt != nil && now.Before(*device.AutoReconnectNextAttemptAt) {
				// cooldown 中
			} else {
				log.Printf("[MonitoringService] Device %s attempting reconnect\n", device.GetDisplayName())
				if err := s.tryReconnectDevice(device); err != nil {
					reason := classifyAdbError(err)
					device.AutoReconnectRetryCount++
					device.AutoReconnectLastError = err.Error()

					// adb 不存在：直接轉 error 並停用後續自動重連
					if reason == "adb_not_found" {
						device.Status = model.DeviceStatusError
						device.AutoReconnectDisabledReason = reason
						device.AutoReconnectNextAttemptAt = nil
						_ = s.deviceRepo.Update(device)
						goto statusLog
					}

					next := now.Add(cooldown)
					device.AutoReconnectNextAttemptAt = &next
					if device.AutoReconnectRetryCount >= maxRetries {
						device.Status = model.DeviceStatusError
						if reason == "unknown" {
							reason = "max_retries_exhausted"
						}
						device.AutoReconnectDisabledReason = reason
						device.AutoReconnectNextAttemptAt = nil
					} else {
						device.Status = model.DeviceStatusOffline
					}
					_ = s.deviceRepo.Update(device)
				} else {
					// 連線成功，清除重試狀態
					device.AutoReconnectRetryCount = 0
					device.AutoReconnectDisabledReason = ""
					device.AutoReconnectNextAttemptAt = nil
					device.AutoReconnectLastError = ""
					_ = s.deviceRepo.Update(device)
				}
			}
		}

	statusLog:
		if oldStatus != device.Status {
			log.Printf("[MonitoringService] Device %s status changed: %s -> %s\n",
				device.GetDisplayName(), oldStatus, device.Status)
		}
	}

	// 再並發 ping，僅更新 ping_status/ping_ms
	results := s.pingDevicesConcurrently(monitorDevices)
	for deviceID, result := range results {
		pingStatus := model.PingStatusFail
		pingMS := 0.0
		if result.Success {
			pingStatus = model.PingStatusOK
			pingMS = result.Latency
		} else if result.Error != nil && strings.Contains(strings.ToLower(result.Error.Error()), "timeout") {
			pingStatus = model.PingStatusTimeout
		}

		_ = s.deviceRepo.UpdatePingStatus(deviceID, pingStatus, pingMS)
	}
}

// pingDevicesConcurrently 並發 ping 多個設備
func (s *MonitoringService) pingDevicesConcurrently(devices []*model.QuestDevice) map[string]*adb.PingResult {
	results := make(map[string]*adb.PingResult)
	var mutex sync.Mutex
	var wg sync.WaitGroup

	// 限制併發數
	maxWorkers := 10
	semaphore := make(chan struct{}, maxWorkers)

	for _, device := range devices {
		wg.Add(1)
		go func(dev *model.QuestDevice) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			result := s.pingManager.Ping(dev.IP)

			mutex.Lock()
			results[dev.DeviceID] = &result
			mutex.Unlock()
		}(device)
	}

	wg.Wait()
	return results
}

// isDeviceOnlineInADB 根據 ADB 裝置清單判斷是否在線
func (s *MonitoringService) isDeviceOnlineInADB(device *model.QuestDevice, onlineSerials map[string]struct{}) bool {
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

// tryReconnectDevice 嘗試重新連接設備
func (s *MonitoringService) tryReconnectDevice(device *model.QuestDevice) error {
	// 更新為連接中狀態
	s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusConnecting)

	port := device.Port
	if port == 0 {
		port = 5555
	}

	// 嘗試連接
	if err := s.adbManager.Connect(device.IP, port); err != nil {
		log.Printf("[MonitoringService] Failed to reconnect device %s: %v\n", device.GetDisplayName(), err)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline)
		return err
	}

	address := fmt.Sprintf("%s:%d", device.IP, port)

	connected, err := s.adbManager.ResolveConnectedDevice(address, 5, 300*time.Millisecond)
	if err != nil {
		log.Printf("[MonitoringService] Device %s not found in device list for target %s: %v\n", device.GetDisplayName(), address, err)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline)
		return err
	}

	// 更新設備信息
	device.Serial = connected.Serial
	if connected.Model != "" {
		device.Model = connected.Model
	}
	device.Status = model.DeviceStatusOnline

	if err := s.deviceRepo.Update(device); err != nil {
		log.Printf("[MonitoringService] Failed to update device %s: %v\n", device.GetDisplayName(), err)
		return err
	}

	log.Printf("[MonitoringService] Device %s reconnected successfully\n", device.GetDisplayName())
	return nil
}

// MonitorOnce 手動執行一次監控
func (s *MonitoringService) MonitorOnce() {
	s.monitorMu.Lock()
	s.performMonitoring()
	s.monitorMu.Unlock()
}
