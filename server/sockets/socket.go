package sockets

import (
	"net/http"

	"github.com/gorilla/websocket"
	"vrcontrol/server/consts"
)

var (
	// Time allowed to write a message to the peer.
	WriteWait = consts.WriteWait

	// Time allowed to read the next pong message from the peer.
	PongWait = consts.PongWait

	// Send pings to peer with this period. Must be less than pongWait.
	PingPeriod = consts.PingPeriod

	// Maximum message size allowed from peer.
	MaxMessageSize = int64(consts.MaxMessageSize)

	BufferSize = consts.BufferSize

	//Tick Per Second
	TickRate = consts.TickRate

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
