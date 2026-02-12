package service

import (
	"fmt"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/repository"
	"vrcontrol/server/quest/scrcpy"
)

// ScrcpyService handles scrcpy business logic
type ScrcpyService struct {
	scrcpyManager *scrcpy.Manager
	deviceRepo    *repository.DeviceRepository
	configRepo    *repository.ScrcpyConfigRepository
}

// NewScrcpyService creates a new scrcpy service
func NewScrcpyService(
	scrcpyManager *scrcpy.Manager,
	deviceRepo *repository.DeviceRepository,
	configRepo *repository.ScrcpyConfigRepository,
) *ScrcpyService {
	return &ScrcpyService{
		scrcpyManager: scrcpyManager,
		deviceRepo:    deviceRepo,
		configRepo:    configRepo,
	}
}

// CheckSystemInfo checks if scrcpy is installed
func (s *ScrcpyService) CheckSystemInfo() *model.ScrcpySystemInfo {
	return s.scrcpyManager.CheckInstallation()
}

// StartScrcpy starts a scrcpy session for a device
func (s *ScrcpyService) StartScrcpy(deviceID string, customConfig *model.ScrcpyConfig) error {
	// Get device
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return fmt.Errorf("device not found: %w", err)
	}

	// Check device status
	if device.Status != "online" {
		return fmt.Errorf("device is not online (current status: %s)", device.Status)
	}

	// Get config (use custom config or default)
	config := customConfig
	if config == nil {
		config, err = s.configRepo.Get()
		if err != nil {
			// Use default config if not found
			config = model.DefaultScrcpyConfig()
		}
	}

	// Start scrcpy (use alias/name in window title)
	displayName := ""
	if device != nil {
		displayName = device.GetDisplayName()
	}
	return s.scrcpyManager.StartScrcpy(device.Serial, deviceID, displayName, config)
}

// StartScrcpyBatch starts scrcpy sessions for multiple devices
func (s *ScrcpyService) StartScrcpyBatch(deviceIDs []string, customConfig *model.ScrcpyConfig) map[string]error {
	results := make(map[string]error)

	for _, deviceID := range deviceIDs {
		err := s.StartScrcpy(deviceID, customConfig)
		if err != nil {
			results[deviceID] = err
		}
	}

	return results
}

// StopScrcpy stops a scrcpy session for a device
func (s *ScrcpyService) StopScrcpy(deviceID string) error {
	return s.scrcpyManager.StopScrcpy(deviceID)
}

// GetActiveSessions returns all active scrcpy sessions
func (s *ScrcpyService) GetActiveSessions() []*model.DeviceScrcpySession {
	return s.scrcpyManager.GetActiveSessions()
}

// RefreshSessions updates the status of all sessions
func (s *ScrcpyService) RefreshSessions() []*model.DeviceScrcpySession {
	s.scrcpyManager.RefreshSessions()
	return s.scrcpyManager.GetActiveSessions()
}

// GetConfig returns the current scrcpy configuration
func (s *ScrcpyService) GetConfig() (*model.ScrcpyConfig, error) {
	config, err := s.configRepo.Get()
	if err != nil {
		// Return default config if not found
		return model.DefaultScrcpyConfig(), nil
	}
	return config, nil
}

// UpdateConfig updates the scrcpy configuration
func (s *ScrcpyService) UpdateConfig(config *model.ScrcpyConfig) error {
	return s.configRepo.Update(config)
}
