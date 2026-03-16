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
	Mode         string `json:"mode"`           // "tile" (default) or "manual"
	Columns      int    `json:"columns"`        // number of columns in grid (default: auto)
	ScreenWidth  *int   `json:"screen_width"`   // tiling canvas width (default: 1920)
	ScreenHeight *int   `json:"screen_height"`  // tiling canvas height (default: 1080)
	PaddingX     *int   `json:"padding_x"`      // outer horizontal padding (default: 8)
	PaddingY     *int   `json:"padding_y"`      // outer vertical padding (default: 8)
	GapX         *int   `json:"gap_x"`          // horizontal gap between windows (default: 8)
	GapY         *int   `json:"gap_y"`          // vertical gap between windows (default: 8)
	FrameMarginX *int   `json:"frame_margin_x"` // compensate window frame width (default: 16)
	FrameMarginY *int   `json:"frame_margin_y"` // compensate title bar/frame height (default: 40)
	BaseX        *int   `json:"base_x"`         // manual mode top-left base x (default: 0)
	BaseY        *int   `json:"base_y"`         // manual mode top-left base y (default: 0)
	WindowWidth  *int   `json:"window_width"`   // manual mode or explicit width override
	WindowHeight *int   `json:"window_height"`  // manual mode or explicit height override
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
		EnableAudio:   false, // Default to false to preserve the device's built-in audio
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
