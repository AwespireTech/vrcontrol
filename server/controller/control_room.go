package controller

import (
	"strings"
	"vrcontrol/server/consts"
	"vrcontrol/server/service"
	"vrcontrol/server/sockets"
	"vrcontrol/server/utils"

	"github.com/gin-gonic/gin"
)

const MaxRoomCount = 10

var RoomList map[string]*sockets.Room = make(map[string]*sockets.Room)
var DeviceRoomMap map[string]string = make(map[string]string)
var StandbyPlayerMap map[string]*sockets.Player = make(map[string]*sockets.Player)
var StandbyPlayerDisconnect = make(chan string)
var roomServiceRef *service.RoomService
var deviceServiceRef *service.DeviceService

func SetRoomService(svc *service.RoomService) {
	roomServiceRef = svc
	refreshDeviceRoomMapFromService()
}

func SetDeviceService(svc *service.DeviceService) {
	deviceServiceRef = svc
}

func init() {
	go func() {
		for disconect := range StandbyPlayerDisconnect {
			if player, exists := StandbyPlayerMap[disconect]; exists {
				delete(StandbyPlayerMap, disconect)
				if player.Room != nil {
					player.Room.PlayerUnregister <- player
				}
			}
			removeIsolation(disconect)
			removeIsolationByDeviceID(disconect)
			updateDeviceWSStatus(disconect, "disconnected")
		}
	}()
}

func refreshDeviceRoomMapFromService() {
	if roomServiceRef == nil {
		return
	}
	DeviceRoomMap = roomServiceRef.BuildAssignedRoomMap()
}

func GetRoomList(c *gin.Context) {
	if roomServiceRef != nil {
		rooms := roomServiceRef.GetAllRooms()
		if len(rooms) > 0 {
			lis := make([]string, 0, len(rooms))
			for _, room := range rooms {
				if room == nil {
					continue
				}
				lis = append(lis, room.RoomID)
			}
			c.JSON(200, gin.H{"rooms": lis})
			return
		}
	}

	lis := make([]string, len(RoomList))
	i := 0
	for k := range RoomList {
		lis[i] = k
		i++
	}
	c.JSON(200, gin.H{"rooms": lis})

}

func GetLanternJson(c *gin.Context) {
	roomID := c.Param("roomId")
	roomHash := c.Param("roomHash")

	if roomID == "" {
		c.JSON(400, gin.H{"error": "Room ID is required"})
		return
	}

	if roomHash == "" {
		c.JSON(400, gin.H{"error": "Room Hash is required"})
		return
	}

	c.JSON(200, gin.H{"data": consts.LoadAssignedLanternData(roomID, roomHash)})
}

func updateAssignedSequence(roomId string, deviceId string, seq int) {
	if roomServiceRef == nil {
		return
	}
	room, err := roomServiceRef.GetRoom(roomId)
	if err != nil || room == nil {
		return
	}
	if room.AssignedSequences == nil {
		room.AssignedSequences = make(map[string]int)
	}
	normalizedID := utils.NormalizeDeviceIDKey(deviceId)
	if normalizedID == "" {
		return
	}
	for key := range room.AssignedSequences {
		if key != normalizedID && utils.NormalizeDeviceIDKey(key) == normalizedID {
			delete(room.AssignedSequences, key)
		}
	}
	room.AssignedSequences[normalizedID] = seq
	_ = roomServiceRef.UpdateRoom(room)
}

func getAssignedSequences(roomId string) map[string]int {
	if roomServiceRef == nil {
		return make(map[string]int)
	}
	room, err := roomServiceRef.GetRoom(roomId)
	if err != nil || room == nil || room.AssignedSequences == nil {
		return make(map[string]int)
	}
	sequences := make(map[string]int, len(room.AssignedSequences))
	for key, value := range room.AssignedSequences {
		normalizedID := utils.NormalizeDeviceIDKey(key)
		if normalizedID == "" {
			continue
		}
		sequences[normalizedID] = value
	}
	return sequences
}

// AssignConnectedPlayerToRoom 將已連線且待命的玩家掛入指定房間
func AssignConnectedPlayerToRoom(roomId, deviceId string) {
	deviceId = utils.NormalizeDeviceIDKey(deviceId)
	if deviceId == "" {
		return
	}
	player, exists := StandbyPlayerMap[deviceId]
	if !exists || player == nil {
		if strings.HasPrefix(deviceId, "DEV-") && len(deviceId) > 4 {
			clientId := deviceId[4:]
			player, exists = StandbyPlayerMap[clientId]
		}
		if !exists || player == nil {
			for _, candidate := range StandbyPlayerMap {
				if candidate == nil {
					continue
				}
				if candidate.DeiviceID == deviceId || candidate.StableID == deviceId {
					player = candidate
					break
				}
			}
		}
		if player == nil {
			return
		}
	}

	room, ok := RoomList[roomId]
	if !ok {
		if len(RoomList) > MaxRoomCount {
			return
		}
		room = sockets.NewRoom(roomId)
		room.AssignedSequence = getAssignedSequences(roomId)
		RoomList[roomId] = room
		go room.Run()
	}

	player.Room = room
	room.PlayerRegister <- player
	delete(StandbyPlayerMap, player.StableID)
	delete(StandbyPlayerMap, deviceId)
}

// DisconnectWSByDeviceID 強制中斷指定設備的 WS 連線
func DisconnectWSByDeviceID(deviceId string) {
	deviceId = utils.NormalizeDeviceIDKey(deviceId)
	if deviceId == "" {
		return
	}
	// 1) 先處理待命玩家
	if player, ok := StandbyPlayerMap[deviceId]; ok && player != nil {
		delete(StandbyPlayerMap, deviceId)
		player.Connection.Close()
		updateDeviceWSStatus(deviceId, "disconnected")
		return
	}
	if strings.HasPrefix(deviceId, "DEV-") && len(deviceId) > 4 {
		clientId := deviceId[4:]
		if player, ok := StandbyPlayerMap[clientId]; ok && player != nil {
			delete(StandbyPlayerMap, clientId)
			player.Connection.Close()
			updateDeviceWSStatus(deviceId, "disconnected")
			return
		}
	}

	// 2) 處理房間內玩家
	for _, room := range RoomList {
		if room == nil {
			continue
		}
		player := room.GetPlayerByDeviceID(deviceId)
		if player == nil && strings.HasPrefix(deviceId, "DEV-") && len(deviceId) > 4 {
			player = room.GetPlayerByDeviceID(deviceId[4:])
		}
		if player != nil {
			room.PlayerUnregister <- player
			player.Connection.Close()
			updateDeviceWSStatus(deviceId, "disconnected")
			return
		}
	}

	updateDeviceWSStatus(deviceId, "disconnected")
}

// DetachConnectedPlayerFromRoom 從房間中移除玩家但保留 WS 連線
func DetachConnectedPlayerFromRoom(roomId, deviceId string) {
	deviceId = utils.NormalizeDeviceIDKey(deviceId)
	if deviceId == "" {
		return
	}
	room, ok := RoomList[roomId]
	if !ok || room == nil {
		return
	}
	player := room.GetPlayerByDeviceID(deviceId)
	if player == nil && strings.HasPrefix(deviceId, "DEV-") && len(deviceId) > 4 {
		player = room.GetPlayerByDeviceID(deviceId[4:])
	}
	if player == nil {
		return
	}

	room.PlayerDetach <- player
	if player.StableID != "" {
		StandbyPlayerMap[player.StableID] = player
	}
	StandbyPlayerMap[deviceId] = player
}
