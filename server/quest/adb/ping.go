package adb

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// PingManager 管理 Ping 操作
type PingManager struct {
	timeout time.Duration
}

// NewPingManager 創建新的 Ping Manager
func NewPingManager(timeout time.Duration) *PingManager {
	if timeout == 0 {
		timeout = 2 * time.Second
	}
	return &PingManager{
		timeout: timeout,
	}
}

// PingResult Ping 結果
type PingResult struct {
	IP      string
	Success bool
	Latency float64 // 毫秒
	Error   error
}

// Ping 執行單個 Ping 操作
func (p *PingManager) Ping(ip string) PingResult {
	ctx, cancel := context.WithTimeout(context.Background(), p.timeout)
	defer cancel()

	var cmd *exec.Cmd
	var timeoutMs int = int(p.timeout.Milliseconds())

	// 根據作業系統使用不同的 ping 命令
	switch runtime.GOOS {
	case "windows":
		// Windows: ping -n 1 -w 2000 <ip>
		cmd = exec.CommandContext(ctx, "ping", "-n", "1", "-w", fmt.Sprintf("%d", timeoutMs), ip)
	case "darwin":
		// macOS: ping -c 1 -W 2000 <ip>
		cmd = exec.CommandContext(ctx, "ping", "-c", "1", "-W", fmt.Sprintf("%d", timeoutMs), ip)
	default:
		// Linux: ping -c 1 -W 2 <ip>
		timeoutSec := int(p.timeout.Seconds())
		if timeoutSec < 1 {
			timeoutSec = 1
		}
		cmd = exec.CommandContext(ctx, "ping", "-c", "1", "-W", fmt.Sprintf("%d", timeoutSec), ip)
	}

	output, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return PingResult{
			IP:      ip,
			Success: false,
			Latency: 0,
			Error:   fmt.Errorf("ping timeout"),
		}
	}

	if err != nil {
		return PingResult{
			IP:      ip,
			Success: false,
			Latency: 0,
			Error:   err,
		}
	}

	// 解析延遲時間
	latency := parsePingLatency(string(output))

	return PingResult{
		IP:      ip,
		Success: latency > 0,
		Latency: latency,
		Error:   nil,
	}
}

// PingBatch 批量 Ping 多個 IP
func (p *PingManager) PingBatch(ips []string, maxWorkers int) map[string]PingResult {
	if maxWorkers < 1 {
		maxWorkers = 10
	}

	results := make(map[string]PingResult)
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxWorkers)

	for _, ip := range ips {
		wg.Add(1)
		go func(addr string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := p.Ping(addr)

			mu.Lock()
			results[addr] = result
			mu.Unlock()
		}(ip)
	}

	wg.Wait()
	return results
}

// parsePingLatency 從 ping 輸出中解析延遲時間
func parsePingLatency(output string) float64 {
	// Windows 格式: "時間=XXms" 或 "time=XXms"
	// Linux/Mac 格式: "time=XX.X ms"

	patterns := []string{
		`time[=<](\d+\.?\d*)\s*ms`,      // Linux/Mac: time=1.23 ms
		`時間[=<](\d+)ms`,                 // Windows 中文: 時間=1ms
		`Time[=<](\d+)ms`,               // Windows 英文: Time=1ms
		`average[=\s]+(\d+\.?\d*)\s*ms`, // 平均值
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(output)
		if len(matches) > 1 {
			latency, err := strconv.ParseFloat(matches[1], 64)
			if err == nil && latency > 0 {
				return latency
			}
		}
	}

	// 如果包含 "TTL=" 表示 ping 成功但無法解析延遲
	if strings.Contains(output, "TTL=") || strings.Contains(output, "ttl=") {
		return 1.0 // 返回 1ms 作為預設值
	}

	return 0
}
