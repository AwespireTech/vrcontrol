package repository

import (
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"vrcontrol/server/quest/model"
)

// DeviceRepository 設備資料存儲
type DeviceRepository struct {
	repo    *JSONRepository
	devices map[string]*model.QuestDevice
	mu      sync.RWMutex
}

// NewDeviceRepository 創建新的設備 Repository
func NewDeviceRepository(filePath string) *DeviceRepository {
	return &DeviceRepository{
		repo:    NewJSONRepository(filePath),
		devices: make(map[string]*model.QuestDevice),
	}
}

// Load 加載所有設備
func (r *DeviceRepository) Load() error {
	var devices []*model.QuestDevice
	if err := r.repo.Load(&devices); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.devices = make(map[string]*model.QuestDevice)
	for _, device := range devices {
		r.devices[device.DeviceID] = device
	}

	return nil
}

// save 內部保存方法（不加鎖）
func (r *DeviceRepository) save() error {
	devices := make([]*model.QuestDevice, 0, len(r.devices))
	for _, device := range r.devices {
		devices = append(devices, device)
	}

	// 按 SortOrder 排序
	sort.Slice(devices, func(i, j int) bool {
		return devices[i].SortOrder < devices[j].SortOrder
	})

	return r.repo.Save(devices)
}

// Save 保存所有設備
func (r *DeviceRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.save()
}

// GetAll 獲取所有設備
func (r *DeviceRepository) GetAll() []*model.QuestDevice {
	r.mu.RLock()
	defer r.mu.RUnlock()

	devices := make([]*model.QuestDevice, 0, len(r.devices))
	for _, device := range r.devices {
		devices = append(devices, device)
	}

	// 按 SortOrder 排序
	sort.Slice(devices, func(i, j int) bool {
		return devices[i].SortOrder < devices[j].SortOrder
	})

	return devices
}

// GetByID 根據 ID 獲取設備
func (r *DeviceRepository) GetByID(deviceID string) (*model.QuestDevice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	device, exists := r.devices[deviceID]
	if !exists {
		return nil, fmt.Errorf("device not found: %s", deviceID)
	}

	return device, nil
}

// GetBySerial 根據序列號獲取設備
func (r *DeviceRepository) GetBySerial(serial string) (*model.QuestDevice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, device := range r.devices {
		if device.Serial == serial {
			return device, nil
		}
	}

	return nil, fmt.Errorf("device not found with serial: %s", serial)
}

// GetByRoomID 獲取房間內的所有設備
func (r *DeviceRepository) GetByRoomID(roomID string) []*model.QuestDevice {
	r.mu.RLock()
	defer r.mu.RUnlock()

	devices := make([]*model.QuestDevice, 0)
	for _, device := range r.devices {
		if device.RoomID == roomID {
			devices = append(devices, device)
		}
	}

	return devices
}

// Create 創建新設備
func (r *DeviceRepository) Create(device *model.QuestDevice) error {
	log.Printf("[DeviceRepo] Create: 開始創建設備 - ID: %s\n", device.DeviceID)
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.devices[device.DeviceID]; exists {
		log.Printf("[DeviceRepo] Create: 設備已存在 - ID: %s\n", device.DeviceID)
		return fmt.Errorf("device already exists: %s", device.DeviceID)
	}

	// 設置時間戳
	now := time.Now()
	device.CreatedAt = now
	device.UpdatedAt = now
	device.FirstConnected = now
	device.LastSeen = now

	// 設置 SortOrder
	if device.SortOrder == 0 {
		device.SortOrder = len(r.devices) + 1
	}

	r.devices[device.DeviceID] = device

	log.Println("[DeviceRepo] Create: 調用 save 方法")
	err := r.save() // 使用內部不加鎖方法
	if err != nil {
		log.Printf("[DeviceRepo] Create: save 失敗 - %v\n", err)
	} else {
		log.Println("[DeviceRepo] Create: save 成功")
	}
	return err
}

// Update 更新設備
func (r *DeviceRepository) Update(device *model.QuestDevice) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.devices[device.DeviceID]; !exists {
		return fmt.Errorf("device not found: %s", device.DeviceID)
	}

	device.UpdatedAt = time.Now()
	r.devices[device.DeviceID] = device

	return r.save()
}

// Delete 刪除設備
func (r *DeviceRepository) Delete(deviceID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.devices[deviceID]; !exists {
		return fmt.Errorf("device not found: %s", deviceID)
	}

	delete(r.devices, deviceID)

	return r.save()
}

// UpdateStatus 更新設備狀態
func (r *DeviceRepository) UpdateStatus(deviceID, status string, pingMS float64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	device, exists := r.devices[deviceID]
	if !exists {
		return fmt.Errorf("device not found: %s", deviceID)
	}

	device.Status = status
	device.PingMS = pingMS
	device.LastSeen = time.Now()
	device.UpdatedAt = time.Now()

	return r.save()
}

// UpdateBatteryInfo 更新電池資訊
func (r *DeviceRepository) UpdateBatteryInfo(deviceID string, battery int, temperature float64, isCharging bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	device, exists := r.devices[deviceID]
	if !exists {
		return fmt.Errorf("device not found: %s", deviceID)
	}

	device.Battery = battery
	device.Temperature = temperature
	device.IsCharging = isCharging
	device.UpdatedAt = time.Now()

	return r.save()
}

// Count 獲取設備總數
func (r *DeviceRepository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.devices)
}

// Exists 檢查設備是否存在
func (r *DeviceRepository) Exists(deviceID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.devices[deviceID]
	return exists
}
