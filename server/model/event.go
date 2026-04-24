package model

type EventType string

const (
	EventMoveCommand       EventType = "move_command"
	EventTypeShotEvent     EventType = "shot_event"
	EventTypeLatern        EventType = "lantern"
	EventTypeQA            EventType = "qa"
	EventTypeAsignSequence EventType = "assign_sequence"
	EventTypeResumeQA      EventType = "resume_qa"
)

type EventMessage struct {
	EventType   EventType            `json:"event_type"`
	MoveCommand *MoveCommandMessage  `json:"move_command,omitempty"`
	ShotEvent   *ShotEventMessage    `json:"shot_event,omitempty"`
	Latern      *LanternEventMessage `json:"lantern,omitempty"`
	QA          *QAEventMessage      `json:"qa,omitempty"`
	Sequence    *int                 `json:"sequence,omitempty"`
}

type MoveCommandMessage struct {
	Force            bool `json:"force"`
	DestinationStage int  `json:"chapter"`
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
	QuestionID int  `json:"question_id"`
	StateID    int  `json:"state_id"`
	State      bool `json:"state"`
}
