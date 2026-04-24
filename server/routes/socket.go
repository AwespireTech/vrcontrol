package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

// SetSocketRoutes defines websocket endpoints.
func SetSocketRoutes(router *gin.RouterGroup) {
	router.GET("/client/:clientId", controller.ConnectToRoomSocket)
	router.GET("/control/:roomId", controller.ConnectToRoomControlSocket)
}
