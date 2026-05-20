package sockets

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"vrcontrol/server/model"
	"vrcontrol/server/service"
	"vrcontrol/server/utils"
)

type MessageType string
type ControlSignalType string

const (
	MessageTypeUpdate          MessageType       = "update"
	ControlSignalTypeSeqUpdate ControlSignalType = "seq_update"
)

type SnapShot struct {
	Type int
}
type Movement struct {
	Force            bool
	DestinationStage int
	Target           string
	Broadcast        bool
}
type SyncChapter struct {
	StayStage   int
	PlayerCount int
}
type PlayCommander struct {
	IsStart bool
}
type Room struct {
	RoomID           string
	ActivityService  *service.ActivityService
	PlayerBroadcast  chan []byte
	PlayerRegister   chan *Player
	PlayerUnregister chan *Player
	PlayerDetach     chan *Player
	MoveControl      chan Movement
	SyncControl      chan SyncChapter
	SnapShotControl  chan SnapShot
	PlayCommander    chan PlayCommander
	Signals          chan ControlSignal
	Players          map[*Player]bool
	AssignedSequence map[string]int
	// 核心狀態：紀錄所有題目的回答狀況
	// key1: qID (題目ID)
	// key2: DeviceID (玩家ID)
	// value: aID (答案ID)
	Answers map[string]map[string]string
	// 活動期間的 lantern 事件暫存；正式保存會在 Activity 結束時寫入 artifact。
	LanternData map[string][]*model.LanternEventMessage
	// 紀錄題目是否已經結束/鎖定 (true 表示不能再改答案)
	QuestionLocked map[string]bool
	// 標記某個題目的狀態是否被修改過，避免沒人動也一直廣播
	isDirty         bool
	currentQID      string // 目前正在進行的題目
	CurrentActivity *RoomActivityRuntime
}

type RoomActivityRuntime struct {
	ActivityID      string
	Name            string
	Status          model.ActivityStatus
	Seed            int
	StartedAt       *time.Time
	ActivityContext model.ActivityContext
	EventCounts     map[string]int
	Participants    map[string]bool
	LastEventAt     *time.Time
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
		SyncControl:      make(chan SyncChapter),
		SnapShotControl:  make(chan SnapShot),
		PlayCommander:    make(chan PlayCommander),
		Signals:          make(chan ControlSignal),
		Answers:          make(map[string]map[string]string),
		LanternData:      make(map[string][]*model.LanternEventMessage),
		QuestionLocked:   make(map[string]bool),
	}
	room.AssignedSequence = make(map[string]int)
	return room
}

func (r *Room) SetActivityService(svc *service.ActivityService) {
	r.ActivityService = svc
}

func (r *Room) StartActivity(activity *model.Activity) error {
	if activity == nil {
		return fmt.Errorf("activity is required")
	}
	if r.CurrentActivity != nil && r.CurrentActivity.Status == model.ActivityStatusRunning {
		return logErrorf("room %s already has a running activity", r.RoomID)
	}
	r.flushQAData()
	r.clearLanternData()
	startedAt := activity.StartedAt
	if startedAt == nil {
		now := time.Now()
		startedAt = &now
	}
	r.CurrentActivity = &RoomActivityRuntime{
		ActivityID:      activity.ActivityID,
		Name:            activity.Name,
		Status:          model.ActivityStatusRunning,
		Seed:            activitySeed(activity),
		StartedAt:       startedAt,
		ActivityContext: cloneRoomActivityContext(activity.ActivityContext),
		EventCounts:     make(map[string]int),
		Participants:    make(map[string]bool),
	}
	r.refreshActivityParticipants()
	r.BroadcastConfig()
	return nil
}

func (r *Room) EndActivity() *model.ActivitySummary {
	if r.CurrentActivity == nil {
		return nil
	}
	summary := r.BuildActivitySummary()
	r.CurrentActivity = nil
	r.flushQAData()
	r.clearLanternData()
	r.BroadcastConfig()
	return summary
}

func (r *Room) BuildActivitySummary() *model.ActivitySummary {
	if r.CurrentActivity == nil {
		return nil
	}
	summary := &model.ActivitySummary{
		ParticipantCount: len(r.CurrentActivity.Participants),
		EventCounts:      make(map[string]int, len(r.CurrentActivity.EventCounts)),
	}
	for key, value := range r.CurrentActivity.EventCounts {
		summary.EventCounts[key] = value
	}
	if r.CurrentActivity.StartedAt != nil {
		summary.DurationSec = int64(time.Since(*r.CurrentActivity.StartedAt).Seconds())
	}
	return summary
}

func (r *Room) GetCurrentActivityContext() model.ActivityContext {
	if r.CurrentActivity == nil {
		return model.DefaultActivityContext()
	}
	return cloneRoomActivityContext(r.CurrentActivity.ActivityContext)
}

func (r *Room) HasRunningActivity() bool {
	return r.CurrentActivity != nil && r.CurrentActivity.Status == model.ActivityStatusRunning
}

func activitySeed(activity *model.Activity) int {
	if activity == nil || activity.RuntimeSnapshot == nil {
		return 0
	}
	return activity.RuntimeSnapshot.Seed
}

func (r *Room) recordActivityEvent(eventType string) {
	if r.CurrentActivity == nil || r.CurrentActivity.Status != model.ActivityStatusRunning {
		return
	}
	r.CurrentActivity.EventCounts[eventType]++
	now := time.Now()
	r.CurrentActivity.LastEventAt = &now
	if r.ActivityService != nil {
		if _, err := r.ActivityService.AppendEventStats(r.CurrentActivity.ActivityID, eventType, 1); err != nil {
			log.Println("Error updating activity event stats:", err)
		}
	}
}

func (r *Room) refreshActivityParticipants() {
	if r.CurrentActivity == nil {
		return
	}
	r.CurrentActivity.Participants = make(map[string]bool)
	for player := range r.Players {
		if player == nil {
			continue
		}
		participantID := utils.NormalizeDeviceIDKey(player.DeiviceID)
		if participantID == "" {
			participantID = utils.NormalizeDeviceIDKey(player.StableID)
		}
		if participantID == "" {
			continue
		}
		r.CurrentActivity.Participants[participantID] = true
	}
}

func cloneRoomActivityContext(context model.ActivityContext) model.ActivityContext {
	if context == nil {
		return model.DefaultActivityContext()
	}
	bytes, err := json.Marshal(context)
	if err != nil {
		cloned := make(model.ActivityContext, len(context))
		for key, value := range context {
			cloned[key] = value
		}
		return cloned
	}
	var cloned model.ActivityContext
	if err := json.Unmarshal(bytes, &cloned); err != nil {
		fallback := make(model.ActivityContext, len(context))
		for key, value := range context {
			fallback[key] = value
		}
		return fallback
	}
	return cloned
}

func cloneRoomActivityContextValue(value any) any {
	if value == nil {
		return nil
	}
	bytes, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var cloned any
	if err := json.Unmarshal(bytes, &cloned); err != nil {
		return value
	}
	return cloned
}

func (r *Room) BuildQASnapshot(activityID string) *model.ActivityQAResult {
	if activityID == "" {
		return nil
	}
	if len(r.Answers) == 0 && len(r.QuestionLocked) == 0 && r.currentQID == "" {
		return nil
	}

	answers := make(map[string]map[string]string, len(r.Answers))
	for questionID, questionAnswers := range r.Answers {
		answers[questionID] = make(map[string]string, len(questionAnswers))
		for deviceID, answerID := range questionAnswers {
			answers[questionID][deviceID] = answerID
		}
	}

	questionLocked := make(map[string]bool, len(r.QuestionLocked))
	for questionID, locked := range r.QuestionLocked {
		questionLocked[questionID] = locked
	}

	var qaContext any
	if r.CurrentActivity != nil && r.CurrentActivity.ActivityID == activityID {
		qaContext = cloneRoomActivityContextValue(r.CurrentActivity.ActivityContext["qa"])
	}

	return &model.ActivityQAResult{
		ActivityID:     activityID,
		RoomID:         r.RoomID,
		CurrentQID:     r.currentQID,
		Answers:        answers,
		QuestionLocked: questionLocked,
		QAContext:      qaContext,
		CapturedAt:     time.Now(),
	}
}

func (r *Room) BuildLanternSnapshot(activityID string) *model.ActivityLanternResult {
	if activityID == "" || len(r.LanternData) == 0 {
		return nil
	}

	events := make(map[string][]*model.LanternEventMessage, len(r.LanternData))
	for deviceID, deviceEvents := range r.LanternData {
		if len(deviceEvents) == 0 {
			continue
		}
		events[deviceID] = make([]*model.LanternEventMessage, len(deviceEvents))
		copy(events[deviceID], deviceEvents)
	}
	if len(events) == 0 {
		return nil
	}

	return &model.ActivityLanternResult{
		ActivityID: activityID,
		RoomID:     r.RoomID,
		Events:     events,
		CapturedAt: time.Now(),
	}
}

func (r *Room) buildConfigMessage() model.EventMessage {
	config := &model.RoomConfigMessage{
		RoomID: r.RoomID,
	}
	if r.CurrentActivity != nil && r.CurrentActivity.Status == model.ActivityStatusRunning {
		config.ActivityID = r.CurrentActivity.ActivityID
		config.ActivityContextPath = fmt.Sprintf("/api/activities/%s/context", r.CurrentActivity.ActivityID)
		config.Seed = r.CurrentActivity.Seed
	}
	return model.EventMessage{
		EventType: model.EventTypeConfig,
		Config:    config,
	}
}

func (r *Room) sendConfigToPlayer(player *Player) bool {
	if player == nil {
		return false
	}
	message, err := json.Marshal(r.buildConfigMessage())
	if err != nil {
		log.Println("Error Marshalling Event Message: ", err)
		return false
	}
	select {
	case player.InChannel <- message:
		return true
	default:
		log.Println("Player Channel is full, disconnecting player")
		return false
	}
}

func (r *Room) BroadcastConfig() {
	for player := range r.Players {
		if r.sendConfigToPlayer(player) {
			continue
		}
		r.PlayerUnregister <- player
	}
}

func logErrorf(format string, args ...any) error {
	err := fmt.Errorf(format, args...)
	log.Println(err)
	return err
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
			r.refreshActivityParticipants()
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
			if !r.sendConfigToPlayer(player) {
				r.PlayerUnregister <- player
			}
		case player := <-r.PlayerUnregister:
			if _, ok := r.Players[player]; ok {
				delete(r.Players, player)
				r.refreshActivityParticipants()
				log.Println("Player Unregistered: ", player.DeiviceID)
				close(player.InChannel)
				if len(r.Players) == 0 {
					if !r.HasRunningActivity() {
						r.flushQAData()
						r.clearLanternData()
					}
					updater = false
					updaterChannel <- struct{}{}
					log.Println("Updater Stopped")
				}
			}
		case player := <-r.PlayerDetach:
			if _, ok := r.Players[player]; ok {
				delete(r.Players, player)
				r.refreshActivityParticipants()
				player.Room = nil
				log.Println("Player Detached: ", player.DeiviceID)
				if len(r.Players) == 0 {
					if !r.HasRunningActivity() {
						r.flushQAData()
						r.clearLanternData()
					}
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
			case model.MessageTypeWaitToSync:
				// Should be handled in Player
				log.Panicln("WaitToSync should be handled in Player")
			case model.MessageTypePlayStatus:
				log.Panicln("PlayStatus should be handled in Player")
			case model.MessageTypeShotEvent:
				r.recordActivityEvent(string(model.EventTypeShotEvent))
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
				r.recordActivityEvent(string(model.EventTypeLatern))
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
				if r.HasRunningActivity() {
					r.LanternData[senderIDKey] = append(r.LanternData[senderIDKey], eventMessage.Latern)
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
						player.ReadyToMove = false
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
		case syn := <-r.SyncControl:
			for player := range r.Players {
				if player == nil {
					continue
				} else {
					eventMessage := model.EventMessage{
						EventType: model.EventSyncCommand,
						SyncCommand: &model.SyncCommandMessage{
							PlayerCount: syn.PlayerCount,
						},
					}
					message, err := json.Marshal(eventMessage)
					if err != nil {
						log.Println("Error Marshalling Event Message: ", err)
						continue
					}
					player.WaitToSync = false
					// Send the message to all players
					select {
					case player.InChannel <- message:
					default:
						log.Println("Player Channel is full, disconnecting player")
						r.PlayerUnregister <- player
					}
				}
			}
		case spshot := <-r.SnapShotControl:
			// spshot.Type TBD, but here only acknowledges the snapshot coordination.
			if spshot.Type > 0 {
				log.Println("Room Snap Shot acknowledged")
				if !r.HasRunningActivity() {
					r.flushQAData()
					r.clearLanternData()
				}
			}
		case play := <-r.PlayCommander:
			for player := range r.Players {
				if player == nil {
					continue
				} else {
					eventMessage := model.EventMessage{
						EventType: model.EventPlayCommand,
						PlayCommand: &model.PlayCommandMessage{
							PlayerCount: len(r.Players),
							IsStart:     play.IsStart,
						},
					}
					message, err := json.Marshal(eventMessage)
					if err != nil {
						log.Println("Error Marshalling Event Message: ", err)
						continue
					}
					player.WaitToSync = false
					// Send the message to all players
					select {
					case player.InChannel <- message:
					default:
						log.Println("Player Channel is full, disconnecting player")
						r.PlayerUnregister <- player
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

func (r *Room) clearLanternData() {
	r.LanternData = make(map[string][]*model.LanternEventMessage)
}
func (r *Room) flushQAData() {
	// Release Memory by GO's GC
	r.Answers = make(map[string]map[string]string)
	r.QuestionLocked = make(map[string]bool)

	// Reset Flags
	r.currentQID = ""
	r.isDirty = false
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
			// 檢查QA是否有資料變更
			if r.isDirty && r.currentQID != "" {
				currentQStats := r.Answers[r.currentQID]
				qID := r.currentQID

				qaEventMessage := model.EventMessage{
					EventType: model.EventTypeQA,
					QA: &model.QAEventMessage{
						QuestionID: qID,
						Answers:    currentQStats,
					},
				}

				messageBytes, err := json.Marshal(qaEventMessage)
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
				r.isDirty = false
			}
			// ----- End QA Part
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
