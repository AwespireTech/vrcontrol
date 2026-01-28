package controller

import (
	"maps"
	"strings"

	questconsts "vrcontrol/server/quest/consts"
	"vrcontrol/server/quest/service"
	"vrcontrol/server/quest/sockets"
	"vrcontrol/server/utilities"

	"github.com/gin-gonic/gin"
)

const MaxRoomCount = 10

var RoomList map[string]*sockets.Room = make(map[string]*sockets.Room)
var DeviceRoomMap map[string]string = make(map[string]string)
var StandbyPlayerMap map[string]*sockets.Player = make(map[string]*sockets.Player)
var StandbyPlayerDisconnect = make(chan string)
var questRoomService *service.RoomService
var questDeviceService *service.DeviceService

func SetQuestRoomService(svc *service.RoomService) {
	questRoomService = svc
	refreshDeviceRoomMapFromService()
}

func SetQuestDeviceService(svc *service.DeviceService) {
	questDeviceService = svc
}

func init() {
	DeviceRoomMap = questconsts.LoadAssignedRoom()
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
	if questRoomService == nil {
		return
	}
	DeviceRoomMap = questRoomService.BuildAssignedRoomMap()
	go questconsts.SaveAssignedRoom(DeviceRoomMap)
}

func GetRoomList(c *gin.Context) {
	if questRoomService != nil {
		rooms := questRoomService.GetAllRooms()
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

func updateQuestAssignedSequence(roomId string, deviceId string, seq int) {
	if questRoomService == nil {
		return
	}
	room, err := questRoomService.GetRoom(roomId)
	if err != nil || room == nil {
		return
	}
	if room.AssignedSequences == nil {
		room.AssignedSequences = make(map[string]int)
	}
	room.AssignedSequences[deviceId] = seq
	_ = questRoomService.UpdateRoom(room)
}

func getQuestAssignedSequences(roomId string) map[string]int {
	if questRoomService == nil {
		return make(map[string]int)
	}
	room, err := questRoomService.GetRoom(roomId)
	if err != nil || room == nil || room.AssignedSequences == nil {
		return make(map[string]int)
	}
	sequences := make(map[string]int, len(room.AssignedSequences))
	for key, value := range room.AssignedSequences {
		sequences[key] = value
	}
	return sequences
}
func GetUnassignedPlayers(c *gin.Context) {
	players := utilities.Fold(maps.Keys(StandbyPlayerMap), make([]string, 0, len(StandbyPlayerMap)), func(_l []string, deviceId string) []string { return append(_l, deviceId) })
	if questDeviceService == nil {
		c.JSON(200, gin.H{"unassignedPlayers": players})
		return
	}
	filtered := make([]string, 0, len(players))
	for _, deviceId := range players {
		if strings.HasPrefix(deviceId, "DEV-") {
			if questDeviceService.Exists(deviceId) {
				filtered = append(filtered, deviceId)
			}
			continue
		}
		if id, ok := normalizeDeviceIDFromClient(deviceId); ok && questDeviceService.Exists(id) {
			filtered = append(filtered, id)
		}
	}
	c.JSON(200, gin.H{"unassignedPlayers": filtered})
}
