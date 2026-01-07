package controller

import (
	"net/http"

	"vrcontrol/server/quest/model"
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
	var pref model.UserPreference
	if err := ctx.ShouldBindJSON(&pref); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	if err := c.preferenceService.Update(&pref); err != nil {
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
