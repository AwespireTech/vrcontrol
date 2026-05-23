package controller

import (
	"encoding/json"
	"net/http"
	"time"

	"vrcontrol/server/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type ScrcpyStreamController struct {
	streamService *service.ScrcpyStreamService
}

func NewScrcpyStreamController(streamService *service.ScrcpyStreamService) *ScrcpyStreamController {
	return &ScrcpyStreamController{streamService: streamService}
}

var scrcpyStreamUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (c *ScrcpyStreamController) Stream(ctx *gin.Context) {
	deviceID := ctx.Param("id")

	conn, err := scrcpyStreamUpgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	subscription, err := c.streamService.SubscribeStream(deviceID)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("start_failed"))
		return
	}
	defer subscription.Close()

	if headerBytes, err := json.Marshal(subscription.Header); err == nil {
		_ = conn.WriteMessage(websocket.TextMessage, headerBytes)
	}

	for accessUnit := range subscription.Units {
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if err := conn.WriteMessage(websocket.BinaryMessage, accessUnit.Data); err != nil {
			break
		}
	}
}
