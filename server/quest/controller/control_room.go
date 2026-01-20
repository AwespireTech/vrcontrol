package controller

import (
	"maps"
	"strconv"

	questconsts "vrcontrol/server/quest/consts"
	"vrcontrol/server/quest/model"
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

func SetQuestRoomService(svc *service.RoomService) {
	questRoomService = svc
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
		}
	}()
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
func AssignRoomAndSeq(c *gin.Context) {
	roomId := c.Param("roomId")
	deviceId := c.Param("clientId")
	seq, err := strconv.Atoi(c.Param("seq"))
	if err != nil || seq < 0 {
		c.JSON(400, gin.H{"error": "Invalid sequence number"})
		return
	}

	room, exists := RoomList[roomId]
	if !exists {
		c.JSON(404, gin.H{"error": "Room " + roomId + " not found"})
		return
	}

	player, exists := StandbyPlayerMap[deviceId]
	if !exists {
		c.JSON(404, gin.H{"error": "Player " + deviceId + " not found"})
		return
	}
	// Record settings
	DeviceRoomMap[deviceId] = roomId
	go questconsts.SaveAssignedRoom(DeviceRoomMap)
	room.AssignedSequence[player.DeiviceID] = seq
	go questconsts.SaveAssignedSequence(roomId, room.AssignedSequence)

	player.Room = room
	room.PlayerRegister <- player
	delete(StandbyPlayerMap, deviceId)
	c.JSON(200, gin.H{
		"message":  "Player assigned to room successfully",
		"roomId":   roomId,
		"sequence": seq,
	})

}
func CreateRoom(c *gin.Context) {
	roomId := c.Param("roomId")
	if roomId == "" {
		c.JSON(400, gin.H{"error": "Room ID is required"})
		return
	}

	if questRoomService != nil {
		if _, err := questRoomService.GetRoom(roomId); err != nil {
			questRoom := &model.QuestRoom{
				RoomID: roomId,
				Name:   roomId,
			}
			if err := questRoomService.CreateRoom(questRoom); err != nil {
				c.JSON(500, gin.H{"error": "Failed to create Quest room"})
				return
			}
		}
	}

	if _, exists := RoomList[roomId]; exists {
		c.JSON(400, gin.H{"error": "Room already exists"})
		return
	}

	room := sockets.NewRoom(roomId)
	room.AssignedSequence = questconsts.LoadAssignedSequence(roomId)
	RoomList[roomId] = room
	go room.Run()

	c.JSON(200, gin.H{"message": "Room created successfully", "roomId": roomId})
}
func GetUnassignedPlayers(c *gin.Context) {

	c.JSON(200, gin.H{"unassignedPlayers": utilities.Fold(maps.Keys(StandbyPlayerMap), make([]string, 0, len(StandbyPlayerMap)), func(_l []string, deviceId string) []string { return append(_l, deviceId) })})
}
