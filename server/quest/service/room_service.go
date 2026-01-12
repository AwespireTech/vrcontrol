package service

import (
	"fmt"
	"time"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/questsocket"
	"vrcontrol/server/quest/repository"
)

// RoomService 房間管理服務
type RoomService struct {
	roomRepo      *repository.RoomRepository
	deviceRepo    *repository.DeviceRepository
	socketManager *questsocket.SocketManager
}

// NewRoomService 創建新的房間服務
func NewRoomService(roomRepo *repository.RoomRepository, deviceRepo *repository.DeviceRepository, socketManager *questsocket.SocketManager) *RoomService {
	return &RoomService{
		roomRepo:      roomRepo,
		deviceRepo:    deviceRepo,
		socketManager: socketManager,
	}
}

// GetAllRooms 獲取所有房間
func (s *RoomService) GetAllRooms() []*model.QuestRoom {
	return s.roomRepo.GetAll()
}

// GetRoom 獲取單個房間
func (s *RoomService) GetRoom(roomID string) (*model.QuestRoom, error) {
	return s.roomRepo.GetByID(roomID)
}

// CreateRoom 創建新房間
func (s *RoomService) CreateRoom(room *model.QuestRoom) error {
	// 生成 RoomID
	if room.RoomID == "" {
		room.RoomID = fmt.Sprintf("ROOM-%d", time.Now().UnixNano()%1000000)
	}

	// 設置預設值
	if room.MaxDevices == 0 {
		room.MaxDevices = 10
	}
	if room.SocketIP == "" {
		room.SocketIP = "0.0.0.0"
	}

	return s.roomRepo.Create(room)
}

// UpdateRoom 更新房間
func (s *RoomService) UpdateRoom(room *model.QuestRoom) error {
	return s.roomRepo.Update(room)
}

// DeleteRoom 刪除房間
func (s *RoomService) DeleteRoom(roomID string) error {
	// 停止 Socket Server
	if s.socketManager.IsRunning(roomID) {
		s.socketManager.StopServer(roomID)
	}

	// 移除房間內所有設備的房間關聯
	devices := s.deviceRepo.GetByRoomID(roomID)
	for _, device := range devices {
		device.RoomID = ""
		s.deviceRepo.Update(device)
	}

	return s.roomRepo.Delete(roomID)
}

// AddDeviceToRoom 添加設備到房間
func (s *RoomService) AddDeviceToRoom(roomID, deviceID string) error {
	room, err := s.roomRepo.GetByID(roomID)
	if err != nil {
		return err
	}

	// 檢查房間容量
	if len(room.DeviceIDs) >= room.MaxDevices {
		return fmt.Errorf("room is full (max: %d)", room.MaxDevices)
	}

	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}

	// 如果設備已在其他房間，先移除
	if device.RoomID != "" && device.RoomID != roomID {
		s.roomRepo.RemoveDevice(device.RoomID, deviceID)
	}

	// 添加到房間
	if err := s.roomRepo.AddDevice(roomID, deviceID); err != nil {
		return err
	}

	// 更新設備的房間關聯
	device.RoomID = roomID
	return s.deviceRepo.Update(device)
}

// RemoveDeviceFromRoom 從房間移除設備
func (s *RoomService) RemoveDeviceFromRoom(roomID, deviceID string) error {
	if err := s.roomRepo.RemoveDevice(roomID, deviceID); err != nil {
		return err
	}

	// 清除設備的房間關聯
	device, err := s.deviceRepo.GetByID(deviceID)
	if err == nil {
		device.RoomID = ""
		s.deviceRepo.Update(device)
	}

	return nil
}

// StartSocketServer 啟動房間的 Socket Server
func (s *RoomService) StartSocketServer(roomID string) (int, error) {
	room, err := s.roomRepo.GetByID(roomID)
	if err != nil {
		return 0, err
	}

	// 檢查是否已啟動
	if s.socketManager.IsRunning(roomID) {
		return room.SocketPort, fmt.Errorf("socket server already running")
	}

	// 啟動 Socket Server
	port, err := s.socketManager.StartServer(roomID, room.Name, room.SocketIP)
	if err != nil {
		return 0, err
	}

	// 更新房間的 Socket 資訊
	if err := s.roomRepo.UpdateSocketInfo(roomID, port, true); err != nil {
		// 如果更新失敗，停止 Socket Server
		s.socketManager.StopServer(roomID)
		return 0, err
	}

	return port, nil
}

// StopSocketServer 停止房間的 Socket Server
func (s *RoomService) StopSocketServer(roomID string) error {
	if err := s.socketManager.StopServer(roomID); err != nil {
		return err
	}

	// 更新房間的 Socket 狀態
	return s.roomRepo.UpdateSocketInfo(roomID, 0, false)
}

// GetSocketServerInfo 獲取房間的 Socket Server 資訊
func (s *RoomService) GetSocketServerInfo(roomID string) (questsocket.ServerInfo, error) {
	return s.socketManager.GetServerInfo(roomID)
}

// SyncParameters 同步參數到 Socket Server
func (s *RoomService) SyncParameters(roomID string) error {
	room, err := s.roomRepo.GetByID(roomID)
	if err != nil {
		return err
	}

	if !s.socketManager.IsRunning(roomID) {
		return fmt.Errorf("socket server not running")
	}

	// 廣播參數更新
	return s.socketManager.BroadcastToRoom(roomID, map[string]interface{}{
		"type":       "params_update",
		"parameters": room.Parameters,
	})
}
