package routes

import (
	"log"
	"time"

	"vrcontrol/server/adb"
	"vrcontrol/server/consts"
	"vrcontrol/server/controller"
	"vrcontrol/server/repository"
	"vrcontrol/server/scrcpy"
	"vrcontrol/server/service"

	"github.com/gin-gonic/gin"
)

// SetupRoutes 設置 API 路由
func SetupRoutes(router *gin.Engine, dataDir string) {
	consts.SetLanternDataDir(dataDir + "/lantern")

	// 初始化 Managers
	adbManager := adb.NewADBManager("", 30*time.Second)
	pingManager := adb.NewPingManager(2 * time.Second)
	scrcpyManager := scrcpy.NewManager()
	scrcpyStreamManager := scrcpy.NewStreamManager()

	// 初始化 Repositories
	deviceRepo := repository.NewDeviceRepository(dataDir + "/devices.json")
	roomRepo := repository.NewRoomRepository(dataDir + "/rooms.json")
	actionRepo := repository.NewActionRepository(dataDir + "/actions.json")
	scrcpyConfigRepo := repository.NewScrcpyConfigRepository(dataDir + "/scrcpy_config.json")
	preferenceRepo := repository.NewPreferenceRepository(dataDir + "/preferences.json")

	// 從文件載入已保存的數據
	log.Println("[API] 開始載入已保存的數據...")
	if err := deviceRepo.Load(); err != nil {
		log.Printf("[API] 警告: 載入設備數據失敗 - %v\n", err)
	} else {
		log.Printf("[API] 成功載入 %d 個設備\n", len(deviceRepo.GetAll()))
	}

	if err := roomRepo.Load(); err != nil {
		log.Printf("[API] 警告: 載入房間數據失敗 - %v\n", err)
	} else {
		log.Printf("[API] 成功載入 %d 個房間\n", len(roomRepo.GetAll()))
	}

	if err := actionRepo.Load(); err != nil {
		log.Printf("[API] 警告: 載入動作數據失敗 - %v\n", err)
	} else {
		log.Printf("[API] 成功載入 %d 個動作\n", len(actionRepo.GetAll()))
	}

	if err := scrcpyConfigRepo.Load(); err != nil {
		log.Printf("[API] 警告: 載入 Scrcpy 配置失敗 - %v\n", err)
	} else {
		log.Println("[API] 成功載入 Scrcpy 配置")
	}

	if err := preferenceRepo.Load(); err != nil {
		log.Printf("[API] 警告: 載入使用者偏好失敗 - %v\n", err)
		log.Println("[API] 將使用記憶體中的預設偏好設定")
	} else {
		pref := preferenceRepo.Get()
		log.Printf("[API] 成功載入使用者偏好 (輪詢: %ds, 批大小: %d, 併發: %d)\n",
			pref.PollIntervalSec, pref.BatchSize, pref.MaxConcurrency)
	}

	// 初始化 Services
	deviceService := service.NewDeviceService(deviceRepo, adbManager, pingManager)
	roomService := service.NewRoomService(roomRepo, deviceRepo)
	actionService := service.NewActionService(actionRepo, deviceRepo, adbManager)
	monitoringService := service.NewMonitoringService(deviceRepo, pingManager, adbManager, preferenceRepo)
	scrcpyService := service.NewScrcpyService(scrcpyManager, deviceRepo, scrcpyConfigRepo)
	scrcpyStreamService := service.NewScrcpyStreamService(scrcpyStreamManager, deviceRepo, scrcpyConfigRepo)
	preferenceService := service.NewPreferenceService(preferenceRepo)

	// 啟動時以 ADB 清單校正在線狀態（僅更新 Status）
	deviceService.SyncOnlineStatusFromADBAtStartup()
	// 啟動時校正 WS 狀態（僅更新狀態欄位，不自動啟動監控）
	deviceService.SyncWSStatusAtStartup()
	roomService.SyncSocketStatusAtStartup()

	// 啟動時以 DeviceIDs 去重並整理房間關聯（不再寫入 assigned_room.json）
	if assigned, err := roomService.ReconcileDeviceAssignmentsByRoomUpdate(); err != nil {
		log.Printf("[API] 整理設備房間關聯失敗: %v\n", err)
	} else {
		log.Printf("[API] 設備房間關聯整理完成: %d 筆\n", len(assigned))
	}

	// 初始化 Controllers
	deviceController := controller.NewDeviceController(deviceService, roomService)
	roomController := controller.NewRoomController(roomService)
	actionController := controller.NewActionController(actionService)
	monitoringController := controller.NewMonitoringController(monitoringService)
	scrcpyController := controller.NewScrcpyController(scrcpyService)
	scrcpyStreamController := controller.NewScrcpyStreamController(scrcpyStreamService)
	webrtcStreamController := controller.NewWebRTCStreamController(scrcpyStreamService)
	preferenceController := controller.NewPreferenceController(preferenceService)
	controller.SetRoomService(roomService)
	controller.SetDeviceService(deviceService)

	// API 路由群組
	api := router.Group("/api")
	{
		// 控制 API 路由
		control := api.Group("/control")
		{
			SetControlRoutes(control)
		}

		// 簡化控制 API 路由
		simple := api.Group("/simple")
		{
			SetSimpleRoutes(simple)
		}

		// WebSocket 控制路由
		socket := api.Group("/ws")
		{
			SetSocketRoutes(socket)
			socket.GET("/webrtc/:deviceId", webrtcStreamController.Stream)
		}

		// 設備管理路由
		devices := api.Group("/devices")
		{
			devices.GET("", deviceController.GetAllDevices)
			devices.GET("/isolation", controller.GetIsolationDevices)
			devices.GET("/usb", deviceController.GetUSBDevices)
			devices.GET("/:id", deviceController.GetDevice)
			devices.POST("", deviceController.CreateDevice)
			devices.PUT("/:id", deviceController.UpdateDevice)
			devices.PATCH("/:id", deviceController.PatchDevice)
			devices.DELETE("/:id", deviceController.DeleteDevice)
			devices.POST("/usb/tcpip/enable", deviceController.EnableUSBDeviceTCPIP)
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
		rooms := api.Group("/rooms")
		{
			rooms.GET("", roomController.GetAllRooms)
			rooms.GET("/:id", roomController.GetRoom)
			rooms.POST("", roomController.CreateRoom)
			rooms.PUT("/:id", roomController.UpdateRoom)
			rooms.PATCH("/:id", roomController.PatchRoom)
			rooms.DELETE("/:id", roomController.DeleteRoom)
			rooms.POST("/:id/devices/:deviceId", roomController.AddDevice)
			rooms.DELETE("/:id/devices/:deviceId", roomController.RemoveDevice)
		}

		// 動作管理路由
		actions := api.Group("/actions")
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
		monitoring := api.Group("/monitoring")
		{
			monitoring.GET("/status", monitoringController.GetStatus)
			monitoring.POST("/start", monitoringController.Start)
			monitoring.POST("/stop", monitoringController.Stop)
			monitoring.POST("/interval", monitoringController.SetInterval)
			monitoring.POST("/run-once", monitoringController.RunOnce)
		}

		// Scrcpy 螢幕鏡像路由
		scrcpyGroup := api.Group("/scrcpy")
		{
			scrcpyGroup.GET("/system-info", scrcpyController.GetSystemInfo)
			scrcpyGroup.POST("/start/:id", scrcpyController.StartScrcpy)
			scrcpyGroup.POST("/stop/:id", scrcpyController.StopScrcpy)
			scrcpyGroup.POST("/batch/start", scrcpyController.StartScrcpyBatch)
			scrcpyGroup.GET("/sessions", scrcpyController.GetSessions)
			scrcpyGroup.POST("/sessions/refresh", scrcpyController.RefreshSessions)
			scrcpyGroup.GET("/config", scrcpyController.GetConfig)
			scrcpyGroup.PUT("/config", scrcpyController.UpdateConfig)
			scrcpyGroup.GET("/stream/:id", scrcpyStreamController.Stream)
		}

		// 使用者偏好路由
		api.GET("/preferences", preferenceController.GetPreference)
		api.PUT("/preferences", preferenceController.UpdatePreference)
	}
}
