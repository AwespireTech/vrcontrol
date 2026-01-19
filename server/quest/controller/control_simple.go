package controller

import (
	"net/http"
	"strconv"

	"vrcontrol/server/quest/sockets"

	"github.com/gin-gonic/gin"
)

// AssignSequence assigns a specific sequence to a client, instead of automatically assigning it based on the order of connection.

func AssignSequence(c *gin.Context) {

	r := RoomList[c.Param("roomId")]
	p := r.GetPlayerByDeviceID(c.Param("clientId"))
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Player not found",
		})
		return
	}

	seq, err := strconv.Atoi(c.Param("seq"))
	if err != nil || seq < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid sequence number",
		})
		return
	}
	r.AssignedSequence[p.DeiviceID] = seq
	r.Signals <- sockets.ControlSignal{
		Type:   sockets.ControlSignalTypeSeqUpdate,
		Target: p,
	}
	c.JSON(http.StatusOK, gin.H{
		"message":  "Sequence assigned successfully",
		"sequence": seq,
	})
}
func ForceMove(c *gin.Context) {

	r := RoomList[c.Param("roomId")]
	p := r.GetPlayerByDeviceID(c.Param("clientId"))
	dest, err := strconv.Atoi(c.Param("dest"))
	if err != nil || dest < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid destination",
		})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Player not found",
		})
		return
	}

	r.MoveControl <- sockets.Movement{
		DestinationStage: dest,
		Force:            true,
		Target:           p.DeiviceID,
		Broadcast:        false,
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Player forced to move successfully",
	})
}

func ForceAllMove(c *gin.Context) {

	r := RoomList[c.Param("roomId")]
	dest, err := strconv.Atoi(c.Param("dest"))
	if err != nil || dest < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid destination",
		})
		return
	}
	r.MoveControl <- sockets.Movement{
		DestinationStage: dest,
		Force:            true,
		Broadcast:        true,
	}
	c.JSON(http.StatusOK, gin.H{
		"message":      "All Player forced to move successfully",
		"dest_chapter": dest,
	})
}
