package service

import (
	"fmt"
	"time"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/repository"
)

// RoomService 房間管理服務
type RoomService struct {
	roomRepo   *repository.RoomRepository
	deviceRepo *repository.DeviceRepository
}

// RoomPatch 房間局部更新（嚴格白名單）
type RoomPatch struct {
	Name        *string         `json:"name"`
	Description *string         `json:"description"`
	Parameters  *map[string]any `json:"parameters"`
}

// NewRoomService 創建新的房間服務
func NewRoomService(roomRepo *repository.RoomRepository, deviceRepo *repository.DeviceRepository) *RoomService {
	return &RoomService{
		roomRepo:   roomRepo,
		deviceRepo: deviceRepo,
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
	if room.AssignedSequences == nil {
		room.AssignedSequences = make(map[string]int)
	}

	return s.roomRepo.Create(room)
}

// UpdateRoom 更新房間
func (s *RoomService) UpdateRoom(room *model.QuestRoom) error {
	return s.roomRepo.Update(room)
}

// PatchRoom 局部更新房間（嚴格白名單）
func (s *RoomService) PatchRoom(roomID string, patch RoomPatch) (*model.QuestRoom, error) {
	existing, err := s.roomRepo.GetByID(roomID)
	if err != nil {
		return nil, err
	}

	if patch.Name != nil {
		existing.Name = *patch.Name
	}
	if patch.Description != nil {
		existing.Description = *patch.Description
	}
	if patch.Parameters != nil {
		existing.Parameters = *patch.Parameters
	}

	if err := s.roomRepo.Update(existing); err != nil {
		return nil, err
	}

	return existing, nil
}

// DeleteRoom 刪除房間
func (s *RoomService) DeleteRoom(roomID string) error {
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
