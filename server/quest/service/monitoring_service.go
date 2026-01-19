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

	// 並發 ping
	results := s.pingDevicesConcurrently(monitorDevices)

	// 更新設備狀態
	for deviceID, result := range results {
		device, err := s.deviceRepo.GetByID(deviceID)
		if err != nil {
			continue
		}

		// 安全起見：手動斷開的設備不應被監控覆寫
		if device.Status == model.DeviceStatusDisconnected {
			continue
		}

		oldStatus := device.Status
		now := time.Now()

		if result.Success {
			// Ping 成功
			if device.Status == model.DeviceStatusOffline {
				// auto_reconnect_enabled=false：僅更新 ping 值，不做自動重連
				if !device.AutoReconnectEnabled {
					_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
				} else if device.AutoReconnectDisabledReason != "" {
					_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
				} else if maxRetries == 0 {
					_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
				} else if device.AutoReconnectRetryCount >= maxRetries {
					// 觸頂：轉為 error，停止後續自動重連
					reason := classifyAdbErrorMessage(device.AutoReconnectLastError)
					if reason == "unknown" {
						reason = "max_retries_exhausted"
					}
					device.Status = model.DeviceStatusError
					device.AutoReconnectDisabledReason = reason
					device.AutoReconnectNextAttemptAt = nil
					_ = s.deviceRepo.Update(device)
				} else if device.AutoReconnectNextAttemptAt != nil && now.Before(*device.AutoReconnectNextAttemptAt) {
					_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
				} else {
					log.Printf("[MonitoringService] Device %s reachable, attempting reconnect\n", device.GetDisplayName())
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
							continue
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
			} else if device.Status == model.DeviceStatusError {
				// error 狀態：不再自動重連，但允許更新 ping 值
				_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
			} else {
				// 更新 ping 值
				_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
			}
		} else {
			// Ping 失敗
			if device.Status == model.DeviceStatusError {
				// 保留 error 狀態（不覆寫為 offline）
				_ = s.deviceRepo.UpdateStatus(deviceID, device.Status, 0)
			} else if device.Status != model.DeviceStatusOffline {
				log.Printf("[MonitoringService] Device %s offline (ping failed)\n", device.GetDisplayName())
				_ = s.deviceRepo.UpdateStatus(deviceID, model.DeviceStatusOffline, 0)
			}
		}

		if oldStatus != device.Status {
			log.Printf("[MonitoringService] Device %s status changed: %s -> %s\n",
				device.GetDisplayName(), oldStatus, device.Status)
		}
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

// tryReconnectDevice 嘗試重新連接設備
func (s *MonitoringService) tryReconnectDevice(device *model.QuestDevice) error {
	// 更新為連接中狀態
	s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusConnecting, 0)

	port := device.Port
	if port == 0 {
		port = 5555
	}

	// 嘗試連接
	if err := s.adbManager.Connect(device.IP, port); err != nil {
		log.Printf("[MonitoringService] Failed to reconnect device %s: %v\n", device.GetDisplayName(), err)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline, 0)
		return err
	}

	// 獲取設備列表以確認連接成功
	devices, err := s.adbManager.GetDevices()
	if err != nil {
		log.Printf("[MonitoringService] Failed to get devices for %s: %v\n", device.GetDisplayName(), err)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline, 0)
		return err
	}

	// 查找對應的設備
	address := fmt.Sprintf("%s:%d", device.IP, port)
	var serial string
	for _, dev := range devices {
		if strings.Contains(dev.Serial, address) {
			serial = dev.Serial
			break
		}
	}

	if serial == "" {
		log.Printf("[MonitoringService] Device %s not found in device list\n", device.GetDisplayName())
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline, 0)
		return fmt.Errorf("device not found in adb device list")
	}

	// 更新設備信息
	device.Serial = serial
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
