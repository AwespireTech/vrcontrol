package consts

import (
	"log"
	"os"
	"strconv"
	"time"
)

// Sockets Variables
var (
	// Time allowed to write a message to the peer.
	WriteWait = 2 * time.Second

	// Time allowed to read the next pong message from the peer.
	PongWait = 8 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	PingPeriod = (PongWait * 9) / 10

	// Maximum message size allowed from peer.
	MaxMessageSize = 1024

	BufferSize = MaxMessageSize * 32

	// Ticks per second.
	TickRate = 1
)

func init() {
	// Initialize any constants or variables if needed
	_writeWait := os.Getenv("SOCKET_WRITE_WAIT")
	if _writeWait != "" {
		if duration, err := time.ParseDuration(_writeWait); err == nil {
			WriteWait = duration * time.Second
		}
	}
	_pongWait := os.Getenv("SOCKET_PONG_WAIT")
	if _pongWait != "" {
		if duration, err := time.ParseDuration(_pongWait); err == nil {
			PongWait = duration * time.Second
			PingPeriod = (PongWait * 9) / 10
		}
	}
	_maxMessageSize := os.Getenv("SOCKET_MAX_MESSAGE_SIZE")
	if _maxMessageSize != "" {
		if size, err := time.ParseDuration(_maxMessageSize); err == nil {
			MaxMessageSize = int(size)
			BufferSize = MaxMessageSize * 32
		}
	}
	_tickRate := os.Getenv("SOCKET_TICK_RATE")
	if _tickRate != "" {
		if rate, err := strconv.Atoi(_tickRate); err == nil {
			if rate > 0 {
				TickRate = rate
			} else {
				log.Printf("invalid SOCKET_TICK_RATE %q: must be > 0; using default %d", _tickRate, TickRate)
			}
		} else {
			log.Printf("invalid SOCKET_TICK_RATE %q: %v; using default %d", _tickRate, err, TickRate)
		}
	}
}
