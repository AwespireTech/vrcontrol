package controller

import (
	"log"
	"net/http"

	questconsts "vrcontrol/server/quest/consts"
	"vrcontrol/server/quest/sockets"

	"github.com/gin-gonic/gin"
)

func ConnectToRoomSocket(c *gin.Context) {
	deviceId := c.Param("clientId")
	// Check if the deviceId is valid
	if deviceId == "" {
		log.Println("Invalid deviceId")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deviceId"})
		return
	}
	conn, err := sockets.SocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Error Upgrading Connection: ", err)
		return
	}
	p := sockets.HandlePlayerConnect(conn, deviceId, StandbyPlayerDisconnect)
	if p == nil {
		log.Println("Failed to handle player connection for deviceId:", deviceId)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to handle player connection"})
		return
	}

	roomId, exists := DeviceRoomMap[deviceId]
	if !exists {
		log.Println("Device not assigned to any room")
		StandbyPlayerMap[deviceId] = p
	} else {
		log.Println("Device assigned to room:", roomId)

		room, ok := RoomList[roomId]
		if !ok {
			if len(RoomList) > MaxRoomCount {
				log.Println("Room List is full, please try again later.")
				conn.Close()
				return
			}
			room = sockets.NewRoom(roomId)
			room.AssignedSequence = questconsts.LoadAssignedSequence(roomId)
			RoomList[roomId] = room
			go room.Run()
			log.Println("Room Created: ", roomId)
		}
		p.Room = room
		room.PlayerRegister <- p
	}
}
func ConnectToRoomControlSocket(c *gin.Context) {
	roomId := c.Param("roomId")

	// Check if the deviceId is valid
	room, ok := RoomList[roomId]
	if !ok {
		if len(RoomList) > MaxRoomCount {
			log.Println("Room List is full, please try again later.")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Room List is full, please try again later."})
			return
		}
		room = sockets.NewRoom(roomId)
		room.AssignedSequence = questconsts.LoadAssignedSequence(roomId)
		RoomList[roomId] = room
		go room.Run()
		log.Println("Room Created: ", roomId)
	}
	conn, err := sockets.SocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Error Upgrading Connection: ", err)
		return
	}
	sockets.HandleControllerConnect(room, conn)
}
