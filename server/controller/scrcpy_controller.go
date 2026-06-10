package controller

import (
	"net/http"

	"vrcontrol/server/model"
	"vrcontrol/server/repository"
	"vrcontrol/server/scrcpy"

	"github.com/gin-gonic/gin"
)

// ScrcpyController handles scrcpy configuration HTTP requests.
type ScrcpyController struct {
	configRepo *repository.ScrcpyConfigRepository
}

// NewScrcpyController creates a new scrcpy controller
func NewScrcpyController(configRepo *repository.ScrcpyConfigRepository) *ScrcpyController {
	return &ScrcpyController{
		configRepo: configRepo,
	}
}

// GetConfig returns the current scrcpy configuration
// GET /api/scrcpy/config
func (c *ScrcpyController) GetConfig(ctx *gin.Context) {
	config, err := c.configRepo.Get()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed_to_get_config",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    config,
	})
}

// UpdateConfig updates the scrcpy configuration
// PUT /api/scrcpy/config
func (c *ScrcpyController) UpdateConfig(ctx *gin.Context) {
	var config model.ScrcpyConfig
	if err := ctx.ShouldBindJSON(&config); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid_config",
			"message": err.Error(),
		})
		return
	}

	if err := scrcpy.ValidateBitrate(config.Bitrate); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid_bitrate",
			"message": "bitrate must be a positive integer with an optional k or M suffix",
		})
		return
	}

	if err := c.configRepo.Update(&config); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed_to_update_config",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Configuration updated successfully",
	})
}
