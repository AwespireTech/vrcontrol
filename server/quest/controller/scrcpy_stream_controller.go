package controller

import (
	"encoding/json"
	"net/http"
	"time"

	"vrcontrol/server/quest/service"

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

	session, err := c.streamService.StartStream(deviceID)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("start_failed"))
		return
	}
	defer session.Stop()

	if headerBytes, err := json.Marshal(session.Header); err == nil {
		_ = conn.WriteMessage(websocket.TextMessage, headerBytes)
	}

	buf := make([]byte, 64*1024)
	for {
		n, readErr := session.Read(buf)
		if n > 0 {
			_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				break
			}
		}
		if readErr != nil {
			break
		}
	}
}
