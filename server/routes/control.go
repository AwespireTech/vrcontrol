package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

// SetControlRoutes defines control endpoints.
func SetControlRoutes(router *gin.RouterGroup) {
	// Support both POST and GET methods for the same endpoint
	router.POST("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)
	router.GET("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)

	router.GET("/roomlist", controller.GetRoomList)
	router.GET("/lantern/:roomId/:roomHash", controller.GetLanternJson)
}
