package sockets

import (
	"bytes"
	"encoding/json"
	"log"
	"time"

	"vrcontrol/server/model"
	"vrcontrol/server/quest/utils"
	"vrcontrol/server/utilities"

	"github.com/gorilla/websocket"
)

type Player struct {
	DeiviceID         string
	StableID          string
	Connection        *websocket.Conn
	Room              *Room
	Stage             int
	ReadyToMove       bool
	InChannel         chan []byte
	Sequence          int
	LastUpdate        time.Time
	Message           string
	HeadPosition      model.Vector3f
	HeadForward       model.Vector3f
	LeftHandPosition  model.Vector3f
	LeftHandForward   model.Vector3f
	RightHandPosition model.Vector3f
	RightHandForward  model.Vector3f
	LeftHandAvail     bool
	RightHandAvail    bool
	StandbyDisconnect chan string
}

func HandlePlayerConnect(conn *websocket.Conn, id string, sdc chan string) *Player {
	player := Player{
		DeiviceID:         id,
		StableID:          id,
		Connection:        conn,
		StandbyDisconnect: sdc,
		LastUpdate:        time.Now(),
	}
	player.InChannel = make(chan []byte, BufferSize)
	go player.read()
	go player.write()
	return &player
}
func (p *Player) read() {
	defer func() {
		if p.Room != nil {
			p.Room.PlayerUnregister <- p
		} else {
			log.Printf("Player %s disconnected before being assigned to a room.", p.DeiviceID)
		}
		p.StandbyDisconnect <- p.StableID
		p.Connection.Close()
	}()
	p.Connection.SetReadLimit(MaxMessageSize)
	p.Connection.SetReadDeadline(time.Now().Add(PongWait))
	p.Connection.SetPongHandler(func(string) error { p.Connection.SetReadDeadline(time.Now().Add(PongWait)); return nil })
	for {
		_, message, err := p.Connection.ReadMessage()

		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		message = bytes.TrimSpace(bytes.Replace(message, Newline, Space, -1))
		if p.Room == nil {
			log.Printf("Player %s is in standby, message receeived: %s", p.DeiviceID, string(message))
			// If the player is not in a room, we just log the message and continue
			continue
		}
		var playerMessage model.PlayerMessage
		err = json.Unmarshal(message, &playerMessage)
		if err != nil {
			log.Println("Error Unmarshalling Message: ", err)
			continue
		}
		switch playerMessage.MessageType {
		case model.MessageTypeHeartbeat:
			heartbeat := playerMessage.Heartbeat
			p.HeadPosition = heartbeat.HeadPosition
			p.HeadForward = heartbeat.HeadForward
			p.LeftHandPosition = heartbeat.LeftHandPostion
			p.LeftHandForward = heartbeat.LeftHandForward
			p.RightHandPosition = heartbeat.RightHandPostion
			p.RightHandForward = heartbeat.RightHandForward
			p.LeftHandAvail = heartbeat.LeftHandAvail
			p.RightHandAvail = heartbeat.RightHandAvail
			p.Stage = heartbeat.Stage
			p.DeiviceID = utils.NormalizeDeviceIDKey(heartbeat.DeviceID)
			p.Message = heartbeat.Message
			p.LastUpdate = utilities.TicksToDateTime(heartbeat.Timestamp)
		case model.MessageTypeReadyToMove:
			readyToMove := playerMessage.ReadyToMove
			p.Stage = readyToMove.Stage
			p.DeiviceID = utils.NormalizeDeviceIDKey(readyToMove.DeviceID)
			// p.ReadyToMove = true
			p.ReadyToMove = readyToMove.Stage > 0

			mov, action := MovementCheck(p.Room, p, p.Stage)
			if action {
				p.Room.MoveControl <- mov
			}

		default:
			// Other is broadcast message
			// Send to the room
			p.Room.PlayerBroadcast <- message
		}

	}
}
func (p *Player) write() {
	ticker := time.NewTicker(PingPeriod)
	defer func() {
		ticker.Stop()
		p.Connection.Close()
	}()

	for {
		select {
		case message, ok := <-p.InChannel:
			p.Connection.SetWriteDeadline(time.Now().Add(WriteWait))
			if !ok {
				// The hub closed the channel.
				p.Connection.WriteMessage(websocket.CloseMessage, []byte{})
				return
			} else {
				err := p.Connection.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Println("Error: ", err)
					break
				}
			}
		case <-ticker.C:
			p.Connection.SetWriteDeadline(time.Now().Add(WriteWait))
			if err := p.Connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}

	}
}
