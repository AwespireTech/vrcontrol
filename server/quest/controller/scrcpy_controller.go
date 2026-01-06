package controller

import (
	"net/http"

	"vrcontrol/server/quest/model"
	"vrcontrol/server/quest/service"

	"github.com/gin-gonic/gin"
)

// ScrcpyController handles scrcpy-related HTTP requests
type ScrcpyController struct {
	scrcpyService *service.ScrcpyService
}

// NewScrcpyController creates a new scrcpy controller
func NewScrcpyController(scrcpyService *service.ScrcpyService) *ScrcpyController {
	return &ScrcpyController{
		scrcpyService: scrcpyService,
	}
}

// GetSystemInfo checks scrcpy installation status
// GET /api/quest/scrcpy/system-info
func (c *ScrcpyController) GetSystemInfo(ctx *gin.Context) {
	info := c.scrcpyService.CheckSystemInfo()
	ctx.JSON(http.StatusOK, info)
}

// StartScrcpy starts a scrcpy session for a device
// POST /api/quest/scrcpy/start/:id
func (c *ScrcpyController) StartScrcpy(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	// Parse optional custom config
	var customConfig *model.ScrcpyConfig
	if err := ctx.ShouldBindJSON(&customConfig); err != nil {
		// If no body or invalid JSON, use default config (customConfig will be nil)
		customConfig = nil
	}

	// Check if scrcpy is installed
	info := c.scrcpyService.CheckSystemInfo()
	if !info.Installed {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "scrcpy_not_installed",
			"message": info.ErrorMessage,
		})
		return
	}

	// Start scrcpy
	if err := c.scrcpyService.StartScrcpy(deviceID, customConfig); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed_to_start_scrcpy",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Scrcpy started successfully",
	})
}

// StopScrcpy stops a scrcpy session for a device
// POST /api/quest/scrcpy/stop/:id
func (c *ScrcpyController) StopScrcpy(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	if err := c.scrcpyService.StopScrcpy(deviceID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed_to_stop_scrcpy",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Scrcpy stopped successfully",
	})
}

// StartScrcpyBatch starts scrcpy sessions for multiple devices
// POST /api/quest/scrcpy/batch/start
func (c *ScrcpyController) StartScrcpyBatch(ctx *gin.Context) {
	var request struct {
		DeviceIDs []string            `json:"device_ids" binding:"required"`
		Config    *model.ScrcpyConfig `json:"config"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// Check if scrcpy is installed
	info := c.scrcpyService.CheckSystemInfo()
	if !info.Installed {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "scrcpy_not_installed",
			"message": info.ErrorMessage,
		})
		return
	}

	results := c.scrcpyService.StartScrcpyBatch(request.DeviceIDs, request.Config)

	// Check if any failed
	hasErrors := len(results) > 0
	successCount := len(request.DeviceIDs) - len(results)

	response := gin.H{
		"success_count": successCount,
		"failed_count":  len(results),
	}

	if hasErrors {
		errorMessages := make(map[string]string)
		for deviceID, err := range results {
			errorMessages[deviceID] = err.Error()
		}
		response["errors"] = errorMessages
	}

	ctx.JSON(http.StatusOK, response)
}

// GetSessions returns all active scrcpy sessions
// GET /api/quest/scrcpy/sessions
func (c *ScrcpyController) GetSessions(ctx *gin.Context) {
	sessions := c.scrcpyService.GetActiveSessions()
	ctx.JSON(http.StatusOK, sessions)
}

// RefreshSessions refreshes the status of all sessions
// POST /api/quest/scrcpy/sessions/refresh
func (c *ScrcpyController) RefreshSessions(ctx *gin.Context) {
	sessions := c.scrcpyService.RefreshSessions()
	ctx.JSON(http.StatusOK, sessions)
}

// GetConfig returns the current scrcpy configuration
// GET /api/quest/scrcpy/config
func (c *ScrcpyController) GetConfig(ctx *gin.Context) {
	config, err := c.scrcpyService.GetConfig()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed_to_get_config",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, config)
}

// UpdateConfig updates the scrcpy configuration
// PUT /api/quest/scrcpy/config
func (c *ScrcpyController) UpdateConfig(ctx *gin.Context) {
	var config model.ScrcpyConfig
	if err := ctx.ShouldBindJSON(&config); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_config",
			"message": err.Error(),
		})
		return
	}

	if err := c.scrcpyService.UpdateConfig(&config); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed_to_update_config",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Configuration updated successfully",
	})
}
