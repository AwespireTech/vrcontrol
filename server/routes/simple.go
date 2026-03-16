package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

// SetQuestSimpleRoutes defines Quest simple control endpoints (copied from base simple routes).
func SetQuestSimpleRoutes(router *gin.RouterGroup) {
	router.GET("/forcemove/:roomId/:clientId/:dest", controller.ForceMove)
	router.GET("/forceallmove/:roomId/:dest", controller.ForceAllMove)
}
