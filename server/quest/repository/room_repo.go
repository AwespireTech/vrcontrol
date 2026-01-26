package repository

import (
	"fmt"
	"sync"
	"time"

	"vrcontrol/server/quest/model"
)

// RoomRepository 房間資料存儲
type RoomRepository struct {
	repo  *JSONRepository
	rooms map[string]*model.QuestRoom
	mu    sync.RWMutex
}

// NewRoomRepository 創建新的房間 Repository
func NewRoomRepository(filePath string) *RoomRepository {
	return &RoomRepository{
		repo:  NewJSONRepository(filePath),
		rooms: make(map[string]*model.QuestRoom),
	}
}

// Load 加載所有房間
func (r *RoomRepository) Load() error {
	var rooms []*model.QuestRoom
	if err := r.repo.Load(&rooms); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.rooms = make(map[string]*model.QuestRoom)
	for _, room := range rooms {
		r.rooms[room.RoomID] = room
	}

	return nil
}

// save 內部保存方法（不加鎖）
func (r *RoomRepository) save() error {
	rooms := make([]*model.QuestRoom, 0, len(r.rooms))
	for _, room := range r.rooms {
		rooms = append(rooms, room)
	}
	return r.repo.Save(rooms)
}

// Save 保存所有房間
func (r *RoomRepository) Save() error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.save()
}

// GetAll 獲取所有房間
func (r *RoomRepository) GetAll() []*model.QuestRoom {
	r.mu.RLock()
	defer r.mu.RUnlock()

	rooms := make([]*model.QuestRoom, 0, len(r.rooms))
	for _, room := range r.rooms {
		rooms = append(rooms, room)
	}

	return rooms
}

// GetByID 根據 ID 獲取房間
func (r *RoomRepository) GetByID(roomID string) (*model.QuestRoom, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	room, exists := r.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("room not found: %s", roomID)
	}

	return room, nil
}

// GetByName 根據名稱獲取房間
func (r *RoomRepository) GetByName(name string) (*model.QuestRoom, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, room := range r.rooms {
		if room.Name == name {
			return room, nil
		}
	}

	return nil, fmt.Errorf("room not found with name: %s", name)
}

// Create 創建新房間
func (r *RoomRepository) Create(room *model.QuestRoom) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.rooms[room.RoomID]; exists {
		return fmt.Errorf("room already exists: %s", room.RoomID)
	}

	now := time.Now()
	room.CreatedAt = now
	room.UpdatedAt = now

	if room.DeviceIDs == nil {
		room.DeviceIDs = []string{}
	}
	if room.Parameters == nil {
		room.Parameters = make(map[string]any)
	}
	if room.AssignedSequences == nil {
		room.AssignedSequences = make(map[string]int)
	}

	r.rooms[room.RoomID] = room

	return r.save()
}

// Update 更新房間
func (r *RoomRepository) Update(room *model.QuestRoom) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.rooms[room.RoomID]; !exists {
		return fmt.Errorf("room not found: %s", room.RoomID)
	}

	room.UpdatedAt = time.Now()
	if room.AssignedSequences == nil {
		room.AssignedSequences = make(map[string]int)
	}
	r.rooms[room.RoomID] = room

	return r.save()
}

// Delete 刪除房間
func (r *RoomRepository) Delete(roomID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.rooms[roomID]; !exists {
		return fmt.Errorf("room not found: %s", roomID)
	}

	delete(r.rooms, roomID)

	return r.save()
}

// AddDevice 添加設備到房間
func (r *RoomRepository) AddDevice(roomID, deviceID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	room, exists := r.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found: %s", roomID)
	}

	// 檢查是否已存在
	for _, id := range room.DeviceIDs {
		if id == deviceID {
			return nil // 已存在，不需要添加
		}
	}

	room.DeviceIDs = append(room.DeviceIDs, deviceID)
	room.UpdatedAt = time.Now()

	return r.save()
}

// RemoveDevice 從房間移除設備
func (r *RoomRepository) RemoveDevice(roomID, deviceID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	room, exists := r.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found: %s", roomID)
	}

	newDeviceIDs := make([]string, 0)
	for _, id := range room.DeviceIDs {
		if id != deviceID {
			newDeviceIDs = append(newDeviceIDs, id)
		}
	}

	room.DeviceIDs = newDeviceIDs
	room.UpdatedAt = time.Now()

	return r.save()
}

// UpdateSocketInfo 更新 Socket 資訊
func (r *RoomRepository) UpdateSocketInfo(roomID string, port int, running bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	room, exists := r.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found: %s", roomID)
	}

	room.SocketPort = port
	room.SocketRunning = running
	room.UpdatedAt = time.Now()

	return r.save()
}

// Count 獲取房間總數
func (r *RoomRepository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.rooms)
}

// Exists 檢查房間是否存在
func (r *RoomRepository) Exists(roomID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.rooms[roomID]
	return exists
}
