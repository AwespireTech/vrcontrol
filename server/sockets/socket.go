package sockets

import (
	"net/http"

	questconsts "vrcontrol/server/consts"

	"github.com/gorilla/websocket"
)

var (
	// Time allowed to write a message to the peer.
	WriteWait = questconsts.WriteWait

	// Time allowed to read the next pong message from the peer.
	PongWait = questconsts.PongWait

	// Send pings to peer with this period. Must be less than pongWait.
	PingPeriod = questconsts.PingPeriod

	// Maximum message size allowed from peer.
	MaxMessageSize = int64(questconsts.MaxMessageSize)

	BufferSize = questconsts.BufferSize

	//Tick Per Second
	TickRate = questconsts.TickRate

	Newline = []byte{'\n'}
	Space   = []byte{' '}
)

var SocketUpgrader = websocket.Upgrader{
	ReadBufferSize:  BufferSize,
	WriteBufferSize: BufferSize,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}
