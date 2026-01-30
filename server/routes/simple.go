package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

func SetSimpleControlRoutes(router *gin.RouterGroup) {
	router.GET("/forcemove/:roomId/:clientId/:dest", controller.ForceMove)
	router.GET("/forceallmove/:roomId/:dest", controller.ForceAllMove)
}
