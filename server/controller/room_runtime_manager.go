package controller

import (
	"sort"
	"sync"

	"vrcontrol/server/sockets"
)

// RoomRuntimeManager coordinates in-memory room runtime updates.
type RoomRuntimeManager struct {
	mu sync.RWMutex
}

var roomRuntimeManager = &RoomRuntimeManager{}

// GetRoom returns a runtime room if it exists.
func (m *RoomRuntimeManager) GetRoom(roomID string) (*sockets.Room, bool) {
	if roomID == "" {
		return nil, false
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	room, ok := RoomList[roomID]
	return room, ok && room != nil
}

// PutRoom stores a runtime room.
func (m *RoomRuntimeManager) PutRoom(room *sockets.Room) {
	if room == nil || room.RoomID == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	RoomList[room.RoomID] = room
}

// RemoveRoom deletes a runtime room.
func (m *RoomRuntimeManager) RemoveRoom(roomID string) {
	if roomID == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(RoomList, roomID)
}

// ListRoomIDs returns the current runtime room IDs.
func (m *RoomRuntimeManager) ListRoomIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, 0, len(RoomList))
	for roomID := range RoomList {
		ids = append(ids, roomID)
	}
	sort.Strings(ids)
	return ids
}

// GetOrCreateRoom returns an existing room or creates a new runtime room.
func (m *RoomRuntimeManager) GetOrCreateRoom(roomID string) (*sockets.Room, bool) {
	if roomID == "" {
		return nil, false
	}
	if room, ok := m.GetRoom(roomID); ok {
		return room, false
	}
	m.mu.RLock()
	if len(RoomList) >= MaxRoomCount {
		m.mu.RUnlock()
		return nil, false
	}
	m.mu.RUnlock()
	room := createRoomRuntime(roomID)
	if room == nil {
		return nil, false
	}
	m.PutRoom(room)
	return room, true
}

// RefreshDeviceRoomMapFromService rebuilds the device-to-room mapping from persisted rooms.
func (m *RoomRuntimeManager) RefreshDeviceRoomMapFromService() {
	if roomServiceRef == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	DeviceRoomMap = roomServiceRef.BuildAssignedRoomMap()
}

// SyncRoomFromStore copies persisted room state into an existing runtime room.
func (m *RoomRuntimeManager) SyncRoomFromStore(roomID string, broadcast bool) *sockets.Room {
	if roomID == "" || roomServiceRef == nil {
		return nil
	}

	persistedRoom, err := roomServiceRef.GetRoom(roomID)
	if err != nil || persistedRoom == nil {
		return nil
	}

	runtimeRoom, ok := m.GetRoom(roomID)
	if !ok || runtimeRoom == nil {
		return nil
	}

	runtimeRoom.Parameters = cloneRoomParameters(persistedRoom.Parameters)
	runtimeRoom.AssignedSequence = getAssignedSequences(roomID)
	runtimeRoom.SetActivityService(activityServiceRef)

	if broadcast {
		runtimeRoom.BroadcastConfig()
	}

	return runtimeRoom
}
