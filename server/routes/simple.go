package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

// SetSimpleRoutes defines simple control endpoints.
func SetSimpleRoutes(router *gin.RouterGroup) {
	router.GET("/forcemove/:roomId/:clientId/:dest", controller.ForceMove)
	router.GET("/forceallmove/:roomId/:dest", controller.ForceAllMove)
}
