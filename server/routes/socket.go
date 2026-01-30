package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

func SetClientWsRoutes(router *gin.RouterGroup) {
	router.GET("/client/:clientId", controller.ConnectToRoomSocket)
	router.GET("/control/:roomId", controller.ConnectToRoomControlSocket)
}
