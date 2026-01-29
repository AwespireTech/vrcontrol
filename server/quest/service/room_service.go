package service

import (
	"fmt"
	"log"
	"sort"
	"strings"
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
	rooms := s.roomRepo.GetAll()
	sort.SliceStable(rooms, func(i, j int) bool {
		nameI := strings.ToLower(rooms[i].Name)
		nameJ := strings.ToLower(rooms[j].Name)
		if nameI == nameJ {
			return rooms[i].RoomID < rooms[j].RoomID
		}
		return nameI < nameJ
	})
	return rooms
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
	room, err := s.roomRepo.GetByID(roomID)
	if err != nil {
		return err
	}

	// 移除房間內所有設備的房間關聯（以 DeviceIDs 為主）
	for _, deviceID := range room.DeviceIDs {
		device, err := s.deviceRepo.GetByID(deviceID)
		if err != nil {
			continue
		}
		device.RoomID = ""
		_ = s.deviceRepo.Update(device)
	}

	if err := s.roomRepo.Delete(roomID); err != nil {
		return err
	}

	s.syncAssignedRoomMap()
	return nil
}

// AddDeviceToRoom 添加設備到房間
func (s *RoomService) AddDeviceToRoom(roomID, deviceID string) error {
	room, err := s.roomRepo.GetByID(roomID)
	if err != nil {
		return err
	}

	if !roomHasDevice(room, deviceID) {
		// 檢查房間容量
		if len(room.DeviceIDs) >= room.MaxDevices {
			return fmt.Errorf("room is full (max: %d)", room.MaxDevices)
		}
	}

	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return err
	}

	// 確保設備只屬於單一房間（以 DeviceIDs 為主）
	if err := s.removeDeviceFromOtherRooms(roomID, deviceID); err != nil {
		return err
	}

	// 添加到房間
	if !roomHasDevice(room, deviceID) {
		if err := s.roomRepo.AddDevice(roomID, deviceID); err != nil {
			return err
		}
	}

	// 更新設備的房間關聯
	device.RoomID = roomID
	if err := s.deviceRepo.Update(device); err != nil {
		return err
	}

	s.syncAssignedRoomMap()
	return nil
}

// RemoveDeviceFromRoom 從房間移除設備
func (s *RoomService) RemoveDeviceFromRoom(roomID, deviceID string) error {
	if err := s.roomRepo.RemoveDevice(roomID, deviceID); err != nil {
		return err
	}

	// 清除設備的房間關聯
	device, err := s.deviceRepo.GetByID(deviceID)
	if err == nil {
		if device.RoomID == roomID {
			device.RoomID = ""
			_ = s.deviceRepo.Update(device)
		}
	}

	s.syncAssignedRoomMap()
	return nil
}

// RemoveDeviceFromAllRooms 從所有房間移除設備並清理 assigned_sequences
func (s *RoomService) RemoveDeviceFromAllRooms(deviceID string) error {
	rooms := s.roomRepo.GetAll()
	for _, room := range rooms {
		if room == nil {
			continue
		}
		changed := false
		if roomHasDevice(room, deviceID) {
			newDeviceIDs := make([]string, 0, len(room.DeviceIDs))
			for _, id := range room.DeviceIDs {
				if id != deviceID {
					newDeviceIDs = append(newDeviceIDs, id)
				}
			}
			room.DeviceIDs = newDeviceIDs
			changed = true
		}
		if room.AssignedSequences != nil {
			if _, exists := room.AssignedSequences[deviceID]; exists {
				delete(room.AssignedSequences, deviceID)
				changed = true
			}
		}
		if changed {
			if err := s.roomRepo.Update(room); err != nil {
				return err
			}
		}
	}
	return nil
}

// BuildAssignedRoomMap 從 QuestRoom.DeviceIDs 建立 device_id -> room_id 對應
func (s *RoomService) BuildAssignedRoomMap() map[string]string {
	roomMap := buildAssignedRoomMapFromRooms(s.roomRepo.GetAll())
	devices := s.deviceRepo.GetAll()
	for _, device := range devices {
		if device == nil || device.RoomID == "" {
			continue
		}
		if _, exists := roomMap[device.DeviceID]; exists {
			continue
		}
		roomMap[device.DeviceID] = device.RoomID
	}
	return roomMap
}

// ReconcileDeviceAssignmentsByRoomUpdate 以房間 UpdatedAt 為優先修正多重分配
func (s *RoomService) ReconcileDeviceAssignmentsByRoomUpdate() (map[string]string, error) {
	rooms := s.roomRepo.GetAll()
	sort.SliceStable(rooms, func(i, j int) bool {
		return effectiveRoomUpdatedAt(rooms[i]).After(effectiveRoomUpdatedAt(rooms[j]))
	})

	assigned := make(map[string]string)
	roomNewDevices := make(map[string][]string, len(rooms))
	roomChanged := make(map[string]bool)

	for _, room := range rooms {
		if room == nil {
			continue
		}
		seen := make(map[string]struct{})
		newList := make([]string, 0, len(room.DeviceIDs))
		for _, deviceID := range room.DeviceIDs {
			if deviceID == "" {
				continue
			}
			if _, ok := seen[deviceID]; ok {
				roomChanged[room.RoomID] = true
				continue
			}
			seen[deviceID] = struct{}{}
			if _, exists := assigned[deviceID]; exists {
				roomChanged[room.RoomID] = true
				continue
			}
			assigned[deviceID] = room.RoomID
			newList = append(newList, deviceID)
		}

		if !stringSliceEqual(room.DeviceIDs, newList) {
			roomChanged[room.RoomID] = true
		}
		roomNewDevices[room.RoomID] = newList
	}

	for _, room := range rooms {
		if room == nil {
			continue
		}
		if roomChanged[room.RoomID] {
			room.DeviceIDs = roomNewDevices[room.RoomID]
			if err := s.roomRepo.Update(room); err != nil {
				return assigned, err
			}
		}
	}

	devices := s.deviceRepo.GetAll()
	for _, device := range devices {
		if device == nil {
			continue
		}
		targetRoomID := ""
		if roomID, ok := assigned[device.DeviceID]; ok {
			targetRoomID = roomID
		}
		if device.RoomID != targetRoomID {
			device.RoomID = targetRoomID
			if err := s.deviceRepo.Update(device); err != nil {
				log.Printf("[RoomService] reconcile: update device %s room failed: %v", device.DeviceID, err)
			}
		}
	}

	return assigned, nil
}

func (s *RoomService) removeDeviceFromOtherRooms(targetRoomID, deviceID string) error {
	rooms := s.roomRepo.GetAll()
	for _, room := range rooms {
		if room == nil || room.RoomID == targetRoomID {
			continue
		}
		if roomHasDevice(room, deviceID) {
			if err := s.roomRepo.RemoveDevice(room.RoomID, deviceID); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *RoomService) syncAssignedRoomMap() {
	_ = buildAssignedRoomMapFromRooms(s.roomRepo.GetAll())
}

func buildAssignedRoomMapFromRooms(rooms []*model.QuestRoom) map[string]string {
	if len(rooms) == 0 {
		return make(map[string]string)
	}

	sort.SliceStable(rooms, func(i, j int) bool {
		return effectiveRoomUpdatedAt(rooms[i]).After(effectiveRoomUpdatedAt(rooms[j]))
	})

	roomMap := make(map[string]string)
	for _, room := range rooms {
		if room == nil {
			continue
		}
		seen := make(map[string]struct{})
		for _, deviceID := range room.DeviceIDs {
			if deviceID == "" {
				continue
			}
			if _, ok := seen[deviceID]; ok {
				continue
			}
			seen[deviceID] = struct{}{}
			if _, exists := roomMap[deviceID]; exists {
				continue
			}
			roomMap[deviceID] = room.RoomID
		}
	}

	return roomMap
}

func roomHasDevice(room *model.QuestRoom, deviceID string) bool {
	for _, id := range room.DeviceIDs {
		if id == deviceID {
			return true
		}
	}
	return false
}

func stringSliceEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func effectiveRoomUpdatedAt(room *model.QuestRoom) time.Time {
	if room == nil {
		return time.Time{}
	}
	if !room.UpdatedAt.IsZero() {
		return room.UpdatedAt
	}
	return room.CreatedAt
}

// StartSocketServer 啟動房間的 Socket Server
