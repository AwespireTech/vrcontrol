package questsocket

import (
	"fmt"
	"sync"
)

// SocketManager 管理多個 Socket Server 實例
type SocketManager struct {
	servers     map[string]*Server // roomID -> Server
	portManager *PortManager
	mu          sync.RWMutex
}

// NewSocketManager 創建新的 Socket Manager
func NewSocketManager() *SocketManager {
	return &SocketManager{
		servers:     make(map[string]*Server),
		portManager: NewPortManager(),
	}
}

// StartServer 啟動房間的 Socket Server
func (sm *SocketManager) StartServer(roomID, roomName, ip string) (int, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// 檢查是否已經存在
	if _, exists := sm.servers[roomID]; exists {
		return 0, ErrServerAlreadyExists
	}

	// 分配端口
	port, err := sm.portManager.AllocatePort()
	if err != nil {
		return 0, err
	}

	// 創建 Server
	server := NewServer(roomID, roomName, ip, port)

	// 啟動 Server
	if err := server.Start(); err != nil {
		sm.portManager.ReleasePort(port)
		return 0, fmt.Errorf("failed to start server: %w", err)
	}

	sm.servers[roomID] = server
	return port, nil
}

// StopServer 停止房間的 Socket Server
func (sm *SocketManager) StopServer(roomID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	server, exists := sm.servers[roomID]
	if !exists {
		return ErrServerNotFound
	}

	// 停止 Server
	if err := server.Stop(); err != nil {
		return err
	}

	// 釋放端口
	sm.portManager.ReleasePort(server.port)

	// 從 map 中刪除
	delete(sm.servers, roomID)

	return nil
}

// GetServer 獲取房間的 Socket Server
func (sm *SocketManager) GetServer(roomID string) (*Server, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	server, exists := sm.servers[roomID]
	return server, exists
}

// GetServerInfo 獲取房間 Server 資訊
func (sm *SocketManager) GetServerInfo(roomID string) (ServerInfo, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	server, exists := sm.servers[roomID]
	if !exists {
		return ServerInfo{}, ErrServerNotFound
	}

	return server.GetInfo(), nil
}

// GetAllServers 獲取所有 Server 資訊
func (sm *SocketManager) GetAllServers() []ServerInfo {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	infos := make([]ServerInfo, 0, len(sm.servers))
	for _, server := range sm.servers {
		infos = append(infos, server.GetInfo())
	}

	return infos
}

// StopAllServers 停止所有 Server
func (sm *SocketManager) StopAllServers() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for roomID, server := range sm.servers {
		if err := server.Stop(); err != nil {
			return fmt.Errorf("failed to stop server for room %s: %w", roomID, err)
		}
		sm.portManager.ReleasePort(server.port)
	}

	sm.servers = make(map[string]*Server)
	return nil
}

// IsRunning 檢查房間 Server 是否運行
func (sm *SocketManager) IsRunning(roomID string) bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	server, exists := sm.servers[roomID]
	if !exists {
		return false
	}

	return server.IsRunning()
}

// BroadcastToRoom 向房間廣播消息
func (sm *SocketManager) BroadcastToRoom(roomID string, msg interface{}) error {
	sm.mu.RLock()
	server, exists := sm.servers[roomID]
	sm.mu.RUnlock()

	if !exists {
		return ErrServerNotFound
	}

	return server.BroadcastMessage(msg)
}
