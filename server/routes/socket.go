package routes

import (
	"github.com/gin-gonic/gin"
	"vrcontrol/server/controller"
)

func SetClientWsRoutes(router *gin.RouterGroup) {
	router.GET("/client/:clientId", controller.ConnectToRoomSocket)
	router.GET("/control/:roomId", controller.ConnectToRoomControlSocket)
}
