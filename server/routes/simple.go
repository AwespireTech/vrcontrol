package routes

import (
	"github.com/gin-gonic/gin"
	"vrcontrol/server/controller"
)

func SetSimpleControlRoutes(router *gin.RouterGroup) {
	router.GET("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)
	router.GET("/forcemove/:roomId/:clientId/:dest", controller.ForceMove)
	router.GET("/forceallmove/:roomId/:dest", controller.ForceAllMove)
}
