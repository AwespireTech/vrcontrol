package controller

import (
	"net/http"
	"time"

	"vrcontrol/server/quest/service"

	"github.com/gin-gonic/gin"
)

// MonitoringController 監控控制器
type MonitoringController struct {
	monitoringService *service.MonitoringService
}

// NewMonitoringController 創建新的監控控制器
func NewMonitoringController(monitoringService *service.MonitoringService) *MonitoringController {
	return &MonitoringController{
		monitoringService: monitoringService,
	}
}

// GetStatus 獲取監控服務狀態
func (c *MonitoringController) GetStatus(ctx *gin.Context) {
	isRunning := c.monitoringService.IsRunning()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"running": isRunning,
		},
		// Backward compatibility: keep legacy top-level `running` for older clients/scripts.
		"running": isRunning,
	})
}

// Start 啟動監控服務
func (c *MonitoringController) Start(ctx *gin.Context) {
	if err := c.monitoringService.Start(); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Monitoring service started",
	})
}

// Stop 停止監控服務
func (c *MonitoringController) Stop(ctx *gin.Context) {
	c.monitoringService.Stop()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Monitoring service stopped",
	})
}

// SetInterval 設置監控間隔
func (c *MonitoringController) SetInterval(ctx *gin.Context) {
	var req struct {
		Interval int `json:"interval" binding:"required,min=1"` // 秒
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid interval value",
		})
		return
	}

	c.monitoringService.SetInterval(time.Duration(req.Interval) * time.Second)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Monitoring interval updated",
	})
}

// RunOnce 手動執行一次監控
func (c *MonitoringController) RunOnce(ctx *gin.Context) {
	c.monitoringService.MonitorOnce()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Monitoring executed once",
	})
}
