package controller

import (
	"net/http"

	"vrcontrol/server/model"
	"vrcontrol/server/service"

	"github.com/gin-gonic/gin"
)

// ActionController 動作控制器
type ActionController struct {
	actionService *service.ActionService
}

// NewActionController 創建新的動作控制器
func NewActionController(actionService *service.ActionService) *ActionController {
	return &ActionController{
		actionService: actionService,
	}
}

// GetAllActions 獲取所有動作
func (c *ActionController) GetAllActions(ctx *gin.Context) {
	actions := c.actionService.GetAllActions()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    actions,
	})
}

// GetAction 獲取單個動作
func (c *ActionController) GetAction(ctx *gin.Context) {
	actionID := ctx.Param("id")

	action, err := c.actionService.GetAction(actionID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    action,
	})
}

// CreateAction 創建新動作
func (c *ActionController) CreateAction(ctx *gin.Context) {
	var action model.Action
	if err := ctx.ShouldBindJSON(&action); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := c.actionService.CreateAction(&action); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    action,
		"message": "Action created successfully",
	})
}

// UpdateAction 更新動作
func (c *ActionController) UpdateAction(ctx *gin.Context) {
	actionID := ctx.Param("id")

	var action model.Action
	if err := ctx.ShouldBindJSON(&action); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	action.ActionID = actionID

	if err := c.actionService.UpdateAction(&action); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    action,
		"message": "Action updated successfully",
	})
}

// PatchAction 局部更新動作（嚴格白名單）
// @Router /api/actions/:id [patch]
func (c *ActionController) PatchAction(ctx *gin.Context) {
	actionID := ctx.Param("id")

	var req service.ActionPatch
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	updated, err := c.actionService.PatchAction(actionID, req)
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
		"message": "Action updated successfully",
	})
}

// DeleteAction 刪除動作
func (c *ActionController) DeleteAction(ctx *gin.Context) {
	actionID := ctx.Param("id")

	if err := c.actionService.DeleteAction(actionID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Action deleted successfully",
	})
}

// ExecuteAction 執行動作
func (c *ActionController) ExecuteAction(ctx *gin.Context) {
	actionID := ctx.Param("id")

	var req struct {
		DeviceID string `json:"device_id" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	result, err := c.actionService.ExecuteAction(actionID, req.DeviceID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": result.Success,
		"data":    result,
	})
}

// ExecuteBatch 批量執行動作
func (c *ActionController) ExecuteBatch(ctx *gin.Context) {
	var req struct {
		ActionID   string   `json:"action_id" binding:"required"`
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

	results := c.actionService.ExecuteActionBatch(req.ActionID, req.DeviceIDs, req.MaxWorkers)

	// 統計結果
	successCount := 0
	for _, result := range results {
		if result.Success {
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
