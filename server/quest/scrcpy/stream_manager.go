package scrcpy

import (
	"fmt"
	"io"
	"os/exec"
	"time"

	"vrcontrol/server/quest/model"
)

type StreamSession struct {
	DeviceID  string
	StartedAt time.Time
	reader    io.ReadCloser
	scrcpyCmd *exec.Cmd
	Header    StreamHeader
}

func (s *StreamSession) Read(p []byte) (int, error) {
	return s.reader.Read(p)
}

func (s *StreamSession) Stop() {
	if s.scrcpyCmd != nil && s.scrcpyCmd.Process != nil {
		_ = s.scrcpyCmd.Process.Kill()
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

	adbArgs := buildStreamAdbArgs(deviceSerial, config)
	scrcpyCmd := exec.Command("adb", adbArgs...)
	scrcpyStdout, err := scrcpyCmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("adb stdout pipe: %w", err)
	}
	if err := scrcpyCmd.Start(); err != nil {
		return nil, fmt.Errorf("start adb exec-out: %w", err)
	}

	header := buildStreamHeader(config)

	session := &StreamSession{
		DeviceID:  deviceID,
		StartedAt: time.Now(),
		reader:    scrcpyStdout,
		scrcpyCmd: scrcpyCmd,
		Header:    header,
	}

	go scrcpyCmd.Wait()

	return session, nil
}

func buildStreamAdbArgs(deviceSerial string, config *model.ScrcpyConfig) []string {
	args := []string{"-s", deviceSerial, "exec-out", "screenrecord", "--output-format=h264"}

	if config == nil {
		return append(args, "-")
	}

	if config.Bitrate != "" {
		if bitrateArg, ok := toScreenrecordBitrate(config.Bitrate); ok {
			args = append(args, "--bit-rate", bitrateArg)
		}
	}
	if config.MaxSize > 0 {
		args = append(args, "--size", fmt.Sprintf("%dx%d", config.MaxSize, config.MaxSize))
	}

	return append(args, "-")
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

func toScreenrecordBitrate(bitrate string) (string, bool) {
	if bitrate == "" {
		return "", false
	}

	var value int
	if _, err := fmt.Sscanf(bitrate, "%dM", &value); err == nil {
		return fmt.Sprintf("%d", value*1000000), true
	}
	if _, err := fmt.Sscanf(bitrate, "%dK", &value); err == nil {
		return fmt.Sprintf("%d", value*1000), true
	}
	if _, err := fmt.Sscanf(bitrate, "%d", &value); err == nil {
		return fmt.Sprintf("%d", value), true
	}

	return "", false
}
