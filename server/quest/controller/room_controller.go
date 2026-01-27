package controller

import (
	"net/http"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/service"

	"github.com/gin-gonic/gin"
)

// RoomController 房間控制器
type RoomController struct {
	roomService *service.RoomService
}

// NewRoomController 創建新的房間控制器
func NewRoomController(roomService *service.RoomService) *RoomController {
	return &RoomController{
		roomService: roomService,
	}
}

// GetAllRooms 獲取所有房間
func (c *RoomController) GetAllRooms(ctx *gin.Context) {
	rooms := c.roomService.GetAllRooms()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rooms,
	})
}

// GetRoom 獲取單個房間
func (c *RoomController) GetRoom(ctx *gin.Context) {
	roomID := ctx.Param("id")

	room, err := c.roomService.GetRoom(roomID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    room,
	})
}

// CreateRoom 創建新房間
func (c *RoomController) CreateRoom(ctx *gin.Context) {
	var room model.QuestRoom
	if err := ctx.ShouldBindJSON(&room); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := c.roomService.CreateRoom(&room); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    room,
		"message": "Room created successfully",
	})
}

// UpdateRoom 更新房間
func (c *RoomController) UpdateRoom(ctx *gin.Context) {
	roomID := ctx.Param("id")

	var room model.QuestRoom
	if err := ctx.ShouldBindJSON(&room); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	room.RoomID = roomID

	if err := c.roomService.UpdateRoom(&room); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    room,
		"message": "Room updated successfully",
	})
}

// PatchRoom 局部更新房間（嚴格白名單）
// @Router /api/quest/rooms/:id [patch]
func (c *RoomController) PatchRoom(ctx *gin.Context) {
	roomID := ctx.Param("id")

	var req service.RoomPatch
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	updated, err := c.roomService.PatchRoom(roomID, req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    updated,
		"message": "Room updated successfully",
	})
}

// DeleteRoom 刪除房間
func (c *RoomController) DeleteRoom(ctx *gin.Context) {
	roomID := ctx.Param("id")

	if err := c.roomService.DeleteRoom(roomID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Room deleted successfully",
	})
}

// AddDevice 添加設備到房間
func (c *RoomController) AddDevice(ctx *gin.Context) {
	roomID := ctx.Param("id")
	deviceID := ctx.Param("deviceId")

	if err := c.roomService.AddDeviceToRoom(roomID, deviceID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	refreshDeviceRoomMapFromService()

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Device added to room successfully",
	})
}

// RemoveDevice 從房間移除設備
func (c *RoomController) RemoveDevice(ctx *gin.Context) {
	roomID := ctx.Param("id")
	deviceID := ctx.Param("deviceId")

	if err := c.roomService.RemoveDeviceFromRoom(roomID, deviceID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	refreshDeviceRoomMapFromService()

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Device removed from room successfully",
	})
}
