package service

import (
	"fmt"
	"log"
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
	// 生成 DeviceID
	if device.DeviceID == "" {
		device.DeviceID = fmt.Sprintf("QQ-%d", time.Now().UnixNano()%1000000)
	}

	// 設置預設值
	if device.Port == 0 {
		device.Port = 5555
	}
	if device.Status == "" {
		device.Status = model.DeviceStatusDisconnected
	}

	return s.deviceRepo.Create(device)
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
			if info.Name != "" {
				device.Name = info.Name
			}
			if info.AndroidVersion != "" {
				device.AndroidVersion = info.AndroidVersion
			}
		}
	}

	// 更新狀態為在線
	device.Status = model.DeviceStatusOnline
	device.LastSeen = time.Now()

	return s.deviceRepo.Update(device)
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

	// 更新設備狀態
	if result.Success {
		device.Status = model.DeviceStatusOnline
		device.PingMS = result.Latency
	} else {
		device.Status = model.DeviceStatusOffline
		device.PingMS = 0
	}

	s.deviceRepo.UpdateStatus(deviceID, device.Status, device.PingMS)

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
func (s *DeviceService) GetDeviceStatusBatch(deviceIDs []string, maxWorkers int) map[string]*adb.DeviceStatus {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	results := make(map[string]*adb.DeviceStatus)
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxWorkers)

	for _, deviceID := range deviceIDs {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			status, err := s.GetDeviceStatus(id)
			if err == nil {
				mu.Lock()
				results[id] = status
				mu.Unlock()
			}
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
		if result.Success {
			results[deviceID] = result.Latency
			s.deviceRepo.UpdateStatus(deviceID, model.DeviceStatusOnline, result.Latency)
		} else {
			results[deviceID] = 0
			s.deviceRepo.UpdateStatus(deviceID, model.DeviceStatusOffline, 0)
		}
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
