package adb

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ADBManager 管理 ADB 命令執行
type ADBManager struct {
	adbPath string
	timeout time.Duration
	mu      sync.Mutex
}

// NewADBManager 創建新的 ADB Manager
func NewADBManager(adbPath string, timeout time.Duration) *ADBManager {
	if adbPath == "" {
		adbPath = "adb" // 使用系統 PATH 中的 adb
	}
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	return &ADBManager{
		adbPath: adbPath,
		timeout: timeout,
	}
}

// ExecuteCommand 執行 ADB 命令
func (m *ADBManager) ExecuteCommand(args []string, timeout time.Duration) (string, error) {
	if timeout == 0 {
		timeout = m.timeout
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, m.adbPath, args...)
	output, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("command timeout after %v", timeout)
	}

	return string(output), err
}

// Connect 連接到設備
func (m *ADBManager) Connect(ip string, port int) error {
	target := fmt.Sprintf("%s:%d", ip, port)
	output, err := m.ExecuteCommand([]string{"connect", target}, 10*time.Second)

	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", target, err)
	}

	// 檢查輸出是否包含成功訊息
	if strings.Contains(output, "connected") || strings.Contains(output, "already connected") {
		return nil
	}

	return fmt.Errorf("connection failed: %s", strings.TrimSpace(output))
}

// Disconnect 斷開設備連接
func (m *ADBManager) Disconnect(ip string, port int) error {
	target := fmt.Sprintf("%s:%d", ip, port)
	_, err := m.ExecuteCommand([]string{"disconnect", target}, 5*time.Second)
	return err
}

// GetDevices 獲取所有連接的設備
func (m *ADBManager) GetDevices() ([]Device, error) {
	output, err := m.ExecuteCommand([]string{"devices", "-l"}, 5*time.Second)
	if err != nil {
		return nil, err
	}

	return parseDeviceList(output), nil
}

// GetDeviceInfo 獲取設備基本資訊
func (m *ADBManager) GetDeviceInfo(serial string) (*DeviceInfo, error) {
	var wg sync.WaitGroup
	var info DeviceInfo
	var errors []error

	// 並發獲取設備資訊
	wg.Add(3)

	// 獲取型號
	go func() {
		defer wg.Done()
		output, err := m.ExecuteShellCommand(serial, "getprop ro.product.model", 5*time.Second)
		if err == nil {
			info.Model = strings.TrimSpace(output)
		} else {
			errors = append(errors, err)
		}
	}()

	// 獲取 Android 版本
	go func() {
		defer wg.Done()
		output, err := m.ExecuteShellCommand(serial, "getprop ro.build.version.release", 5*time.Second)
		if err == nil {
			info.AndroidVersion = strings.TrimSpace(output)
		} else {
			errors = append(errors, err)
		}
	}()

	// 獲取設備名稱
	go func() {
		defer wg.Done()
		output, err := m.ExecuteShellCommand(serial, "getprop ro.product.name", 5*time.Second)
		if err == nil {
			info.Name = strings.TrimSpace(output)
		} else {
			errors = append(errors, err)
		}
	}()

	wg.Wait()

	if len(errors) > 0 {
		return &info, fmt.Errorf("some device info queries failed")
	}

	return &info, nil
}

// GetDeviceStatus 獲取設備狀態（電池、溫度等）
func (m *ADBManager) GetDeviceStatus(serial string) (*DeviceStatus, error) {
	output, err := m.ExecuteShellCommand(serial, "dumpsys battery", 10*time.Second)
	if err != nil {
		return nil, err
	}

	status := parseDeviceStatus(output)
	return status, nil
}

// ExecuteShellCommand 執行 Shell 命令
func (m *ADBManager) ExecuteShellCommand(serial, cmd string, timeout time.Duration) (string, error) {
	args := []string{"-s", serial, "shell", cmd}
	return m.ExecuteCommand(args, timeout)
}

// WakeDevice 喚醒設備
func (m *ADBManager) WakeDevice(serial string) error {
	// 檢查螢幕狀態
	output, err := m.ExecuteShellCommand(serial, "dumpsys power | grep 'mWakefulness='", 5*time.Second)
	if err != nil {
		return err
	}

	// 如果已經喚醒，直接返回
	if strings.Contains(output, "Awake") {
		return nil
	}

	// 按下電源鍵
	_, err = m.ExecuteShellCommand(serial, "input keyevent KEYCODE_WAKEUP", 5*time.Second)
	return err
}

// SleepDevice 休眠設備
func (m *ADBManager) SleepDevice(serial string, force bool) error {
	if force {
		// 強制休眠
		_, err := m.ExecuteShellCommand(serial, "input keyevent KEYCODE_SLEEP", 5*time.Second)
		return err
	}

	// 檢查螢幕狀態
	output, err := m.ExecuteShellCommand(serial, "dumpsys power | grep 'mWakefulness='", 5*time.Second)
	if err != nil {
		return err
	}

	// 如果已經休眠，直接返回
	if strings.Contains(output, "Asleep") || strings.Contains(output, "Dozing") {
		return nil
	}

	// 按下電源鍵
	_, err = m.ExecuteShellCommand(serial, "input keyevent KEYCODE_SLEEP", 5*time.Second)
	return err
}

// LaunchApp 啟動應用
func (m *ADBManager) LaunchApp(serial, packageName, activity string, extras map[string]interface{}) error {
	args := []string{"-s", serial, "shell", "am", "start"}

	if activity != "" {
		args = append(args, "-n", packageName+"/"+activity)
	} else {
		// 啟動 Main Activity
		args = append(args, packageName)
	}

	// 添加 Intent Extras
	for key, value := range extras {
		switch v := value.(type) {
		case int:
			args = append(args, "--ei", key, fmt.Sprintf("%d", v))
		case int64:
			args = append(args, "--el", key, fmt.Sprintf("%d", v))
		case bool:
			args = append(args, "--ez", key, fmt.Sprintf("%t", v))
		case float64:
			args = append(args, "--ef", key, fmt.Sprintf("%f", v))
		case string:
			args = append(args, "--es", key, v)
		}
	}

	_, err := m.ExecuteCommand(args, 10*time.Second)
	return err
}

// StopApp 停止應用
func (m *ADBManager) StopApp(serial, packageName string, method string) error {
	if method == "" {
		method = "force-stop"
	}

	var cmd string
	switch method {
	case "force-stop":
		cmd = fmt.Sprintf("am force-stop %s", packageName)
	case "kill":
		cmd = fmt.Sprintf("am kill %s", packageName)
	default:
		return fmt.Errorf("invalid stop method: %s", method)
	}

	_, err := m.ExecuteShellCommand(serial, cmd, 5*time.Second)
	return err
}

// InstallAPK 安裝 APK
func (m *ADBManager) InstallAPK(serial, apkPath string, replace, grantPermissions bool) error {
	args := []string{"-s", serial, "install"}

	if replace {
		args = append(args, "-r")
	}
	if grantPermissions {
		args = append(args, "-g")
	}

	args = append(args, apkPath)

	output, err := m.ExecuteCommand(args, 60*time.Second)
	if err != nil {
		return err
	}

	if strings.Contains(output, "Success") {
		return nil
	}

	return fmt.Errorf("installation failed: %s", strings.TrimSpace(output))
}

// SendKey 發送按鍵
func (m *ADBManager) SendKey(serial string, keycode int, repeat int) error {
	if repeat < 1 {
		repeat = 1
	}

	for i := 0; i < repeat; i++ {
		cmd := fmt.Sprintf("input keyevent %d", keycode)
		_, err := m.ExecuteShellCommand(serial, cmd, 3*time.Second)
		if err != nil {
			return err
		}
		if repeat > 1 && i < repeat-1 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	return nil
}

// ConnectBatch 批量連接設備
func (m *ADBManager) ConnectBatch(targets []string, maxWorkers int) []ConnectResult {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	results := make([]ConnectResult, len(targets))
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxWorkers)

	for i, target := range targets {
		wg.Add(1)
		go func(index int, t string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			parts := strings.Split(t, ":")
			ip := parts[0]
			port := 5555
			if len(parts) > 1 {
				fmt.Sscanf(parts[1], "%d", &port)
			}

			err := m.Connect(ip, port)
			results[index] = ConnectResult{
				Target:  t,
				Success: err == nil,
				Error:   err,
			}
		}(i, target)
	}

	wg.Wait()
	return results
}

// Device 設備資訊
type Device struct {
	Serial         string `json:"serial"`
	State          string `json:"state"`
	Model          string `json:"model"`
	IP             string `json:"ip,omitempty"`
	ConnectionType string `json:"connection_type"`
	TCPIPEnabled   bool   `json:"tcpip_enabled"`
	TCPIPPort      *int   `json:"tcpip_port,omitempty"`
}

// DeviceInfo 設備詳細資訊
type DeviceInfo struct {
	Model          string
	AndroidVersion string
	Name           string
}

// DeviceStatus 設備狀態
type DeviceStatus struct {
	Battery     int
	Temperature float64
	IsCharging  bool
	Status      string
	Health      string
}

// ConnectResult 連接結果
type ConnectResult struct {
	Target  string
	Success bool
	Error   error
}

// TCPIPStatus 表示裝置目前的 adb tcpip 模式狀態。
type TCPIPStatus struct {
	Enabled bool
	Port    *int
}

// ResolveConnectedDevice finds a connected ADB device by exact serial/target.
// This is used to keep per-device connection mapping deterministic (e.g. ip:port).
func (m *ADBManager) ResolveConnectedDevice(target string, retries int, retryDelay time.Duration) (*Device, error) {
	if strings.TrimSpace(target) == "" {
		return nil, fmt.Errorf("target is required")
	}

	if retries < 1 {
		retries = 1
	}

	if retryDelay <= 0 {
		retryDelay = 200 * time.Millisecond
	}

	for attempt := 1; attempt <= retries; attempt++ {
		devices, err := m.GetDevices()
		if err != nil {
			if attempt == retries {
				return nil, err
			}
			time.Sleep(retryDelay)
			continue
		}

		for _, d := range devices {
			if d.Serial == target && d.State == "device" {
				device := d
				return &device, nil
			}
		}

		if attempt < retries {
			time.Sleep(retryDelay)
		}
	}

	return nil, fmt.Errorf("device %s not found in adb device list", target)
}

// GetUSBDevices returns currently connected USB devices and enriches them with tcpip status.
func (m *ADBManager) GetUSBDevices() ([]Device, error) {
	devices, err := m.GetDevices()
	if err != nil {
		return nil, err
	}

	usbDevices := make([]Device, 0)
	for _, device := range devices {
		if device.State != "device" || device.ConnectionType != "usb" {
			continue
		}

		status, statusErr := m.GetTCPIPStatus(device.Serial)
		if statusErr == nil {
			device.TCPIPEnabled = status.Enabled
			device.TCPIPPort = status.Port
		}

		deviceIP, ipErr := m.GetDeviceIP(device.Serial)
		if ipErr == nil {
			device.IP = deviceIP
		}

		usbDevices = append(usbDevices, device)
	}

	return usbDevices, nil
}

// GetDeviceIP tries to read the current IPv4 address from the device network stack.
func (m *ADBManager) GetDeviceIP(serial string) (string, error) {
	commands := []string{
		"ip -f inet addr show wlan0",
		"ip route",
	}

	for _, command := range commands {
		output, err := m.ExecuteShellCommand(serial, command, 5*time.Second)
		if err != nil {
			continue
		}

		if ip := parseDeviceIPv4(output); ip != "" {
			return ip, nil
		}
	}

	return "", fmt.Errorf("device ip not found")
}

// GetTCPIPStatus reads adb tcpip state from the device property service.adb.tcp.port.
func (m *ADBManager) GetTCPIPStatus(serial string) (*TCPIPStatus, error) {
	output, err := m.ExecuteShellCommand(serial, "getprop service.adb.tcp.port", 5*time.Second)
	if err != nil {
		return nil, err
	}

	value := strings.TrimSpace(output)
	if value == "" || value == "0" || value == "-1" {
		return &TCPIPStatus{Enabled: false}, nil
	}

	port, convErr := strconv.Atoi(value)
	if convErr != nil {
		return nil, fmt.Errorf("invalid tcpip port value %q", value)
	}

	return &TCPIPStatus{
		Enabled: port > 0,
		Port:    &port,
	}, nil
}

// EnableTCPIP switches the target device into adb tcpip mode on the given port.
func (m *ADBManager) EnableTCPIP(serial string, port int) error {
	if strings.TrimSpace(serial) == "" {
		return fmt.Errorf("serial is required")
	}
	if port < 1 || port > 65535 {
		return fmt.Errorf("invalid tcpip port: %d", port)
	}

	output, err := m.ExecuteCommand([]string{"-s", serial, "tcpip", strconv.Itoa(port)}, 10*time.Second)
	if err != nil {
		return fmt.Errorf("failed to enable tcpip on %s: %w", serial, err)
	}

	trimmed := strings.TrimSpace(output)
	if strings.Contains(trimmed, "restarting in TCP mode") || strings.Contains(trimmed, "already in TCP mode") {
		return nil
	}

	return fmt.Errorf("failed to enable tcpip on %s: %s", serial, trimmed)
}

// parseDeviceList 解析設備列表
func parseDeviceList(output string) []Device {
	var devices []Device
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "List of devices") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			device := Device{
				Serial:         parts[0],
				State:          parts[1],
				ConnectionType: detectConnectionType(parts[0], line),
			}

			// 解析 model
			if strings.Contains(line, "model:") {
				re := regexp.MustCompile(`model:(\S+)`)
				matches := re.FindStringSubmatch(line)
				if len(matches) > 1 {
					device.Model = matches[1]
				}
			}

			devices = append(devices, device)
		}
	}

	return devices
}

func detectConnectionType(serial, line string) string {
	if isNetworkSerial(serial) {
		return "network"
	}

	return "usb"
}

func isNetworkSerial(serial string) bool {
	index := strings.LastIndex(serial, ":")
	if index <= 0 || index >= len(serial)-1 {
		return false
	}

	port, err := strconv.Atoi(serial[index+1:])
	if err != nil || port < 1 || port > 65535 {
		return false
	}

	host := serial[:index]
	return host != ""
}

func parseDeviceIPv4(output string) string {
	inetPattern := regexp.MustCompile(`inet\s+(\d+\.\d+\.\d+\.\d+)`)
	if matches := inetPattern.FindStringSubmatch(output); len(matches) > 1 {
		return matches[1]
	}

	srcPattern := regexp.MustCompile(`src\s+(\d+\.\d+\.\d+\.\d+)`)
	if matches := srcPattern.FindStringSubmatch(output); len(matches) > 1 {
		return matches[1]
	}

	return ""
}

// parseDeviceStatus 解析設備狀態
func parseDeviceStatus(output string) *DeviceStatus {
	status := &DeviceStatus{}
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "level:") {
			fmt.Sscanf(line, "level: %d", &status.Battery)
		} else if strings.HasPrefix(line, "temperature:") {
			var temp int
			fmt.Sscanf(line, "temperature: %d", &temp)
			status.Temperature = float64(temp) / 10.0
		} else if strings.HasPrefix(line, "status:") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				status.Status = strings.TrimSpace(parts[1])
				status.IsCharging = status.Status == "2" || status.Status == "Charging"
			}
		} else if strings.HasPrefix(line, "health:") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				status.Health = strings.TrimSpace(parts[1])
			}
		}
	}

	return status
}
