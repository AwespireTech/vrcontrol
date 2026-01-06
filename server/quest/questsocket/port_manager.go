package questsocket

import (
	"net"
	"sync"
)

const (
	MinPort = 3000
	MaxPort = 3100
)

// PortManager 管理端口分配
type PortManager struct {
	allocatedPorts map[int]bool
	mu             sync.RWMutex
}

// NewPortManager 創建新的端口管理器
func NewPortManager() *PortManager {
	return &PortManager{
		allocatedPorts: make(map[int]bool),
	}
}

// AllocatePort 分配一個可用端口
func (pm *PortManager) AllocatePort() (int, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	for port := MinPort; port <= MaxPort; port++ {
		if pm.allocatedPorts[port] {
			continue
		}

		// 測試端口是否可用
		if pm.isPortAvailable(port) {
			pm.allocatedPorts[port] = true
			return port, nil
		}
	}

	return 0, ErrNoPortAvailable
}

// ReleasePort 釋放端口
func (pm *PortManager) ReleasePort(port int) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	delete(pm.allocatedPorts, port)
}

// IsAllocated 檢查端口是否已分配
func (pm *PortManager) IsAllocated(port int) bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.allocatedPorts[port]
}

// GetAllocatedPorts 獲取所有已分配的端口
func (pm *PortManager) GetAllocatedPorts() []int {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	ports := make([]int, 0, len(pm.allocatedPorts))
	for port := range pm.allocatedPorts {
		ports = append(ports, port)
	}
	return ports
}

// isPortAvailable 測試端口是否可用
func (pm *PortManager) isPortAvailable(port int) bool {
	addr := net.JoinHostPort("", string(rune(port)))
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return false
	}
	listener.Close()
	return true
}
