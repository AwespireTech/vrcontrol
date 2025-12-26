package model

type MessageType string

const (
	MessageTypeHeartbeat   MessageType = "heartbeat"
	MessageTypeReadyToMove MessageType = "ready_to_move"
	MessageTypeShotEvent   MessageType = "shot_event"
	MessageTypeLantern     MessageType = "lantern"
	MessagesTypeQA         MessageType = "qa"
	MessageTypeResumeQA    MessageType = "resume_qa"
)

type Vector3f struct {
	X float32 `json:"x"`
	Y float32 `json:"y"`
	Z float32 `json:"z"`
}

type PlayerMessage struct {
	MessageType MessageType  `json:"message_type"`
	Heartbeat   *Heartbeat   `json:"heartbeat,omitempty"`
	ShotEvent   *ShotEvent   `json:"shot_event,omitempty"`
	Latern      *Lantern     `json:"lantern,omitempty"`
	ReadyToMove *ReadyToMove `json:"ready_to_move,omitempty"`
	QA          *QA          `json:"qa,omitempty"`
	ResumeQA    *bool        `json:"resume_qa,omitempty"`
}

type Heartbeat struct {
	Timestamp        int64    `json:"timestamp"`
	DeviceID         string   `json:"device_id"`
	Stage            int      `json:"chapter"`
	Message          string   `json:"message"`
	HeadPosition     Vector3f `json:"head_position"`
	HeadForward      Vector3f `json:"head_forward,omitempty"`
	LeftHandPostion  Vector3f `json:"left_hand_position"`
	LeftHandForward  Vector3f `json:"left_hand_forward,omitempty"`
	RightHandPostion Vector3f `json:"right_hand_position"`
	RightHandForward Vector3f `json:"right_hand_forward,omitempty"`
	LeftHandAvail    bool     `json:"left_hand_available"`
	RightHandAvail   bool     `json:"right_hand_available"`
}
type ShotEvent struct {
	Timestamp int64    `json:"timestamp"`
	DeviceID  string   `json:"device_id"`
	Position  Vector3f `json:"position"`
	Direction Vector3f `json:"direction"`
}
type Lantern struct {
	Timestamp int64      `json:"timestamp"`
	DeviceID  string     `json:"device_id"`
	LanternID int        `json:"lantern_id"`
	Postions  []Vector3f `json:"postions"`
}
type ReadyToMove struct {
	Timestamp int64  `json:"timestamp"`
	DeviceID  string `json:"device_id"`
	Stage     int    `json:"chapter"`
}
type QA struct {
	QuestionID int  `json:"question_id"`
	StateBool  bool `json:"state_bool"`
	StateInt   int  `json:"state_int"`
}
