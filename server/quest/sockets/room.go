package sockets

import (
	"encoding/json"
	"log"
	"time"

	"vrcontrol/server/model"
	"vrcontrol/server/quest/utils"
)

type MessageType string
type ControlSignalType string

const (
	MessageTypeUpdate          MessageType       = "update"
	ControlSignalTypeSeqUpdate ControlSignalType = "seq_update"
)

type Movement struct {
	Force            bool
	DestinationStage int
	Target           string
	Broadcast        bool
}
type Room struct {
	RoomID           string
	PlayerBroadcast  chan []byte
	PlayerRegister   chan *Player
	PlayerUnregister chan *Player
	PlayerDetach     chan *Player
	MoveControl      chan Movement
	Signals          chan ControlSignal
	Players          map[*Player]bool
	AssignedSequence map[string]int
}
type RoomMessage struct {
	MessageType         MessageType          `json:"message_type"`
	PlayerPositionInfos []PlayerPositionInfo `json:"pinf"`
	PlayerCount         int                  `json:"pcnt"`
}
type PlayerPositionInfo struct {
	DeviceID          string         `json:"device_id"`
	HeadPosition      model.Vector3f `json:"hpt"`
	HeadForward       model.Vector3f `json:"hfw,omitempty"`
	LeftHandPosition  model.Vector3f `json:"lhp"`
	LeftHandForward   model.Vector3f `json:"lhf,omitempty"`
	RightHandPosition model.Vector3f `json:"rhp"`
	RightHandForward  model.Vector3f `json:"rhf,omitempty"`
	LeftHandAvail     bool           `json:"lha"`
	RightHandAvail    bool           `json:"rha"`
}

type ControlSignal struct {
	Target *Player
	Type   ControlSignalType
	Args   []string
}

func NewRoom(roomID string) *Room {
	room := &Room{
		RoomID:           roomID,
		PlayerBroadcast:  make(chan []byte, 1024),
		PlayerRegister:   make(chan *Player),
		PlayerUnregister: make(chan *Player),
		PlayerDetach:     make(chan *Player),
		Players:          make(map[*Player]bool),
		MoveControl:      make(chan Movement),
		Signals:          make(chan ControlSignal),
	}
	room.AssignedSequence = make(map[string]int)
	return room
}
func (r *Room) Run() {
	updater := false
	updaterChannel := make(chan struct{})
	defer close(updaterChannel)
	for {
		select {
		case player := <-r.PlayerRegister:
			if !updater {
				updater = true
				go r.UpdateInfo(updaterChannel)
				log.Println("Updater Started")
			}
			r.Players[player] = true
			log.Println("Player Registered: ", player.DeiviceID)
			update := r.PlayerSequenceUpdate()
			// Send the player sequence update to the newly registered player
			for _, seqUpdate := range update {
				if seqUpdate.Player == nil {
					continue
				}
				eventMessage := model.EventMessage{
					EventType: model.EventTypeAsignSequence,
					Sequence:  &seqUpdate.Sequence,
				}
				message, err := json.Marshal(eventMessage)
				if err != nil {
					log.Println("Error Marshalling Event Message: ", err)
					continue
				}
				select {
				case seqUpdate.Player.InChannel <- message:
				default:
					log.Println("Player Channel is full, disconnecting player")
					r.PlayerUnregister <- seqUpdate.Player
				}
			}
		case player := <-r.PlayerUnregister:
			if _, ok := r.Players[player]; ok {
				delete(r.Players, player)
				log.Println("Player Unregistered: ", player.DeiviceID)
				close(player.InChannel)
				if len(r.Players) == 0 {
					updater = false
					updaterChannel <- struct{}{}
					log.Println("Updater Stopped")
				}
			}
		case player := <-r.PlayerDetach:
			if _, ok := r.Players[player]; ok {
				delete(r.Players, player)
				player.Room = nil
				log.Println("Player Detached: ", player.DeiviceID)
				if len(r.Players) == 0 {
					updater = false
					updaterChannel <- struct{}{}
					log.Println("Updater Stopped")
				}
			}
		case message := <-r.PlayerBroadcast:
			//Handle Messages from Players

			var playerMessage model.PlayerMessage
			err := json.Unmarshal(message, &playerMessage)
			if err != nil {
				log.Println("Error Unmarshalling Player Message: ", err)
				continue
			}
			switch playerMessage.MessageType {
			case model.MessageTypeHeartbeat:
				// Should be handled in Player
				log.Panicln("Heartbeat should be handled in Player")
			case model.MessageTypeReadyToMove:
				// Should be handled in Player
				log.Panicln("ReadyToMove should be handled in Player")
			case model.MessageTypeShotEvent:
				// Broadcast the shot event to all players
				senderIDKey := utils.NormalizeDeviceIDKey(playerMessage.ShotEvent.DeviceID)
				eventMessage := model.EventMessage{
					EventType: model.EventTypeShotEvent,
					ShotEvent: &model.ShotEventMessage{
						SType:     playerMessage.ShotEvent.SType,
						Position:  playerMessage.ShotEvent.Position,
						Direction: playerMessage.ShotEvent.Direction,
					},
				}
				message, err := json.Marshal(eventMessage)
				if err != nil {
					log.Println("Error Marshalling Event Message: ", err)
					continue
				}
				for player := range r.Players {
					if player == nil || player.DeiviceID == senderIDKey {
						continue
					} else {
						select {
						case player.InChannel <- message:
						default:
							log.Println("Player Channel is full, disconnecting player")
							r.PlayerUnregister <- player
						}
					}
				}
			case model.MessageTypeLantern:
				// Broadcast the lantern event to all players
				senderIDKey := utils.NormalizeDeviceIDKey(playerMessage.Latern.DeviceID)
				eventMessage := model.EventMessage{
					EventType: model.EventTypeLatern,
					Latern: &model.LanternEventMessage{
						LanternID: playerMessage.Latern.LanternID,
						LineID:    playerMessage.Latern.LineID,
						Postions:  playerMessage.Latern.Postions,
					},
				}
				message, err := json.Marshal(eventMessage)
				if err != nil {
					log.Println("Error Marshalling Event Message: ", err)
					continue
				}
				for player := range r.Players {
					if player == nil || player.DeiviceID == senderIDKey {
						continue
					} else {
						select {
						case player.InChannel <- message:
						default:
							log.Println("Player Channel is full, disconnecting player")
							r.PlayerUnregister <- player
						}
					}
				}
			case model.MessagesTypeQA:
				// Broadcast the QA event to all players
				eventMessage := model.EventMessage{
					EventType: model.EventTypeQA,
					QA: &model.QAEventMessage{
						QuestionID: playerMessage.QA.QuestionID,
						StateID:    playerMessage.QA.StateInt,
						State:      playerMessage.QA.StateBool,
					},
				}
				message, err := json.Marshal(eventMessage)
				if err != nil {
					log.Println("Error Marshalling Event Message: ", err)
					continue
				}
				for player := range r.Players {
					if player == nil {
						continue
					} else {
						select {
						case player.InChannel <- message:
						default:
							log.Println("Player Channel is full, disconnecting player")
							r.PlayerUnregister <- player
						}
					}
				}
			case model.MessageTypeResumeQA:
				// Broadcast the resume QA event to all players
				eventMessage := model.EventMessage{
					EventType: model.EventTypeResumeQA,
				}
				message, err := json.Marshal(eventMessage)
				if err != nil {
					log.Println("Error Marshalling Event Message: ", err)
					continue
				}
				for player := range r.Players {
					if player == nil {
						continue
					} else {
						select {
						case player.InChannel <- message:
						default:
							log.Println("Player Channel is full, disconnecting player")
							r.PlayerUnregister <- player
						}
					}
				}

			default:
				//Message not handled
				log.Println("Message not handled: ", playerMessage.MessageType)

			}

		case move := <-r.MoveControl:
			if move.Broadcast {
				for player := range r.Players {
					if player == nil {
						continue
					} else {
						eventMessage := model.EventMessage{
							EventType: model.EventMoveCommand,
							MoveCommand: &model.MoveCommandMessage{
								Force:            move.Force,
								DestinationStage: move.DestinationStage,
							},
						}
						message, err := json.Marshal(eventMessage)
						if err != nil {
							log.Println("Error Marshalling Event Message: ", err)
							continue
						}
						// Send the message to all players
						select {
						case player.InChannel <- message:
						default:
							log.Println("Player Channel is full, disconnecting player")
							r.PlayerUnregister <- player
						}
					}
				}
			} else {
				for player := range r.Players {
					if player == nil {
						continue
					} else if player.DeiviceID == move.Target {
						eventMessage := model.EventMessage{
							EventType: model.EventMoveCommand,
							MoveCommand: &model.MoveCommandMessage{
								Force:            move.Force,
								DestinationStage: move.DestinationStage,
							},
						}
						message, err := json.Marshal(eventMessage)
						if err != nil {
							log.Println("Error Marshalling Event Message: ", err)
							continue
						}
						select {
						case player.InChannel <- message:
						default:
							log.Println("Player Channel is full, disconnecting player")
							r.PlayerUnregister <- player
						}
					}
				}
			}
		case signal := <-r.Signals:
			switch signal.Type {
			case ControlSignalTypeSeqUpdate:
				if signal.Target == nil {
					log.Println("ControlSignalTypeSeqUpdate: Target is nil")
					continue
				}
				// Update the assigned sequence for the player
				normalizedID := utils.NormalizeDeviceIDKey(signal.Target.DeiviceID)
				if seq, ok := r.AssignedSequence[normalizedID]; ok {
					signal.Target.Sequence = seq
					log.Println("ControlSignalTypeSeqUpdate: Player found in AssignedSequence, Sequence: ", seq)
				} else {
					log.Println("ControlSignalTypeSeqUpdate: Player not found in AssignedSequence")
					continue
				}
				// Send the sequence update to the player
				eventMessage := model.EventMessage{
					EventType: model.EventTypeAsignSequence,
					Sequence:  &signal.Target.Sequence,
				}
				message, err := json.Marshal(eventMessage)
				if err != nil {
					log.Println("Error Marshalling Event Message: ", err)
					continue
				}
				select {
				case signal.Target.InChannel <- message:
				default:
					log.Println("Player Channel is full, disconnecting player")
					r.PlayerUnregister <- signal.Target
				}
			}
		}
	}
}
func (r *Room) UpdateInfo(stop chan struct{}) {
	ticker := time.NewTicker(time.Second / time.Duration(TickRate))
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if len(r.Players) == 0 {
				continue
			}
			//Send Player Position Info to all players
			playerPostionInfos := make([]PlayerPositionInfo, 0, len(r.Players))
			for player := range r.Players {
				deviceIDForWire := player.RawDeviceID
				if deviceIDForWire == "" {
					deviceIDForWire = player.DeiviceID
				}
				playerPostionInfos = append(playerPostionInfos, PlayerPositionInfo{
					DeviceID:          deviceIDForWire,
					HeadPosition:      player.HeadPosition,
					HeadForward:       player.HeadForward,
					LeftHandPosition:  player.LeftHandPosition,
					LeftHandForward:   player.LeftHandForward,
					RightHandPosition: player.RightHandPosition,
					RightHandForward:  player.RightHandForward,
					LeftHandAvail:     player.LeftHandAvail,
					RightHandAvail:    player.RightHandAvail,
				})
			}
			roomMessage := RoomMessage{
				MessageType:         MessageTypeUpdate,
				PlayerPositionInfos: playerPostionInfos,
				PlayerCount:         len(r.Players),
			}
			messageBytes, err := json.Marshal(roomMessage)
			if err != nil {
				log.Println("Error Marshalling Room Message: ", err)
				continue
			}
			for player := range r.Players {
				select {
				case player.InChannel <- messageBytes:
				default:
					log.Println("Player Channel is full, disconnecting player")
					r.PlayerUnregister <- player
				}
			}
		}
	}
}
func (r *Room) GetPlayerByDeviceID(deviceID string) *Player {
	normalizedID := utils.NormalizeDeviceIDKey(deviceID)
	for player := range r.Players {
		if utils.NormalizeDeviceIDKey(player.DeiviceID) == normalizedID {
			return player
		}
	}
	return nil
}
