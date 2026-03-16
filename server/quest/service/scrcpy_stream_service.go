package service

import (
	"fmt"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/repository"
	"vrcontrol/server/quest/scrcpy"
)

type ScrcpyStreamService struct {
	streamManager *scrcpy.StreamManager
	deviceRepo    *repository.DeviceRepository
	configRepo    *repository.ScrcpyConfigRepository
}

func NewScrcpyStreamService(
	streamManager *scrcpy.StreamManager,
	deviceRepo *repository.DeviceRepository,
	configRepo *repository.ScrcpyConfigRepository,
) *ScrcpyStreamService {
	return &ScrcpyStreamService{
		streamManager: streamManager,
		deviceRepo:    deviceRepo,
		configRepo:    configRepo,
	}
}

func (s *ScrcpyStreamService) StartStream(deviceID string) (*scrcpy.StreamSession, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}
	if device.Status != "online" {
		return nil, fmt.Errorf("device is not online (current status: %s)", device.Status)
	}

	config, err := s.configRepo.Get()
	if err != nil {
		config = model.DefaultScrcpyConfig()
	}

	return s.streamManager.StartStream(device.Serial, deviceID, config)
}
