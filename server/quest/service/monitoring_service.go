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

// MonitoringService 監控服務
type MonitoringService struct {
	deviceRepo  *repository.DeviceRepository
	pingManager *adb.PingManager
	adbManager  *adb.ADBManager
	interval    time.Duration
	stopChan    chan struct{}
	running     bool
	mutex       sync.RWMutex
}

// NewMonitoringService 創建新的監控服務
func NewMonitoringService(
	deviceRepo *repository.DeviceRepository,
	pingManager *adb.PingManager,
	adbManager *adb.ADBManager,
) *MonitoringService {
	return &MonitoringService{
		deviceRepo:  deviceRepo,
		pingManager: pingManager,
		adbManager:  adbManager,
		interval:    10 * time.Second, // 預設 10 秒
		stopChan:    make(chan struct{}),
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
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	// 首次立即執行
	s.performMonitoring()

	for {
		select {
		case <-ticker.C:
			s.performMonitoring()
		case <-s.stopChan:
			return
		}
	}
}

// performMonitoring 執行一次監控
func (s *MonitoringService) performMonitoring() {
	devices := s.deviceRepo.GetAll()

	// 過濾需要監控的設備
	var monitorDevices []*model.QuestDevice
	for _, device := range devices {
		// 跳過離線和連接中的設備
		if device.Status == model.DeviceStatusOffline || device.Status == model.DeviceStatusConnecting {
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

		oldStatus := device.Status

		if result.Success {
			// Ping 成功
			if device.Status == model.DeviceStatusOffline {
				// 從離線變為在線，嘗試重新連接
				log.Printf("[MonitoringService] Device %s back online, attempting reconnect\n", device.Name)
				s.tryReconnectDevice(device)
			} else {
				// 更新 ping 值
				s.deviceRepo.UpdateStatus(deviceID, device.Status, result.Latency)
			}
		} else {
			// Ping 失敗
			if device.Status != model.DeviceStatusOffline {
				log.Printf("[MonitoringService] Device %s offline (ping failed)\n", device.Name)
				s.deviceRepo.UpdateStatus(deviceID, model.DeviceStatusOffline, 0)
			}
		}

		if oldStatus != device.Status {
			log.Printf("[MonitoringService] Device %s status changed: %s -> %s\n",
				device.Name, oldStatus, device.Status)
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
func (s *MonitoringService) tryReconnectDevice(device *model.QuestDevice) {
	// 更新為連接中狀態
	s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusConnecting, 0)

	// 嘗試連接
	if err := s.adbManager.Connect(device.IP, 5555); err != nil {
		log.Printf("[MonitoringService] Failed to reconnect device %s: %v\n", device.Name, err)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline, 0)
		return
	}

	// 獲取設備列表以確認連接成功
	devices, err := s.adbManager.GetDevices()
	if err != nil {
		log.Printf("[MonitoringService] Failed to get devices for %s: %v\n", device.Name, err)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline, 0)
		return
	}

	// 查找對應的設備
	address := fmt.Sprintf("%s:5555", device.IP)
	var serial string
	for _, dev := range devices {
		if strings.Contains(dev.Serial, address) {
			serial = dev.Serial
			break
		}
	}

	if serial == "" {
		log.Printf("[MonitoringService] Device %s not found in device list\n", device.Name)
		s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline, 0)
		return
	}

	// 更新設備信息
	device.Serial = serial
	device.Status = model.DeviceStatusOnline

	if err := s.deviceRepo.Update(device); err != nil {
		log.Printf("[MonitoringService] Failed to update device %s: %v\n", device.Name, err)
		return
	}

	log.Printf("[MonitoringService] Device %s reconnected successfully\n", device.Name)
}

// MonitorOnce 手動執行一次監控
func (s *MonitoringService) MonitorOnce() {
	s.performMonitoring()
}
