package scrcpy

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"vrcontrol/server/quest/model"
)

type StreamSession struct {
	DeviceID  string
	StartedAt time.Time
	reader    io.ReadCloser
	conn      net.Conn
	serverCmd *exec.Cmd
	waitCh    <-chan error
	forward   string
	serial    string
	Header    StreamHeader
}

func (s *StreamSession) Read(p []byte) (int, error) {
	return s.reader.Read(p)
}

func (s *StreamSession) Stop() {
	if s.reader != nil {
		_ = s.reader.Close()
	}
	if s.conn != nil {
		_ = s.conn.Close()
	}
	if s.serverCmd != nil && s.serverCmd.Process != nil {
		_ = s.serverCmd.Process.Kill()
	}
	if s.waitCh != nil {
		select {
		case <-s.waitCh:
		case <-time.After(500 * time.Millisecond):
		}
	}
	if s.forward != "" && s.serial != "" {
		_ = runADBCommand(s.serial, "forward", "--remove", s.forward)
	}
}

type StreamManager struct{}

func NewStreamManager() *StreamManager {
	return &StreamManager{}
}

type StreamHeader struct {
	Type    string `json:"type"`
	Codec   string `json:"codec"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
	FPS     int    `json:"fps"`
	Bitrate string `json:"bitrate"`
}

func (m *StreamManager) StartStream(deviceSerial, deviceID string, config *model.ScrcpyConfig) (*StreamSession, error) {
	if _, err := exec.LookPath("adb"); err != nil {
		return nil, fmt.Errorf("adb not found in PATH")
	}
	log.Printf("[Stream] start standalone stream device=%s serial=%s", deviceID, deviceSerial)

	serverArtifact, version, err := findScrcpyServerArtifact()
	if err != nil {
		return nil, err
	}
	log.Printf("[Stream] using scrcpy server artifact=%s version=%s", serverArtifact, version)

	deviceServerPath := "/data/local/tmp/scrcpy-server-manual.jar"
	if err := runADBCommand(deviceSerial, "push", serverArtifact, deviceServerPath); err != nil {
		return nil, fmt.Errorf("push scrcpy server: %w", err)
	}
	log.Printf("[Stream] pushed scrcpy server to %s", deviceServerPath)

	tcpPort, err := reserveTCPPort()
	if err != nil {
		return nil, fmt.Errorf("reserve local tcp port: %w", err)
	}

	forward := fmt.Sprintf("tcp:%d", tcpPort)
	if err := runADBCommand(deviceSerial, "forward", forward, "localabstract:scrcpy"); err != nil {
		return nil, fmt.Errorf("adb forward: %w", err)
	}
	log.Printf("[Stream] adb forward created %s -> localabstract:scrcpy", forward)

	serverArgs := buildStandaloneServerArgs(deviceSerial, deviceServerPath, version, config)

	log.Printf("[Stream] starting scrcpy standalone server with args: %s", strings.Join(serverArgs, " "))

	serverCmd := exec.Command("adb", serverArgs...)

	stderrTail := newTailBuffer(16 * 1024)
	serverCmd.Stdout = io.Discard
	serverCmd.Stderr = stderrTail
	if err := serverCmd.Start(); err != nil {
		_ = runADBCommand(deviceSerial, "forward", "--remove", forward)
		return nil, fmt.Errorf("start scrcpy standalone server: %w", err)
	}
	log.Printf("[Stream] scrcpy standalone server started pid=%d", serverCmd.Process.Pid)

	waitCh := make(chan error, 1)
	go func() {
		waitErr := serverCmd.Wait()
		if waitErr != nil {
			log.Printf("[Stream] scrcpy standalone server exited with error: %v", waitErr)
		} else {
			log.Printf("[Stream] scrcpy standalone server exited")
		}
		waitCh <- waitErr
		close(waitCh)
	}()

	time.Sleep(1 * time.Second)

	conn, err := waitForTCPConnection(tcpPort, 5*time.Second)
	if err != nil {
		if serverCmd.Process != nil {
			_ = serverCmd.Process.Kill()
		}
		_ = runADBCommand(deviceSerial, "forward", "--remove", forward)
		return nil, fmt.Errorf("connect stream socket: %w", err)
	}
	log.Printf("[Stream] connected stream socket on %s", forward)

	probeBytes, err := probeStreamData(conn, 10*time.Second, waitCh, stderrTail)
	if err != nil {
		_ = conn.Close()
		if serverCmd.Process != nil {
			_ = serverCmd.Process.Kill()
		}
		select {
		case <-waitCh:
		case <-time.After(500 * time.Millisecond):
		}
		_ = runADBCommand(deviceSerial, "forward", "--remove", forward)
		return nil, err
	}
	log.Printf("[Stream] source probe received %d bytes", len(probeBytes))

	streamReader := io.NopCloser(io.MultiReader(bytes.NewReader(probeBytes), conn))

	header := buildStreamHeader(config)

	session := &StreamSession{
		DeviceID:  deviceID,
		StartedAt: time.Now(),
		reader:    streamReader,
		conn:      conn,
		serverCmd: serverCmd,
		waitCh:    waitCh,
		forward:   forward,
		serial:    deviceSerial,
		Header:    header,
	}

	return session, nil
}

func buildStandaloneServerArgs(deviceSerial, deviceServerPath, version string, config *model.ScrcpyConfig) []string {
	args := []string{
		"-s", deviceSerial,
		"shell",
		"CLASSPATH=" + deviceServerPath,
		"app_process",
		"/",
		"com.genymobile.scrcpy.Server",
		version,
		"tunnel_forward=true",
		"audio=false",
		"control=false",
		"cleanup=false",
		"raw_stream=true",
	}

	log.Printf("[Stream] building scrcpy server args with config: %+v", config)

	if config != nil {
		if config.Bitrate != "" {
			args = append(args, "video_bit_rate="+strconv.Itoa(parseBitrate(config.Bitrate)))
		}
		if config.MaxSize > 0 {
			args = append(args, "max_size="+strconv.Itoa(config.MaxSize))
		}
		if config.MaxFPS > 0 {
			args = append(args, "max_fps="+strconv.Itoa(config.MaxFPS))
		}
	}

	return args
}

func parseBitrate(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	unit := 1
	switch {
	case strings.HasSuffix(s, "k"), strings.HasSuffix(s, "K"):
		unit = 1000
		s = s[:len(s)-1]
	case strings.HasSuffix(s, "m"), strings.HasSuffix(s, "M"):
		unit = 1000 * 1000
		s = s[:len(s)-1]
	}
	value, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return value * unit
}

func buildStreamHeader(config *model.ScrcpyConfig) StreamHeader {
	header := StreamHeader{
		Type:  "header",
		Codec: "avc1.42E01E",
	}

	if config == nil {
		return header
	}

	header.FPS = config.MaxFPS
	header.Bitrate = config.Bitrate
	if config.MaxSize > 0 {
		header.Width = config.MaxSize
		header.Height = config.MaxSize
	}

	return header
}

func runADBCommand(serial string, args ...string) error {
	adbArgs := append([]string{"-s", serial}, args...)
	cmd := exec.Command("adb", adbArgs...)
	if output, err := cmd.CombinedOutput(); err != nil {
		msg := strings.TrimSpace(string(output))
		if msg != "" {
			return fmt.Errorf("%w: %s", err, msg)
		}
		return err
	}
	return nil
}

func reserveTCPPort() (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer listener.Close()

	addr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		return 0, errors.New("unexpected listener address type")
	}
	return addr.Port, nil
}

func waitForTCPConnection(port int, timeout time.Duration) (net.Conn, error) {
	deadline := time.Now().Add(timeout)
	address := fmt.Sprintf("127.0.0.1:%d", port)
	for {
		conn, err := net.DialTimeout("tcp", address, 300*time.Millisecond)
		if err == nil {
			return conn, nil
		}
		if time.Now().After(deadline) {
			return nil, err
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func probeStreamData(conn net.Conn, timeout time.Duration, waitCh <-chan error, stderrTail *tailBuffer) ([]byte, error) {
	deadline := time.Now().Add(timeout)
	buf := make([]byte, 4096)
	prebuffer := make([]byte, 0, 4096)
	expectingDummyByte := false

	for {
		if time.Now().After(deadline) {
			if expectingDummyByte {
				return nil, classifyProbeFailure("source_backend_not_ready", stderrTail)
			}
			return nil, classifyProbeFailure("source_connected_but_no_data", stderrTail)
		}

		if exitErr, exited := pollServerExit(waitCh); exited {
			return nil, classifyProbeFailure(serverExitErrorCode(exitErr), stderrTail)
		}

		_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		n, err := conn.Read(buf)
		_ = conn.SetReadDeadline(time.Time{})

		if n > 0 {
			chunk := buf[:n]
			if expectingDummyByte {
				dummy := chunk[0]
				expectingDummyByte = false
				if dummy != 0 {
					return nil, classifyProbeFailure(fmt.Sprintf("source_dummy_byte_error_%d", dummy), stderrTail)
				}
				chunk = chunk[1:]
			}
			if len(chunk) > 0 {
				prebuffer = append(prebuffer, chunk...)
				return prebuffer, nil
			}
		}

		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			if err == io.EOF {
				if exitErr, exited := pollServerExit(waitCh); exited {
					return nil, classifyProbeFailure(serverExitErrorCode(exitErr), stderrTail)
				}
				return nil, classifyProbeFailure("source_probe_eof", stderrTail)
			}
			return nil, classifyProbeFailure("source_probe_failed", stderrTail)
		}
	}
}

func pollServerExit(waitCh <-chan error) (error, bool) {
	if waitCh == nil {
		return nil, false
	}
	select {
	case err, ok := <-waitCh:
		if !ok {
			return nil, true
		}
		return err, true
	default:
		return nil, false
	}
}

func serverExitErrorCode(waitErr error) string {
	if waitErr == nil {
		return "source_server_exited"
	}
	return "source_server_exited_with_error"
}

func classifyProbeFailure(code string, stderrTail *tailBuffer) error {
	tail := ""
	if stderrTail != nil {
		tail = strings.TrimSpace(stderrTail.String())
	}
	if tail == "" {
		return errors.New(code)
	}
	return fmt.Errorf("%s: %s", code, tail)
}

type tailBuffer struct {
	mu      sync.Mutex
	buffer  []byte
	maxSize int
}

func newTailBuffer(maxSize int) *tailBuffer {
	if maxSize <= 0 {
		maxSize = 4096
	}
	return &tailBuffer{maxSize: maxSize}
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buffer = append(t.buffer, p...)
	if len(t.buffer) > t.maxSize {
		t.buffer = append([]byte(nil), t.buffer[len(t.buffer)-t.maxSize:]...)
	}
	return len(p), nil
}

func (t *tailBuffer) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(t.buffer)
}

func findScrcpyServerArtifact() (string, string, error) {
	searchRoots := []string{
		filepath.Join("vendor", "scrcpy"),
		filepath.Join("..", "vendor", "scrcpy"),
		filepath.Join("..", "..", "vendor", "scrcpy"),
	}

	for _, root := range searchRoots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			if after, ok := strings.CutPrefix(name, "scrcpy-server-v"); ok {
				version := after
				version = strings.TrimSuffix(version, ".jar")
				return filepath.Join(root, name), version, nil
			}
		}
	}

	return "", "", fmt.Errorf("scrcpy standalone server not found in vendor/scrcpy")
}
