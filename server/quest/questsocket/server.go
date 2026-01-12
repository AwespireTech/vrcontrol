package questsocket

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"
	"time"
)

// Server TCP Socket Server
type Server struct {
	roomID     string
	roomName   string
	ip         string
	port       int
	listener   net.Listener
	clients    map[net.Conn]*ClientInfo
	clientsMu  sync.RWMutex
	broadcast  chan []byte
	register   chan *ClientInfo
	unregister chan net.Conn
	shutdown   chan struct{}
	wg         sync.WaitGroup
	running    bool
	mu         sync.RWMutex
}

// ClientInfo 客戶端資訊
type ClientInfo struct {
	Conn        net.Conn
	DeviceID    string
	Address     string
	IsServer    bool
	ConnectedAt time.Time
}

// Message 消息結構
type Message struct {
	Type     string      `json:"type"`
	DeviceID string      `json:"device_id,omitempty"`
	Data     interface{} `json:"data,omitempty"`
}

// NewServer 創建新的 Socket Server
func NewServer(roomID, roomName, ip string, port int) *Server {
	return &Server{
		roomID:     roomID,
		roomName:   roomName,
		ip:         ip,
		port:       port,
		clients:    make(map[net.Conn]*ClientInfo),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *ClientInfo),
		unregister: make(chan net.Conn),
		shutdown:   make(chan struct{}),
	}
}

// Start 啟動 Socket Server
func (s *Server) Start() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("server already running")
	}
	s.mu.Unlock()

	addr := fmt.Sprintf("%s:%d", s.ip, s.port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}

	s.listener = listener
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()

	log.Printf("[QuestSocket] Server started for room %s (%s) on %s", s.roomName, s.roomID, addr)

	// 啟動消息處理 goroutine
	s.wg.Add(1)
	go s.handleMessages()

	// 啟動接受連接 goroutine
	s.wg.Add(1)
	go s.acceptConnections()

	return nil
}

// Stop 停止 Socket Server
func (s *Server) Stop() error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return fmt.Errorf("server not running")
	}
	s.running = false
	s.mu.Unlock()

	log.Printf("[QuestSocket] Stopping server for room %s", s.roomName)

	// 關閉 listener
	if s.listener != nil {
		s.listener.Close()
	}

	// 發送關閉信號
	close(s.shutdown)

	// 關閉所有客戶端連接
	s.clientsMu.Lock()
	for conn := range s.clients {
		conn.Close()
	}
	s.clientsMu.Unlock()

	// 等待所有 goroutine 結束
	s.wg.Wait()

	log.Printf("[QuestSocket] Server stopped for room %s", s.roomName)
	return nil
}

// IsRunning 檢查服務器是否正在運行
func (s *Server) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// GetInfo 獲取服務器資訊
func (s *Server) GetInfo() ServerInfo {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()

	clients := make([]ClientSummary, 0, len(s.clients))
	for _, client := range s.clients {
		clients = append(clients, ClientSummary{
			DeviceID:    client.DeviceID,
			Address:     client.Address,
			IsServer:    client.IsServer,
			ConnectedAt: client.ConnectedAt,
		})
	}

	return ServerInfo{
		RoomID:      s.roomID,
		RoomName:    s.roomName,
		IP:          s.ip,
		Port:        s.port,
		Running:     s.IsRunning(),
		ClientCount: len(s.clients),
		Clients:     clients,
	}
}

// BroadcastMessage 廣播消息給所有客戶端
func (s *Server) BroadcastMessage(msg interface{}) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	data = append(data, '\n')
	s.broadcast <- data
	return nil
}

// acceptConnections 接受新連接
func (s *Server) acceptConnections() {
	defer s.wg.Done()

	for {
		select {
		case <-s.shutdown:
			return
		default:
			conn, err := s.listener.Accept()
			if err != nil {
				select {
				case <-s.shutdown:
					return
				default:
					log.Printf("[QuestSocket] Accept error: %v", err)
					continue
				}
			}

			clientInfo := &ClientInfo{
				Conn:        conn,
				Address:     conn.RemoteAddr().String(),
				ConnectedAt: time.Now(),
			}

			s.register <- clientInfo

			// 為每個客戶端啟動處理 goroutine
			s.wg.Add(1)
			go s.handleClient(clientInfo)
		}
	}
}

// handleClient 處理單個客戶端連接
func (s *Server) handleClient(client *ClientInfo) {
	defer s.wg.Done()
	defer func() {
		s.unregister <- client.Conn
		client.Conn.Close()
	}()

	log.Printf("[QuestSocket] New client connected: %s", client.Address)

	// 發送歡迎消息
	welcomeMsg := Message{
		Type: "welcome",
		Data: map[string]interface{}{
			"room_id":   s.roomID,
			"room_name": s.roomName,
			"message":   fmt.Sprintf("歡迎連接到房間 %s 的 Socket Server", s.roomName),
		},
	}
	s.sendMessage(client.Conn, welcomeMsg)

	// 讀取消息
	reader := bufio.NewReader(client.Conn)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			log.Printf("[QuestSocket] Client %s disconnected: %v", client.Address, err)
			return
		}

		var msg Message
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			log.Printf("[QuestSocket] Invalid message from %s: %v", client.Address, err)
			s.sendError(client.Conn, "Invalid JSON format")
			continue
		}

		s.handleMessage(client, msg)
	}
}

// handleMessage 處理接收到的消息
func (s *Server) handleMessage(client *ClientInfo, msg Message) {
	log.Printf("[QuestSocket] Message from %s: type=%s", client.DeviceID, msg.Type)

	switch msg.Type {
	case "login":
		s.handleLogin(client, msg)
	case "ping":
		s.handlePing(client)
	case "who":
		s.handleWho(client)
	case "echo":
		s.handleEcho(client, msg)
	case "send_params":
		s.handleSendParams(client, msg)
	case "broadcast":
		s.handleBroadcast(client, msg)
	case "command":
		s.handleCommand(client, msg)
	default:
		s.sendError(client.Conn, fmt.Sprintf("Unknown message type: %s", msg.Type))
	}
}

// handleLogin 處理登錄
func (s *Server) handleLogin(client *ClientInfo, msg Message) {
	deviceID := msg.DeviceID
	if deviceID == "" {
		s.sendError(client.Conn, "Login failed: missing device_id")
		return
	}

	client.DeviceID = deviceID
	client.IsServer = (deviceID == "Server")

	log.Printf("[QuestSocket] Client login: %s (%s)", deviceID, client.Address)

	response := Message{
		Type: "login_response",
		Data: map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("登錄成功: %s", deviceID),
		},
	}
	s.sendMessage(client.Conn, response)
}

// handlePing 處理心跳
func (s *Server) handlePing(client *ClientInfo) {
	response := Message{
		Type: "pong",
		Data: map[string]interface{}{
			"timestamp": time.Now().UnixMilli(),
		},
	}
	s.sendMessage(client.Conn, response)
}

// handleWho 處理查詢在線客戶端
func (s *Server) handleWho(client *ClientInfo) {
	s.clientsMu.RLock()
	clients := make([]map[string]interface{}, 0, len(s.clients))
	for _, c := range s.clients {
		clients = append(clients, map[string]interface{}{
			"device_id":    c.DeviceID,
			"address":      c.Address,
			"is_server":    c.IsServer,
			"connected_at": c.ConnectedAt.Unix(),
		})
	}
	s.clientsMu.RUnlock()

	response := Message{
		Type: "who_response",
		Data: map[string]interface{}{
			"count":     len(clients),
			"clients":   clients,
			"timestamp": time.Now().UnixMilli(),
		},
	}
	s.sendMessage(client.Conn, response)
}

// handleEcho 處理回顯
func (s *Server) handleEcho(client *ClientInfo, msg Message) {
	response := Message{
		Type: "echo",
		Data: map[string]interface{}{
			"data":      msg.Data,
			"timestamp": time.Now().UnixMilli(),
		},
	}
	s.sendMessage(client.Conn, response)
}

// handleSendParams 處理參數廣播
func (s *Server) handleSendParams(client *ClientInfo, msg Message) {
	log.Printf("[QuestSocket] Broadcasting params from %s", client.DeviceID)

	broadcastMsg := Message{
		Type: "params_update",
		Data: map[string]interface{}{
			"from":      client.DeviceID,
			"data":      msg.Data,
			"timestamp": time.Now().UnixMilli(),
		},
	}

	// 廣播給所有客戶端（包括發送者）
	s.BroadcastMessage(broadcastMsg)

	// 回復確認
	response := Message{
		Type: "command_response",
		Data: map[string]interface{}{
			"message":   "參數已廣播",
			"timestamp": time.Now().UnixMilli(),
		},
	}
	s.sendMessage(client.Conn, response)
}

// handleBroadcast 處理通用廣播
func (s *Server) handleBroadcast(client *ClientInfo, msg Message) {
	// 廣播給除發送者外的所有客戶端
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()

	data, _ := json.Marshal(msg)
	data = append(data, '\n')

	for conn, c := range s.clients {
		if c.DeviceID != client.DeviceID {
			conn.Write(data)
		}
	}
}

// handleCommand 處理自定義命令
func (s *Server) handleCommand(client *ClientInfo, msg Message) {
	response := Message{
		Type: "command_response",
		Data: map[string]interface{}{
			"data":      msg.Data,
			"message":   "命令已接收",
			"timestamp": time.Now().UnixMilli(),
		},
	}
	s.sendMessage(client.Conn, response)
}

// handleMessages 處理消息隊列
func (s *Server) handleMessages() {
	defer s.wg.Done()

	for {
		select {
		case <-s.shutdown:
			return

		case client := <-s.register:
			s.clientsMu.Lock()
			s.clients[client.Conn] = client
			s.clientsMu.Unlock()

		case conn := <-s.unregister:
			s.clientsMu.Lock()
			if client, ok := s.clients[conn]; ok {
				log.Printf("[QuestSocket] Client disconnected: %s", client.DeviceID)
				delete(s.clients, conn)
			}
			s.clientsMu.Unlock()

		case data := <-s.broadcast:
			s.clientsMu.RLock()
			for conn := range s.clients {
				_, err := conn.Write(data)
				if err != nil {
					log.Printf("[QuestSocket] Broadcast error: %v", err)
				}
			}
			s.clientsMu.RUnlock()
		}
	}
}

// sendMessage 發送消息給客戶端
func (s *Server) sendMessage(conn net.Conn, msg Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	data = append(data, '\n')
	_, err = conn.Write(data)
	return err
}

// sendError 發送錯誤消息
func (s *Server) sendError(conn net.Conn, message string) {
	msg := Message{
		Type: "error",
		Data: map[string]interface{}{
			"message": message,
		},
	}
	s.sendMessage(conn, msg)
}

// ServerInfo 服務器資訊
type ServerInfo struct {
	RoomID      string          `json:"room_id"`
	RoomName    string          `json:"room_name"`
	IP          string          `json:"ip"`
	Port        int             `json:"port"`
	Running     bool            `json:"running"`
	ClientCount int             `json:"client_count"`
	Clients     []ClientSummary `json:"clients"`
}

// ClientSummary 客戶端摘要
type ClientSummary struct {
	DeviceID    string    `json:"device_id"`
	Address     string    `json:"address"`
	IsServer    bool      `json:"is_server"`
	ConnectedAt time.Time `json:"connected_at"`
}
