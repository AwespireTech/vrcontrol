package routes

import (
	"vrcontrol/server/controller"

	"github.com/gin-gonic/gin"
)

// SetQuestControlRoutes defines Quest control endpoints (copied from base control routes).
func SetQuestControlRoutes(router *gin.RouterGroup) {
	// Support both POST and GET methods for the same endpoint
	router.POST("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)
	router.GET("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)

	router.GET("/roomlist", controller.GetRoomList)
}
