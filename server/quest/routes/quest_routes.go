package routes

import (
	"log"
	"time"

	"vrcontrol/server/quest/adb"
	"vrcontrol/server/quest/controller"
	"vrcontrol/server/quest/questsocket"
	"vrcontrol/server/quest/repository"
	"vrcontrol/server/quest/scrcpy"
	"vrcontrol/server/quest/service"

	"github.com/gin-gonic/gin"
)

// SetupQuestRoutes 設置 Quest 模組的所有路由
func SetupQuestRoutes(router *gin.Engine, dataDir string) {
	// 初始化 Managers
	adbManager := adb.NewADBManager("", 30*time.Second)
	pingManager := adb.NewPingManager(2 * time.Second)
	socketManager := questsocket.NewSocketManager()
	scrcpyManager := scrcpy.NewManager()

	// 初始化 Repositories
	deviceRepo := repository.NewDeviceRepository(dataDir + "/quest_devices.json")
	roomRepo := repository.NewRoomRepository(dataDir + "/quest_rooms.json")
	actionRepo := repository.NewActionRepository(dataDir + "/quest_actions.json")
	scrcpyConfigRepo := repository.NewScrcpyConfigRepository(dataDir + "/quest_scrcpy_config.json")
	preferenceRepo := repository.NewPreferenceRepository(dataDir + "/quest_preferences.json")

	// 從文件載入已保存的數據
	log.Println("[Quest] 開始載入已保存的數據...")
	if err := deviceRepo.Load(); err != nil {
		log.Printf("[Quest] 警告: 載入設備數據失敗 - %v\n", err)
	} else {
		log.Printf("[Quest] 成功載入 %d 個設備\n", len(deviceRepo.GetAll()))
	}

	if err := roomRepo.Load(); err != nil {
		log.Printf("[Quest] 警告: 載入房間數據失敗 - %v\n", err)
	} else {
		log.Printf("[Quest] 成功載入 %d 個房間\n", len(roomRepo.GetAll()))
	}

	if err := actionRepo.Load(); err != nil {
		log.Printf("[Quest] 警告: 載入動作數據失敗 - %v\n", err)
	} else {
		log.Printf("[Quest] 成功載入 %d 個動作\n", len(actionRepo.GetAll()))
	}

	if err := scrcpyConfigRepo.Load(); err != nil {
		log.Printf("[Quest] 警告: 載入 Scrcpy 配置失敗 - %v\n", err)
	} else {
		log.Println("[Quest] 成功載入 Scrcpy 配置")
	}

	if err := preferenceRepo.Load(); err != nil {
		log.Printf("[Quest] 警告: 載入使用者偏好失敗 - %v\n", err)
		log.Println("[Quest] 將使用記憶體中的預設偏好設定")
	} else {
		pref := preferenceRepo.Get()
		log.Printf("[Quest] 成功載入使用者偏好 (輪詢: %ds, 批大小: %d, 併發: %d)\n",
			pref.PollIntervalSec, pref.BatchSize, pref.MaxConcurrency)
	}

	// 初始化 Services
	deviceService := service.NewDeviceService(deviceRepo, adbManager, pingManager)
	roomService := service.NewRoomService(roomRepo, deviceRepo, socketManager)
	actionService := service.NewActionService(actionRepo, deviceRepo, adbManager)
	monitoringService := service.NewMonitoringService(deviceRepo, pingManager, adbManager, preferenceRepo)
	scrcpyService := service.NewScrcpyService(scrcpyManager, deviceRepo, scrcpyConfigRepo)
	preferenceService := service.NewPreferenceService(preferenceRepo)

	// 啟動時以 ADB 清單校正在線狀態（僅更新 Status）
	deviceService.SyncOnlineStatusFromADBAtStartup()

	// 初始化 Controllers
	deviceController := controller.NewDeviceController(deviceService)
	roomController := controller.NewRoomController(roomService)
	actionController := controller.NewActionController(actionService)
	monitoringController := controller.NewMonitoringController(monitoringService)
	scrcpyController := controller.NewScrcpyController(scrcpyService)
	preferenceController := controller.NewPreferenceController(preferenceService)
	controller.SetQuestRoomService(roomService)

	// Quest API 路由群組
	questAPI := router.Group("/api/quest")
	{
		// 控制 API 路由（Quest 內部副本）
		control := questAPI.Group("/control")
		{
			SetQuestControlRoutes(control)
		}

		// 簡化控制 API 路由（Quest 內部副本）
		simple := questAPI.Group("/simple")
		{
			SetQuestSimpleRoutes(simple)
		}

		// WebSocket 控制路由（Quest 內部副本）
		socket := questAPI.Group("/socket")
		{
			SetQuestSocketRoutes(socket)
		}

		// 設備管理路由
		devices := questAPI.Group("/devices")
		{
			devices.GET("", deviceController.GetAllDevices)
			devices.GET("/:id", deviceController.GetDevice)
			devices.POST("", deviceController.CreateDevice)
			devices.PUT("/:id", deviceController.UpdateDevice)
			devices.PATCH("/:id", deviceController.PatchDevice)
			devices.DELETE("/:id", deviceController.DeleteDevice)
			devices.POST("/:id/connect", deviceController.ConnectDevice)
			devices.POST("/:id/disconnect", deviceController.DisconnectDevice)
			devices.GET("/:id/status", deviceController.GetDeviceStatus)
			devices.POST("/:id/ping", deviceController.PingDevice)
			devices.POST("/batch/connect", deviceController.ConnectBatch)
			devices.POST("/batch/auto-reconnect", deviceController.SetAutoReconnectEnabledBatch)
			devices.POST("/:id/auto-reconnect/reset", deviceController.ResetAutoReconnect)
			devices.POST("/batch/auto-reconnect/reset", deviceController.ResetAutoReconnectBatch)
			devices.POST("/batch/status", deviceController.GetDeviceStatusBatch)
			devices.POST("/batch/ping", deviceController.PingBatch)
		}

		// 房間管理路由
		rooms := questAPI.Group("/rooms")
		{
			rooms.GET("", roomController.GetAllRooms)
			rooms.GET("/:id", roomController.GetRoom)
			rooms.POST("", roomController.CreateRoom)
			rooms.PUT("/:id", roomController.UpdateRoom)
			rooms.PATCH("/:id", roomController.PatchRoom)
			rooms.DELETE("/:id", roomController.DeleteRoom)
			rooms.POST("/:id/devices/:deviceId", roomController.AddDevice)
			rooms.DELETE("/:id/devices/:deviceId", roomController.RemoveDevice)
			rooms.POST("/:id/socket/start", roomController.StartSocket)
			rooms.POST("/:id/socket/stop", roomController.StopSocket)
			rooms.GET("/:id/socket/info", roomController.GetSocketInfo)
			rooms.POST("/:id/parameters/sync", roomController.SyncParameters)
		}

		// 動作管理路由
		actions := questAPI.Group("/actions")
		{
			actions.GET("", actionController.GetAllActions)
			actions.GET("/:id", actionController.GetAction)
			actions.POST("", actionController.CreateAction)
			actions.PUT("/:id", actionController.UpdateAction)
			actions.PATCH("/:id", actionController.PatchAction)
			actions.DELETE("/:id", actionController.DeleteAction)
			actions.POST("/:id/execute", actionController.ExecuteAction)
			actions.POST("/batch/execute", actionController.ExecuteBatch)
		}

		// 監控服務路由
		monitoring := questAPI.Group("/monitoring")
		{
			monitoring.GET("/status", monitoringController.GetStatus)
			monitoring.POST("/start", monitoringController.Start)
			monitoring.POST("/stop", monitoringController.Stop)
			monitoring.POST("/interval", monitoringController.SetInterval)
			monitoring.POST("/run-once", monitoringController.RunOnce)
		}

		// Scrcpy 螢幕鏡像路由
		scrcpyGroup := questAPI.Group("/scrcpy")
		{
			scrcpyGroup.GET("/system-info", scrcpyController.GetSystemInfo)
			scrcpyGroup.POST("/start/:id", scrcpyController.StartScrcpy)
			scrcpyGroup.POST("/stop/:id", scrcpyController.StopScrcpy)
			scrcpyGroup.POST("/batch/start", scrcpyController.StartScrcpyBatch)
			scrcpyGroup.GET("/sessions", scrcpyController.GetSessions)
			scrcpyGroup.POST("/sessions/refresh", scrcpyController.RefreshSessions)
			scrcpyGroup.GET("/config", scrcpyController.GetConfig)
			scrcpyGroup.PUT("/config", scrcpyController.UpdateConfig)
		}

		// 使用者偏好路由
		questAPI.GET("/preferences", preferenceController.GetPreference)
		questAPI.PUT("/preferences", preferenceController.UpdatePreference)
	}
}
