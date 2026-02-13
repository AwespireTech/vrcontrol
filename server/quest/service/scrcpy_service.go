package service

import (
	"fmt"
	"math"

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
func (s *ScrcpyService) StartScrcpyBatch(deviceIDs []string, customConfig *model.ScrcpyConfig, layout *model.ScrcpyWindowLayout) map[string]error {
	results := make(map[string]error)

	// We apply window placement per device in the incoming order, so operators can
	// keep a consistent “left-to-right, top-to-bottom” mapping.
	for idx, deviceID := range deviceIDs {
		cfg := customConfig
		if layout != nil {
			placed := placeBatchWindow(customConfig, layout, idx, len(deviceIDs))
			cfg = placed
		}

		err := s.StartScrcpy(deviceID, cfg)
		if err != nil {
			results[deviceID] = err
		}
	}

	return results
}

func placeBatchWindow(base *model.ScrcpyConfig, layout *model.ScrcpyWindowLayout, index int, total int) *model.ScrcpyConfig {
	// Copy base config by value so we can safely set pointer fields per device.
	var cfg model.ScrcpyConfig
	if base != nil {
		cfg = *base
	} else {
		cfg = *model.DefaultScrcpyConfig()
	}

	if total <= 0 {
		total = 1
	}

	mode := layout.Mode
	if mode == "" {
		mode = "tile"
	}

	if mode == "manual" {
		// Legacy/manual placement mode.
		cols := layout.Columns
		if cols <= 0 {
			cols = 3
		}
		baseX := 0
		if layout.BaseX != nil {
			baseX = *layout.BaseX
		}
		baseY := 0
		if layout.BaseY != nil {
			baseY = *layout.BaseY
		}
		gapX := 20
		if layout.GapX != nil {
			gapX = *layout.GapX
		}
		gapY := 40
		if layout.GapY != nil {
			gapY = *layout.GapY
		}

		if layout.WindowWidth != nil {
			w := *layout.WindowWidth
			cfg.WindowWidth = &w
		}
		if layout.WindowHeight != nil {
			h := *layout.WindowHeight
			cfg.WindowHeight = &h
		}

		cellW := 480
		cellH := 320
		if cfg.WindowWidth != nil && *cfg.WindowWidth > 0 {
			cellW = *cfg.WindowWidth
		}
		if cfg.WindowHeight != nil && *cfg.WindowHeight > 0 {
			cellH = *cfg.WindowHeight
		}

		row := index / cols
		col := index % cols
		x := baseX + col*(cellW+gapX)
		y := baseY + row*(cellH+gapY)
		cfg.WindowX = &x
		cfg.WindowY = &y
		return &cfg
	}

 	// Tile mode: strict-fit grid to prevent overlap.
	screenW := 1920
	if layout.ScreenWidth != nil && *layout.ScreenWidth > 0 {
		screenW = *layout.ScreenWidth
	}
	screenH := 1080
	if layout.ScreenHeight != nil && *layout.ScreenHeight > 0 {
		screenH = *layout.ScreenHeight
	}
	paddingX := 8
	if layout.PaddingX != nil {
		paddingX = *layout.PaddingX
	}
	paddingY := 8
	if layout.PaddingY != nil {
		paddingY = *layout.PaddingY
	}
	gapX := 8
	if layout.GapX != nil {
		gapX = *layout.GapX
	}
	gapY := 8
	if layout.GapY != nil {
		gapY = *layout.GapY
	}
	frameMarginX := 16
	if layout.FrameMarginX != nil {
		frameMarginX = *layout.FrameMarginX
	}
	frameMarginY := 40
	if layout.FrameMarginY != nil {
		frameMarginY = *layout.FrameMarginY
	}
	originX := 0
	if layout.BaseX != nil {
		originX = *layout.BaseX
	}
	originY := 0
	if layout.BaseY != nil {
		originY = *layout.BaseY
	}

	cols := layout.Columns
	if cols <= 0 {
		cols = int(math.Ceil(math.Sqrt(float64(total))))
	}
	if cols < 1 {
		cols = 1
	}
	if cols > total {
		cols = total
	}
	rows := int(math.Ceil(float64(total) / float64(cols)))
	if rows < 1 {
		rows = 1
	}

	usableW := screenW - 2*paddingX
	usableH := screenH - 2*paddingY
	if usableW < 200 {
		usableW = 200
	}
	if usableH < 160 {
		usableH = 160
	}

	tileW := (usableW - (cols-1)*gapX) / cols
	tileH := (usableH - (rows-1)*gapY) / rows
	if tileW < 160 {
		tileW = 160
	}
	if tileH < 120 {
		tileH = 120
	}

	windowW := tileW - frameMarginX
	windowH := tileH - frameMarginY
	if windowW < 120 {
		windowW = 120
	}
	if windowH < 100 {
		windowH = 100
	}

	if layout.WindowWidth != nil && *layout.WindowWidth > 0 {
		windowW = *layout.WindowWidth
	}
	if layout.WindowHeight != nil && *layout.WindowHeight > 0 {
		windowH = *layout.WindowHeight
	}

	row := index / cols
	col := index % cols
	x := originX + paddingX + col*(tileW+gapX)
	y := originY + paddingY + row*(tileH+gapY)

	maxX := originX + screenW - windowW
	maxY := originY + screenH - windowH
	if x > maxX {
		x = maxX
	}
	if y > maxY {
		y = maxY
	}
	if x < originX {
		x = originX
	}
	if y < originY {
		y = originY
	}

	w := windowW
	h := windowH
	cfg.WindowWidth = &w
	cfg.WindowHeight = &h
	cfg.WindowX = &x
	cfg.WindowY = &y

	return &cfg
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
