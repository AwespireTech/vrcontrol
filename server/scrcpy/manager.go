package scrcpy

import (
	"errors"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"

	"vrcontrol/server/model"
)

type sessionMeta struct {
	pid  int
	pgid int
	job  uintptr
}

// Manager manages scrcpy processes and sessions
type Manager struct {
	sessions map[string]*model.DeviceScrcpySession
	meta     map[string]*sessionMeta
	mu       sync.RWMutex
}

// NewManager creates a new scrcpy manager
func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]*model.DeviceScrcpySession),
		meta:     make(map[string]*sessionMeta),
	}
}

// CheckInstallation checks if scrcpy is installed and available
func (m *Manager) CheckInstallation() *model.ScrcpySystemInfo {
	info := &model.ScrcpySystemInfo{
		Installed:    false,
		Version:      "",
		Path:         "",
		ErrorMessage: "",
	}

	// Try to find scrcpy executable
	path, err := exec.LookPath("scrcpy")
	if err != nil {
		info.ErrorMessage = "scrcpy not found in PATH. Please install scrcpy first."
		log.Printf("Scrcpy check failed: %v", err)
		return info
	}

	info.Path = path

	// Get version
	cmd := exec.Command("scrcpy", "--version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		info.ErrorMessage = fmt.Sprintf("Failed to get scrcpy version: %v", err)
		log.Printf("Scrcpy version check failed: %v", err)
		return info
	}

	version := strings.TrimSpace(string(output))
	// Extract version from output (usually first line)
	lines := strings.Split(version, "\n")
	if len(lines) > 0 {
		info.Version = strings.TrimSpace(lines[0])
	} else {
		info.Version = version
	}

	info.Installed = true
	log.Printf("Scrcpy found: version=%s, path=%s", info.Version, info.Path)
	return info
}

// StartScrcpy starts a scrcpy session for a device
func (m *Manager) StartScrcpy(deviceSerial string, deviceID string, displayName string, config *model.ScrcpyConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if session already exists
	if session, exists := m.sessions[deviceID]; exists && session.IsRunning {
		return fmt.Errorf("scrcpy session already running for device %s", deviceID)
	}

	// Build command
	args := m.buildScrcpyArgs(deviceSerial, deviceID, displayName, config)

	cmd := exec.Command("scrcpy", args...)
	setCmdAttributes(cmd)

	// Start process
	if err := cmd.Start(); err != nil {
		log.Printf("Failed to start scrcpy for device %s: %v", deviceID, err)
		return fmt.Errorf("failed to start scrcpy: %w", enrichStartError(err))
	}

	pid := cmd.Process.Pid
	log.Printf("Started scrcpy for device %s (PID: %d)", deviceID, pid)

	meta := &sessionMeta{pid: pid}
	if err := afterStart(meta, cmd); err != nil {
		// Best-effort cleanup.
		_ = cmd.Process.Kill()
		log.Printf("Failed to finalize scrcpy start for device %s (PID: %d): %v", deviceID, pid, err)
		return fmt.Errorf("failed to start scrcpy: %w", err)
	}

	// Create session record
	session := &model.DeviceScrcpySession{
		DeviceID:  deviceID,
		ProcessID: pid,
		StartedAt: time.Now(),
		IsRunning: true,
	}
	m.sessions[deviceID] = session
	m.meta[deviceID] = meta

	// Monitor process in background
	go m.monitorProcess(deviceID, cmd)

	return nil
}

// StopScrcpy stops a scrcpy session for a device
func (m *Manager) StopScrcpy(deviceID string) error {
	// Avoid holding the manager lock while we potentially wait/kill.
	m.mu.RLock()
	session, exists := m.sessions[deviceID]
	if !exists {
		m.mu.RUnlock()
		return fmt.Errorf("no scrcpy session found for device %s", deviceID)
	}

	if !session.IsRunning {
		m.mu.RUnlock()
		return fmt.Errorf("scrcpy session for device %s is not running", deviceID)
	}
	meta := m.meta[deviceID]
	m.mu.RUnlock()

	if meta == nil {
		meta = &sessionMeta{pid: session.ProcessID}
	}

	if err := stop(meta); err != nil {
		log.Printf("Failed to stop scrcpy for device %s (PID: %d): %v", deviceID, meta.pid, err)
		return fmt.Errorf("failed to stop scrcpy: %w", err)
	}

	m.mu.Lock()
	if session, exists := m.sessions[deviceID]; exists {
		session.IsRunning = false
	}
	delete(m.meta, deviceID)
	m.mu.Unlock()

	log.Printf("Stopped scrcpy for device %s (PID: %d)", deviceID, meta.pid)
	return nil
}

// GetActiveSessions returns all active scrcpy sessions
func (m *Manager) GetActiveSessions() []*model.DeviceScrcpySession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessions := make([]*model.DeviceScrcpySession, 0, len(m.sessions))
	for _, session := range m.sessions {
		sessions = append(sessions, session)
	}
	return sessions
}

// RefreshSessions checks and updates the running status of all sessions
func (m *Manager) RefreshSessions() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, session := range m.sessions {
		if session.IsRunning {
			if !processExists(session.ProcessID) {
				session.IsRunning = false
				log.Printf("Session for device %s is no longer running", session.DeviceID)
			}
		}
	}
}

// GetSession returns the session for a specific device
func (m *Manager) GetSession(deviceID string) (*model.DeviceScrcpySession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[deviceID]
	return session, exists
}

// buildScrcpyArgs builds the command line arguments for scrcpy
func (m *Manager) buildScrcpyArgs(deviceSerial string, deviceID string, displayName string, config *model.ScrcpyConfig) []string {
	args := []string{"-s", deviceSerial}

	// Window title
	// Prefer the device alias (displayName) so operators can quickly identify which
	// headset they are mirroring.
	if title := strings.TrimSpace(displayName); title != "" {
		// Guard against control characters/newlines.
		title = strings.ReplaceAll(title, "\n", " ")
		title = strings.ReplaceAll(title, "\r", " ")
		if id := strings.TrimSpace(deviceID); id != "" && id != title {
			title = fmt.Sprintf("%s (%s)", title, id)
		}
		args = append(args, "--window-title", title)
	}

	// Video quality settings
	if config.Bitrate != "" {
		args = append(args, "-b", config.Bitrate)
	}
	if config.MaxSize > 0 {
		args = append(args, "-m", fmt.Sprintf("%d", config.MaxSize))
	}
	if config.MaxFPS > 0 {
		args = append(args, "--max-fps", fmt.Sprintf("%d", config.MaxFPS))
	}

	// Window settings
	if config.WindowWidth != nil {
		args = append(args, "--window-width", fmt.Sprintf("%d", *config.WindowWidth))
	}
	if config.WindowHeight != nil {
		args = append(args, "--window-height", fmt.Sprintf("%d", *config.WindowHeight))
	}
	if config.WindowX != nil {
		args = append(args, "--window-x", fmt.Sprintf("%d", *config.WindowX))
	}
	if config.WindowY != nil {
		args = append(args, "--window-y", fmt.Sprintf("%d", *config.WindowY))
	}

	// Boolean flags
	if config.StayAwake {
		args = append(args, "--stay-awake")
	}
	if config.ShowTouches {
		args = append(args, "--show-touches")
	}
	if config.Fullscreen {
		args = append(args, "--fullscreen")
	}
	if config.AlwaysOnTop {
		args = append(args, "--always-on-top")
	}
	if config.TurnScreenOff {
		args = append(args, "--turn-screen-off")
	}

	// Audio settings (default to --no-audio to preserve the device's built-in audio)
	if !config.EnableAudio {
		args = append(args, "--no-audio")
	}

	// Render driver
	if config.RenderDriver != "" {
		args = append(args, "--render-driver", config.RenderDriver)
	}

	return args
}

// monitorProcess monitors a scrcpy process and updates session status when it exits
func (m *Manager) monitorProcess(deviceID string, cmd *exec.Cmd) {
	cmd.Wait()

	m.mu.Lock()
	defer m.mu.Unlock()

	if session, exists := m.sessions[deviceID]; exists {
		session.IsRunning = false
		log.Printf("Scrcpy process ended for device %s (PID: %d)", deviceID, session.ProcessID)
	}
	if meta, exists := m.meta[deviceID]; exists {
		cleanupAfterExit(meta)
		delete(m.meta, deviceID)
	}
}

func enrichStartError(err error) error {
	if err == nil {
		return nil
	}

	// On macOS, a quarantined binary (downloaded from the internet) or a noexec mount
	// can surface as: `fork/exec ...: operation not permitted`.
	if errors.Is(err, syscall.EPERM) {
		path, _ := exec.LookPath("scrcpy")
		if path == "" {
			path = "scrcpy"
		}
		return fmt.Errorf(
			"%w (operation not permitted). On macOS, try installing via Homebrew, or remove Gatekeeper quarantine: `xattr -dr com.apple.quarantine %s` (also ensure the file is executable and not on a noexec volume)",
			err,
			path,
		)
	}

	return err
}
