package service

import (
	"fmt"
	"sync"
	"time"

	"vrcontrol/server/adb"
	"vrcontrol/server/model"
	"vrcontrol/server/repository"
)

type deviceConnectionADB interface {
	GetDevices() ([]adb.Device, error)
	Connect(ip string, port int) error
	Disconnect(ip string, port int) error
	ResolveConnectedDevice(target string, retries int, retryDelay time.Duration) (*adb.Device, error)
	GetDeviceInfo(serial string) (*adb.DeviceInfo, error)
	GetDeviceStatus(serial string) (*adb.DeviceStatus, error)
}

type DeviceConnectionStatus struct {
	DeviceID                    string     `json:"device_id"`
	Status                      string     `json:"status"`
	AutoReconnectDisabledReason string     `json:"auto_reconnect_disabled_reason,omitempty"`
	AutoReconnectRetryCount     int        `json:"auto_reconnect_retry_count,omitempty"`
	AutoReconnectNextAttemptAt  *time.Time `json:"auto_reconnect_next_attempt_at,omitempty"`
	AutoReconnectLastError      string     `json:"auto_reconnect_last_error,omitempty"`
}

type DeviceConnectionSnapshot struct {
	CheckedAt      time.Time                `json:"checked_at"`
	LastSuccessful time.Time                `json:"last_successful_check"`
	Statuses       []DeviceConnectionStatus `json:"statuses"`
}

type DeviceConnectionHealth struct {
	LastChecked    time.Time `json:"last_checked"`
	LastSuccessful time.Time `json:"last_successful_check"`
	LastError      string    `json:"last_error,omitempty"`
}

type DeviceConnectionService struct {
	deviceRepo              *repository.DeviceRepository
	adbManager              deviceConnectionADB
	disconnectVerifyRetries int
	disconnectRetryDelay    time.Duration
	mu                      sync.Mutex
	healthMu                sync.RWMutex
	health                  DeviceConnectionHealth
}

func NewDeviceConnectionService(deviceRepo *repository.DeviceRepository, adbManager deviceConnectionADB) *DeviceConnectionService {
	return &DeviceConnectionService{
		deviceRepo:              deviceRepo,
		adbManager:              adbManager,
		disconnectVerifyRetries: 3,
		disconnectRetryDelay:    150 * time.Millisecond,
	}
}

func (s *DeviceConnectionService) ConnectDevice(deviceID string) (*model.Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connectDeviceLocked(deviceID, true)
}

func (s *DeviceConnectionService) ReconnectDevice(deviceID string) (*model.Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}
	if device.Status == model.DeviceStatusDisconnected {
		return nil, fmt.Errorf("automatic reconnect skipped: device is manually disconnected")
	}
	if !device.AutoReconnectEnabled || device.AutoReconnectDisabledReason != "" {
		return nil, fmt.Errorf("automatic reconnect skipped: reconnect is disabled")
	}
	return s.connectDeviceLocked(deviceID, false)
}

func (s *DeviceConnectionService) connectDeviceLocked(deviceID string, manual bool) (*model.Device, error) {

	stored, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}
	device := *stored
	port := normalizedDevicePort(&device)
	target := fmt.Sprintf("%s:%d", device.IP, port)

	if manual {
		device.AutoReconnectDisabledReason = ""
		device.AutoReconnectRetryCount = 0
		device.AutoReconnectNextAttemptAt = nil
		device.AutoReconnectLastError = ""
	}
	device.Status = model.DeviceStatusConnecting
	if err := s.deviceRepo.Update(&device); err != nil {
		return nil, err
	}

	if err := s.adbManager.Connect(device.IP, port); err != nil {
		if manual {
			device.Status = model.DeviceStatusError
		} else {
			device.Status = model.DeviceStatusOffline
		}
		_ = s.deviceRepo.Update(&device)
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	connected, err := s.adbManager.ResolveConnectedDevice(target, 5, 300*time.Millisecond)
	if err != nil {
		device.Status = model.DeviceStatusOffline
		_ = s.deviceRepo.Update(&device)
		return nil, fmt.Errorf("connected target %s was not found in ADB device list: %w", target, err)
	}

	device.Serial = connected.Serial
	if connected.Model != "" {
		device.Model = connected.Model
	}
	if info, infoErr := s.adbManager.GetDeviceInfo(device.Serial); infoErr == nil {
		if info.Model != "" {
			device.Model = info.Model
		}
		if info.AndroidVersion != "" {
			device.AndroidVersion = info.AndroidVersion
		}
	}
	if status, statusErr := s.adbManager.GetDeviceStatus(device.Serial); statusErr == nil {
		device.Battery = status.Battery
		device.Temperature = status.Temperature
		device.IsCharging = status.IsCharging
	}

	device.Status = model.DeviceStatusOnline
	device.AutoReconnectDisabledReason = ""
	device.AutoReconnectRetryCount = 0
	device.AutoReconnectNextAttemptAt = nil
	device.AutoReconnectLastError = ""
	device.LastSeen = time.Now()
	if err := s.deviceRepo.Update(&device); err != nil {
		return nil, err
	}
	return &device, nil
}

func (s *DeviceConnectionService) ClearReconnectStateIfOnline(deviceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	stored, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}
	if stored.Status != model.DeviceStatusOnline {
		return nil
	}
	if stored.AutoReconnectRetryCount == 0 && stored.AutoReconnectDisabledReason == "" && stored.AutoReconnectLastError == "" {
		return nil
	}

	device := *stored
	device.AutoReconnectRetryCount = 0
	device.AutoReconnectDisabledReason = ""
	device.AutoReconnectNextAttemptAt = nil
	device.AutoReconnectLastError = ""
	return s.deviceRepo.Update(&device)
}

func (s *DeviceConnectionService) MarkReconnectExhausted(deviceID string, maxRetries int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	stored, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}
	if stored.Status == model.DeviceStatusDisconnected || stored.Status == model.DeviceStatusOnline || stored.AutoReconnectRetryCount < maxRetries {
		return nil
	}

	device := *stored
	reason := classifyAdbErrorMessage(device.AutoReconnectLastError)
	if reason == "unknown" {
		reason = "max_retries_exhausted"
	}
	device.Status = model.DeviceStatusError
	device.AutoReconnectDisabledReason = reason
	device.AutoReconnectNextAttemptAt = nil
	return s.deviceRepo.Update(&device)
}

func (s *DeviceConnectionService) RecordReconnectFailure(deviceID string, reconnectErr error, cooldown time.Duration, maxRetries int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	stored, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}
	if stored.Status == model.DeviceStatusDisconnected {
		return nil
	}

	device := *stored
	reason := classifyAdbError(reconnectErr)
	device.AutoReconnectRetryCount++
	device.AutoReconnectLastError = reconnectErr.Error()
	device.Status = model.DeviceStatusOffline

	if reason == "adb_not_found" || device.AutoReconnectRetryCount >= maxRetries {
		device.Status = model.DeviceStatusError
		if reason == "unknown" {
			reason = "max_retries_exhausted"
		}
		device.AutoReconnectDisabledReason = reason
		device.AutoReconnectNextAttemptAt = nil
	} else {
		nextAttempt := time.Now().Add(cooldown)
		device.AutoReconnectNextAttemptAt = &nextAttempt
	}
	return s.deviceRepo.Update(&device)
}

func (s *DeviceConnectionService) DisconnectDevice(deviceID string) (*model.Device, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	stored, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, err
	}

	adbDevices, err := s.adbManager.GetDevices()
	if err != nil {
		return nil, fmt.Errorf("cannot verify device connection before disconnect: %w", err)
	}
	if !isDeviceOnlineInADB(stored, onlineADBSerials(adbDevices)) {
		return s.markManuallyDisconnected(stored)
	}

	port := normalizedDevicePort(stored)
	disconnectErr := s.adbManager.Disconnect(stored.IP, port)
	for attempt := 0; attempt < s.disconnectVerifyRetries; attempt++ {
		if attempt > 0 && s.disconnectRetryDelay > 0 {
			time.Sleep(s.disconnectRetryDelay)
		}

		currentDevices, listErr := s.adbManager.GetDevices()
		if listErr != nil {
			return nil, fmt.Errorf("cannot verify device connection after disconnect: %w", listErr)
		}
		if !isDeviceOnlineInADB(stored, onlineADBSerials(currentDevices)) {
			return s.markManuallyDisconnected(stored)
		}
	}

	if disconnectErr != nil {
		return nil, fmt.Errorf("failed to disconnect device and it is still present in ADB: %w", disconnectErr)
	}
	return nil, fmt.Errorf("device is still present in ADB after disconnect")
}

func (s *DeviceConnectionService) ReconcileADBStatuses() (*DeviceConnectionSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	checkedAt := time.Now()
	adbDevices, err := s.adbManager.GetDevices()
	if err != nil {
		s.setHealth(checkedAt, time.Time{}, err.Error())
		return nil, fmt.Errorf("failed to get ADB device list: %w", err)
	}

	onlineSerials := make(map[string]struct{}, len(adbDevices))
	for _, device := range adbDevices {
		if device.State == "device" {
			onlineSerials[device.Serial] = struct{}{}
		}
	}

	for _, device := range s.deviceRepo.GetAll() {
		if device.Status == model.DeviceStatusDisconnected {
			continue
		}

		if isDeviceOnlineInADB(device, onlineSerials) {
			if device.Status != model.DeviceStatusOnline {
				if err := s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOnline); err != nil {
					return nil, err
				}
			}
			continue
		}

		if device.Status == model.DeviceStatusOnline || device.Status == model.DeviceStatusConnecting {
			if err := s.deviceRepo.UpdateStatus(device.DeviceID, model.DeviceStatusOffline); err != nil {
				return nil, err
			}
		}
	}

	s.setHealth(checkedAt, checkedAt, "")
	return s.snapshot(checkedAt), nil
}

func (s *DeviceConnectionService) Health() DeviceConnectionHealth {
	s.healthMu.RLock()
	defer s.healthMu.RUnlock()
	return s.health
}

func (s *DeviceConnectionService) setHealth(checkedAt, successfulAt time.Time, lastError string) {
	s.healthMu.Lock()
	defer s.healthMu.Unlock()
	s.health.LastChecked = checkedAt
	if !successfulAt.IsZero() {
		s.health.LastSuccessful = successfulAt
	}
	s.health.LastError = lastError
}

func (s *DeviceConnectionService) snapshot(checkedAt time.Time) *DeviceConnectionSnapshot {
	health := s.Health()
	devices := s.deviceRepo.GetAll()
	statuses := make([]DeviceConnectionStatus, 0, len(devices))
	for _, device := range devices {
		statuses = append(statuses, DeviceConnectionStatus{
			DeviceID:                    device.DeviceID,
			Status:                      device.Status,
			AutoReconnectDisabledReason: device.AutoReconnectDisabledReason,
			AutoReconnectRetryCount:     device.AutoReconnectRetryCount,
			AutoReconnectNextAttemptAt:  device.AutoReconnectNextAttemptAt,
			AutoReconnectLastError:      device.AutoReconnectLastError,
		})
	}

	return &DeviceConnectionSnapshot{
		CheckedAt:      checkedAt,
		LastSuccessful: health.LastSuccessful,
		Statuses:       statuses,
	}
}

func (s *DeviceConnectionService) markManuallyDisconnected(stored *model.Device) (*model.Device, error) {
	device := *stored
	device.Status = model.DeviceStatusDisconnected
	device.AutoReconnectDisabledReason = "manual_disconnect"
	device.AutoReconnectRetryCount = 0
	device.AutoReconnectNextAttemptAt = nil
	device.AutoReconnectLastError = ""
	if err := s.deviceRepo.Update(&device); err != nil {
		return nil, err
	}
	return &device, nil
}

func onlineADBSerials(devices []adb.Device) map[string]struct{} {
	onlineSerials := make(map[string]struct{}, len(devices))
	for _, device := range devices {
		if device.State == "device" {
			onlineSerials[device.Serial] = struct{}{}
		}
	}
	return onlineSerials
}

func normalizedDevicePort(device *model.Device) int {
	if device.Port == 0 {
		return 5555
	}
	return device.Port
}

func isDeviceOnlineInADB(device *model.Device, onlineSerials map[string]struct{}) bool {
	if device.Serial != "" {
		if _, ok := onlineSerials[device.Serial]; ok {
			return true
		}
	}

	if device.IP == "" {
		return false
	}

	port := normalizedDevicePort(device)
	_, ok := onlineSerials[fmt.Sprintf("%s:%d", device.IP, port)]
	return ok
}
