package sockets

import (
	"bytes"
	"encoding/json"
	"log"
	"maps"
	"time"

	"vrcontrol/server/model"
	"vrcontrol/server/utilities"

	"github.com/gorilla/websocket"
)

type Controller struct {
	InChannel      chan []byte
	Room           *Room
	Connection     *websocket.Conn
	UpdateStopChan chan struct{}
}

func (r *Room) GetRoomUpdate() model.RoomUpdate {
	if r == nil {
		log.Println("GetRoomUpdate called on nil room")
		return model.RoomUpdate{
			RoomID:      "",
			PlayerCount: 0,
			Players:     []model.PlayerStatus{},
		}
	}
	if r.Players == nil || len(r.Players) == 0 {
		return model.RoomUpdate{
			RoomID:      r.RoomID,
			PlayerCount: 0,
			Players:     []model.PlayerStatus{},
		}
	}

	return model.RoomUpdate{
		RoomID:      r.RoomID,
		PlayerCount: len(r.Players),
		Players: utilities.Fold2(maps.All(r.Players), make([]model.PlayerStatus, 0, len(r.Players)), func(_l []model.PlayerStatus, p *Player, inuse bool) []model.PlayerStatus {
			if !inuse {
				return _l
			}
			if p == nil {
				return _l
			}
			if p.DeiviceID == "" {
				return _l
			}
			return append(_l, model.PlayerStatus{
				DeviceID:          p.DeiviceID,
				Sequence:          p.Sequence,
				Stage:             p.Stage,
				ReadyToMove:       p.ReadyToMove,
				Message:           p.Message,
				HeadPosition:      p.HeadPosition,
				HeadForward:       p.HeadForward,
				LeftHandPosition:  p.LeftHandPosition,
				LeftHandForward:   p.LeftHandForward,
				RightHandPosition: p.RightHandPosition,
				RightHandForward:  p.RightHandForward,
				LeftHandAvail:     p.LeftHandAvail,
				RightHandAvail:    p.RightHandAvail,
				LastUpdate:        p.LastUpdate,
			})
		}),
	}
}
func HandleControllerConnect(r *Room, conn *websocket.Conn) {
	controller := Controller{
		InChannel:      make(chan []byte, BufferSize),
		Room:           r,
		Connection:     conn,
		UpdateStopChan: make(chan struct{}),
	}
	go controller.read()
	go controller.write()
	go controller.RoomUpdater(controller.UpdateStopChan)
	log.Printf("Controller room %s connected", r.RoomID)
}
func (c *Controller) read() {
	defer c.Connection.Close()
	c.Connection.SetReadLimit(MaxMessageSize)
	c.Connection.SetReadDeadline(time.Now().Add(PongWait))
	c.Connection.SetPongHandler(func(string) error {
		c.Connection.SetReadDeadline(time.Now().Add(PongWait))
		return nil
	})
	for {
		_, message, err := c.Connection.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		message = bytes.TrimSpace(bytes.Replace(message, Newline, Space, -1))
		c.InChannel <- message
		log.Printf("Controller room %s: Received message: %s", c.Room.RoomID, message)
	}
}
func (c *Controller) write() {
	ticker := time.NewTicker(PingPeriod)
	defer func() {
		ticker.Stop()
		c.UpdateStopChan <- struct{}{}
		c.Connection.Close()
	}()
	for {
		select {
		case message, ok := <-c.InChannel:
			if !ok {
				log.Println("Controller channel closed")
				return
			}
			c.Connection.SetWriteDeadline(time.Now().Add(WriteWait))
			if err := c.Connection.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("error: %v", err)
				return
			}
		case <-ticker.C:
			c.Connection.SetWriteDeadline(time.Now().Add(WriteWait))
			if err := c.Connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("error: %v", err)
				return
			}
		}
	}
}
func (c *Controller) RoomUpdater(stop chan struct{}) {
	if c.Room == nil {
		log.Println("RoomUpdater called on nil room")
		return
	}
	ticker := time.NewTicker(time.Second / time.Duration(TickRate))
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			log.Println("RoomUpdater stopped")
			return
		case <-ticker.C:
			roomUpdate := c.Room.GetRoomUpdate()
			if roomUpdate.RoomID == "" {
				log.Println("RoomUpdater: Room ID is empty, skipping update")
				continue
			}
			data, err := json.Marshal(roomUpdate)
			if err != nil {
				log.Printf("RoomUpdater: Error marshalling room update: %v", err)
				continue
			}
			select {
			case c.InChannel <- data:
			default:
				log.Println("RoomUpdater: InChannel is full, diconnecting controller")
				c.Connection.Close()
				return
			}
		}
	}

}
