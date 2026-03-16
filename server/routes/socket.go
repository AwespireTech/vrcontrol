package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

// SetQuestSocketRoutes defines Quest websocket endpoints (copied from base socket routes).
func SetQuestSocketRoutes(router *gin.RouterGroup) {
	router.GET("/client/:clientId", controller.ConnectToRoomSocket)
	router.GET("/control/:roomId", controller.ConnectToRoomControlSocket)
}
