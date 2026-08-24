package controller

import (
	"net/http"

	"vrcontrol/server/service"

	"github.com/gin-gonic/gin"
)

// MonitoringController 監控控制器
type MonitoringController struct {
	monitoringService *service.MonitoringService
	connectionService *service.DeviceConnectionService
}

// NewMonitoringController 創建新的監控控制器
func NewMonitoringController(monitoringService *service.MonitoringService, connectionService *service.DeviceConnectionService) *MonitoringController {
	return &MonitoringController{
		monitoringService: monitoringService,
		connectionService: connectionService,
	}
}

// GetStatus 獲取監控服務狀態
func (c *MonitoringController) GetStatus(ctx *gin.Context) {
	isRunning := c.monitoringService.IsRunning()
	health := c.connectionService.Health()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"running":               isRunning,
			"always_on":             true,
			"interval_seconds":      int(c.monitoringService.Interval().Seconds()),
			"last_checked":          health.LastChecked,
			"last_successful_check": health.LastSuccessful,
			"last_error":            health.LastError,
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
	ctx.JSON(http.StatusConflict, gin.H{
		"success": false,
		"error":   "ADB connection monitoring is always on",
	})
}

// SetInterval 設置監控間隔
func (c *MonitoringController) SetInterval(ctx *gin.Context) {
	ctx.JSON(http.StatusConflict, gin.H{
		"success": false,
		"error":   "ADB connection monitoring interval is fixed at 5 seconds",
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
