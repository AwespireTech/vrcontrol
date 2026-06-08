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
	if !valid {
		recordIsolation(clientId, clientIP, false, "", false, false)
		StandbyPlayerMap[playerId] = p
		return
	}

	if deviceServiceRef == nil || !deviceServiceRef.Exists(deviceId) {
		recordIsolation(clientId, clientIP, true, deviceId, false, false)
		StandbyPlayerMap[playerId] = p
		return
	}

	device, err := deviceServiceRef.GetDevice(deviceId)
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

		room, created := roomRuntimeManager.GetOrCreateRoom(roomId)
		if room == nil {
			log.Println("Room runtime creation failed or room limit reached:", roomId)
			StandbyPlayerMap[playerId] = p
			return
		}
		if created {
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
	room, created := roomRuntimeManager.GetOrCreateRoom(roomId)
	if room == nil {
		log.Println("Room runtime creation failed or room limit reached:", roomId)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Room List is full, please try again later."})
		return
	}
	if created {
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
