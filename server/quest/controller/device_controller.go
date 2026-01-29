package controller

import (
	"log"
	"net/http"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/service"

	"github.com/gin-gonic/gin"
)

// DeviceController 設備控制器
type DeviceController struct {
	deviceService *service.DeviceService
	roomService   *service.RoomService
}

// NewDeviceController 創建新的設備控制器
func NewDeviceController(deviceService *service.DeviceService, roomService *service.RoomService) *DeviceController {
	return &DeviceController{
		deviceService: deviceService,
		roomService:   roomService,
	}
}

// GetAllDevices 獲取所有設備
// @Router /api/quest/devices [get]
func (c *DeviceController) GetAllDevices(ctx *gin.Context) {
	devices := c.deviceService.GetAllDevices()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    devices,
	})
}

// GetDevice 獲取單個設備
// @Router /api/quest/devices/:id [get]
func (c *DeviceController) GetDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	device, err := c.deviceService.GetDevice(deviceID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    device,
	})
}

// CreateDevice 創建新設備
// @Router /api/quest/devices [post]
func (c *DeviceController) CreateDevice(ctx *gin.Context) {
	log.Println("[DeviceController] CreateDevice: 開始處理請求")
	var device model.QuestDevice
	if err := ctx.ShouldBindJSON(&device); err != nil {
		log.Printf("[DeviceController] CreateDevice: JSON 綁定失敗 - %v\n", err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	log.Printf("[DeviceController] CreateDevice: 收到設備數據 - Name: %s, Alias: %s, IP: %s\n", device.Name, device.Alias, device.IP)
	if err := c.deviceService.CreateDevice(&device); err != nil {
		log.Printf("[DeviceController] CreateDevice: Service 創建失敗 - %v\n", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	log.Printf("[DeviceController] CreateDevice: 創建成功 - Device ID: %s\n", device.DeviceID)
	reconcileIsolationAfterDeviceUpdate(device.DeviceID, device.IP)
	removeIsolationByDeviceID(device.DeviceID)
	ctx.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    device,
		"message": "Device created successfully",
	})
}

// UpdateDevice 更新設備
// @Router /api/quest/devices/:id [put]
func (c *DeviceController) UpdateDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	var device model.QuestDevice
	if err := ctx.ShouldBindJSON(&device); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	device.DeviceID = deviceID

	existing, err := c.deviceService.GetDevice(deviceID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	device.RoomID = existing.RoomID

	if err := c.deviceService.UpdateDevice(&device); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    device,
		"message": "Device updated successfully",
	})
}

// PatchDevice 局部更新設備（嚴格白名單）
// @Router /api/quest/devices/:id [patch]
func (c *DeviceController) PatchDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	var req service.DevicePatch
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	if req.Port != nil {
		if *req.Port < 1 || *req.Port > 65535 {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid port value",
			})
			return
		}
	}

	if req.RoomID != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "room_id is read-only; use room assignment API",
		})
		return
	}

	updated, err := c.deviceService.PatchDevice(deviceID, req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	reconcileIsolationAfterDeviceUpdate(updated.DeviceID, updated.IP)
	removeIsolationByDeviceID(updated.DeviceID)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    updated,
		"message": "Device updated successfully",
	})
}

// DeleteDevice 刪除設備
// @Router /api/quest/devices/:id [delete]
func (c *DeviceController) DeleteDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")
	DisconnectWSByDeviceID(deviceID)

	if c.roomService != nil {
		if err := c.roomService.RemoveDeviceFromAllRooms(deviceID); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
	}

	if err := c.deviceService.DeleteDevice(deviceID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	removeIsolationByDeviceID(deviceID)
	refreshDeviceRoomMapFromService()

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Device deleted successfully",
	})
}

// ConnectDevice 連接設備
// @Router /api/quest/devices/:id/connect [post]
func (c *DeviceController) ConnectDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	if err := c.deviceService.ConnectDevice(deviceID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
			"message": "Failed to connect device",
		})
		return
	}

	device, _ := c.deviceService.GetDevice(deviceID)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    device,
		"message": "Device connected successfully",
	})
}

// DisconnectDevice 斷開設備連接
// @Router /api/quest/devices/:id/disconnect [post]
func (c *DeviceController) DisconnectDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	if err := c.deviceService.DisconnectDevice(deviceID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Device disconnected successfully",
	})
}

// SetAutoReconnectEnabledBatch 批次設定設備是否允許自動重連
// @Router /api/quest/devices/batch/auto-reconnect [post]
func (c *DeviceController) SetAutoReconnectEnabledBatch(ctx *gin.Context) {
	var req struct {
		DeviceIDs []string `json:"device_ids" binding:"required"`
		Enabled   *bool    `json:"enabled"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}
	if req.Enabled == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Missing required field: enabled",
		})
		return
	}

	failed, successCount := c.deviceService.SetAutoReconnectEnabledBatch(req.DeviceIDs, *req.Enabled)
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total":         len(req.DeviceIDs),
			"success_count": successCount,
			"failed_count":  len(req.DeviceIDs) - successCount,
			"failed":        failed,
		},
	})
}

// ResetAutoReconnect 重置單台設備自動重連狀態
// @Router /api/quest/devices/:id/auto-reconnect/reset [post]
func (c *DeviceController) ResetAutoReconnect(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	updated, err := c.deviceService.ResetAutoReconnect(deviceID)
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
	})
}

// ResetAutoReconnectBatch 批次重置自動重連狀態
// @Router /api/quest/devices/batch/auto-reconnect/reset [post]
func (c *DeviceController) ResetAutoReconnectBatch(ctx *gin.Context) {
	var req struct {
		DeviceIDs []string `json:"device_ids" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	failed, successCount := c.deviceService.ResetAutoReconnectBatch(req.DeviceIDs)
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total":         len(req.DeviceIDs),
			"success_count": successCount,
			"failed_count":  len(req.DeviceIDs) - successCount,
			"failed":        failed,
		},
	})
}

// GetDeviceStatus 獲取設備狀態
// @Router /api/quest/devices/:id/status [get]
func (c *DeviceController) GetDeviceStatus(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	status, err := c.deviceService.GetDeviceStatus(deviceID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// PingDevice Ping 設備
// @Router /api/quest/devices/:id/ping [post]
func (c *DeviceController) PingDevice(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	latency, err := c.deviceService.PingDevice(deviceID)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   err.Error(),
			"latency": 0,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"latency": latency,
	})
}

// ConnectBatch 批量連接設備
// @Router /api/quest/devices/batch/connect [post]
func (c *DeviceController) ConnectBatch(ctx *gin.Context) {
	var req struct {
		DeviceIDs  []string `json:"device_ids" binding:"required"`
		MaxWorkers int      `json:"max_workers"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	results := c.deviceService.ConnectBatch(req.DeviceIDs, req.MaxWorkers)

	// 統計結果
	successCount := 0
	for _, err := range results {
		if err == nil {
			successCount++
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success":       true,
		"total":         len(req.DeviceIDs),
		"success_count": successCount,
		"failed_count":  len(req.DeviceIDs) - successCount,
		"results":       results,
	})
}

// GetDeviceStatusBatch 批量獲取設備狀態
// @Router /api/quest/devices/batch/status [post]
func (c *DeviceController) GetDeviceStatusBatch(ctx *gin.Context) {
	var req struct {
		DeviceIDs  []string `json:"device_ids" binding:"required"`
		MaxWorkers int      `json:"max_workers"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	results := c.deviceService.GetDeviceStatusBatch(req.DeviceIDs, req.MaxWorkers)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(results),
		"results": results,
	})
}

// PingBatch 批量 Ping 設備
// @Router /api/quest/devices/batch/ping [post]
func (c *DeviceController) PingBatch(ctx *gin.Context) {
	var req struct {
		DeviceIDs  []string `json:"device_ids" binding:"required"`
		MaxWorkers int      `json:"max_workers"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	results := c.deviceService.PingBatch(req.DeviceIDs, req.MaxWorkers)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(results),
		"data":    results,
	})
}
