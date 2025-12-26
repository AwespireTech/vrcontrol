package routes

import (
	"github.com/gin-gonic/gin"
	"vrcontrol/server/controller"
)

func SetControlRoute(router *gin.RouterGroup) {
	//Support both POST and GET methods for the same endpoint
	router.POST("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)
	router.GET("/assignseq/:roomId/:clientId/:seq", controller.AssignSequence)

	router.POST("/assignroomandseq/:clientId/:roomId/:seq", controller.AssignRoomAndSeq)
	router.GET("/assignroomandseq/:clientId/:roomId/:seq", controller.AssignRoomAndSeq)

	router.POST("/createroom/:roomId", controller.CreateRoom)
	router.GET("/createroom/:roomId", controller.CreateRoom)

	router.GET("/roomlist", controller.GetRoomList)
	router.GET("/playerlist", controller.GetUnassignedPlayers)
}
