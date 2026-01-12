package controller

import (
	"net/http"
	"vrcontrol/server/quest/service"

	"github.com/gin-gonic/gin"
)

// PreferenceController 使用者偏好控制器
type PreferenceController struct {
	preferenceService *service.PreferenceService
}

// NewPreferenceController 創建新的偏好控制器
func NewPreferenceController(preferenceService *service.PreferenceService) *PreferenceController {
	return &PreferenceController{
		preferenceService: preferenceService,
	}
}

// GetPreference 獲取使用者偏好
// @Router /api/quest/preferences [get]
func (c *PreferenceController) GetPreference(ctx *gin.Context) {
	pref := c.preferenceService.Get()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    pref,
	})
}

// UpdatePreference 更新使用者偏好
// @Router /api/quest/preferences [put]
func (c *PreferenceController) UpdatePreference(ctx *gin.Context) {
	var req struct {
		PollIntervalSec      *int `json:"poll_interval_sec"`
		BatchSize            *int `json:"batch_size"`
		MaxConcurrency       *int `json:"max_concurrency"`
		ReconnectCooldownSec *int `json:"reconnect_cooldown_sec"`
		ReconnectMaxRetries  *int `json:"reconnect_max_retries"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	// merge: 現有值 + request(可部分)
	pref := c.preferenceService.Get()
	if req.PollIntervalSec != nil {
		pref.PollIntervalSec = *req.PollIntervalSec
	}
	if req.BatchSize != nil {
		pref.BatchSize = *req.BatchSize
	}
	if req.MaxConcurrency != nil {
		pref.MaxConcurrency = *req.MaxConcurrency
	}
	if req.ReconnectCooldownSec != nil {
		pref.ReconnectCooldownSec = *req.ReconnectCooldownSec
	}
	if req.ReconnectMaxRetries != nil {
		pref.ReconnectMaxRetries = *req.ReconnectMaxRetries
	}

	if err := c.preferenceService.Update(pref); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    pref,
		"message": "Preference updated successfully",
	})
}
