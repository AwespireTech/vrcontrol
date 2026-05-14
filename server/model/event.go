package model

type EventType string

const (
	EventMoveCommand       EventType = "move_command"
	EventPlayCommand       EventType = "play_command"
	EventSyncCommand       EventType = "sync_command"
	EventTypeShotEvent     EventType = "shot_event"
	EventTypeLatern        EventType = "lantern"
	EventTypeQA            EventType = "qa"
	EventTypeAsignSequence EventType = "assign_sequence"
	EventTypeResumeQA      EventType = "resume_qa"
	EventTypeConfig        EventType = "config"
)

type EventMessage struct {
	EventType   EventType            `json:"event_type"`
	MoveCommand *MoveCommandMessage  `json:"move_command,omitempty"`
	PlayCommand *PlayCommandMessage  `json:"play_command,omitempty"`
	SyncCommand *SyncCommandMessage  `json:"sync_command,omitempty"`
	ShotEvent   *ShotEventMessage    `json:"shot_event,omitempty"`
	Latern      *LanternEventMessage `json:"lantern,omitempty"`
	QA          *QAEventMessage      `json:"qa,omitempty"`
	Sequence    *int                 `json:"sequence,omitempty"`
	Config      *RoomConfigMessage   `json:"config,omitempty"`
}

type MoveCommandMessage struct {
	Force            bool `json:"force"`
	DestinationStage int  `json:"chapter"`
}

type PlayCommandMessage struct {
	PlayerCount int  `json:"pcnt"`
	IsStart     bool `json:"isstart"`
}

type SyncCommandMessage struct {
	PlayerCount int `json:"pcnt"`
}

type LanternEventMessage struct {
	LanternID int        `json:"lantern_id"`
	LineID    int        `json:"lid"`
	Postions  []Vector3f `json:"postions"`
}

type ShotEventMessage struct {
	SType     int      `json:"type"`
	Position  Vector3f `json:"position"`
	Direction Vector3f `json:"direction"`
}

type QAEventMessage struct {
	QuestionID string            `json:"qid"`
	Answers    map[string]string `json:"answers"`
}

type RoomConfigMessage struct {
	SEED     int    `json:"seed"`
	RoomHash string `json:"rh"`
}
