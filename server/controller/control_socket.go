package controller

import (
	"log"
	"net/http"

	"vrcontrol/server/sockets"

	"github.com/gin-gonic/gin"
)

func ConnectToRoomSocket(c *gin.Context) {
	clientId := c.Param("clientId")
	// Check if the clientId is valid
	if clientId == "" {
		log.Println("Invalid deviceId")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deviceId"})
		return
	}
	clientIP := c.ClientIP()
	conn, err := sockets.SocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Error Upgrading Connection: ", err)
		return
	}
	deviceId, valid := normalizeDeviceIDFromClient(clientId)
	playerId := clientId
	if valid {
		playerId = deviceId
	}
	p := sockets.HandlePlayerConnect(conn, playerId, StandbyPlayerDisconnect)
	if p == nil {
		log.Println("Failed to handle player connection for deviceId:", clientId)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to handle player connection"})
		return
	}

	if !valid {
		recordIsolation(clientId, clientIP, false, "", false, false)
		StandbyPlayerMap[playerId] = p
		return
	}

	if questDeviceService == nil || !questDeviceService.Exists(deviceId) {
		recordIsolation(clientId, clientIP, true, deviceId, false, false)
		StandbyPlayerMap[playerId] = p
		return
	}

	device, err := questDeviceService.GetDevice(deviceId)
	if err != nil || device == nil {
		recordIsolation(clientId, clientIP, true, deviceId, true, false)
		StandbyPlayerMap[playerId] = p
		return
	}
	if device.IP != clientIP {
		recordIsolation(clientId, clientIP, true, deviceId, true, false)
		StandbyPlayerMap[playerId] = p
		return
	}

	// id & ip matched

	removeIsolation(clientId)
	updateDeviceWSStatus(deviceId, "connected")

	refreshDeviceRoomMapFromService()
	roomId, exists := DeviceRoomMap[deviceId]
	if !exists {
		log.Println("Device not assigned to any room")
		StandbyPlayerMap[playerId] = p
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
			room.AssignedSequence = getQuestAssignedSequences(roomId)
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
		room.AssignedSequence = getQuestAssignedSequences(roomId)
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
