package model

import "time"

// ScrcpyConfig represents the configuration for scrcpy screen mirroring
type ScrcpyConfig struct {
	Bitrate       string `json:"bitrate"`         // Video bitrate (e.g., "8M", "16M")
	MaxSize       int    `json:"max_size"`        // Maximum screen width in pixels
	MaxFPS        int    `json:"max_fps"`         // Maximum frame rate
	WindowWidth   *int   `json:"window_width"`    // Window width (nullable)
	WindowHeight  *int   `json:"window_height"`   // Window height (nullable)
	WindowX       *int   `json:"window_x"`        // Window X position (nullable)
	WindowY       *int   `json:"window_y"`        // Window Y position (nullable)
	StayAwake     bool   `json:"stay_awake"`      // Keep device awake
	ShowTouches   bool   `json:"show_touches"`    // Show touch points
	Fullscreen    bool   `json:"fullscreen"`      // Start in fullscreen
	AlwaysOnTop   bool   `json:"always_on_top"`   // Keep window always on top
	TurnScreenOff bool   `json:"turn_screen_off"` // Turn device screen off
	EnableAudio   bool   `json:"enable_audio"`    // Enable audio forwarding (default: false)
	RenderDriver  string `json:"render_driver"`   // Rendering driver (e.g., "opengl", "metal")
}

// ScrcpyWindowLayout describes how to place scrcpy windows during batch start.
// All fields are optional; server will apply safe defaults.
// Coordinates are in screen pixels.
type ScrcpyWindowLayout struct {
	Columns      int  `json:"columns"`       // number of columns in grid (default: 3)
	BaseX        *int `json:"base_x"`         // top-left base x (default: 0)
	BaseY        *int `json:"base_y"`         // top-left base y (default: 0)
	GapX         *int `json:"gap_x"`          // horizontal gap between windows (default: 20)
	GapY         *int `json:"gap_y"`          // vertical gap between windows (default: 40)
	WindowWidth  *int `json:"window_width"`   // override window width for all windows
	WindowHeight *int `json:"window_height"`  // override window height for all windows
}

// DefaultScrcpyConfig returns the default scrcpy configuration
func DefaultScrcpyConfig() *ScrcpyConfig {
	return &ScrcpyConfig{
		Bitrate:       "8M",
		MaxSize:       1024,
		MaxFPS:        60,
		WindowWidth:   nil,
		WindowHeight:  nil,
		WindowX:       nil,
		WindowY:       nil,
		StayAwake:     true,
		ShowTouches:   false,
		Fullscreen:    false,
		AlwaysOnTop:   false,
		TurnScreenOff: false,
		EnableAudio:   false, // Default to false to preserve Quest's built-in audio
		RenderDriver:  "",
	}
}

// DeviceScrcpySession represents an active scrcpy session for a device
type DeviceScrcpySession struct {
	DeviceID  string    `json:"device_id"`  // Device ID
	ProcessID int       `json:"process_id"` // Process PID
	StartedAt time.Time `json:"started_at"` // Session start time
	IsRunning bool      `json:"is_running"` // Whether the process is currently running
}

// ScrcpySystemInfo represents the scrcpy installation status
type ScrcpySystemInfo struct {
	Installed    bool   `json:"installed"`     // Whether scrcpy is installed
	Version      string `json:"version"`       // Scrcpy version string
	Path         string `json:"path"`          // Path to scrcpy executable
	ErrorMessage string `json:"error_message"` // Error message if not installed or check failed
}
