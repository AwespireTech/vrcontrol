package model

import "time"

type TargetType string

const (
	TargetBroadcast TargetType = "broadcast"
	TargetDevice    TargetType = "device"
	TargetServer    TargetType = "server"
)

type Control struct {
	TargetID   string     `json:"target_id"`
	TargetType TargetType `json:"target_type"`
	Command    string     `json:"command"`
	Args       []string   `json:"args"`
	Timestamp  int64      `json:"timestamp"`
	SourceID   string     `json:"source_id"`
}

type RoomUpdate struct {
	RoomID      string         `json:"room_id"`
	Players     []PlayerStatus `json:"players"`
	PlayerCount int            `json:"player_count"`
}

type PlayerStatus struct {
	DeviceID          string    `json:"device_id"`
	Stage             int       `json:"chapter"`
	Sequence          int       `json:"sequence"`
	ReadyToMove       bool      `json:"ready_to_move"`
	LeftHandPosition  Vector3f  `json:"left_hand_position"`
	LeftHandForward   Vector3f  `json:"left_hand_forward"`
	RightHandPosition Vector3f  `json:"right_hand_position"`
	RightHandForward  Vector3f  `json:"right_hand_forward"`
	LeftHandAvail     bool      `json:"left_hand_available"`
	RightHandAvail    bool      `json:"right_hand_available"`
	HeadPosition      Vector3f  `json:"head_position"`
	HeadForward       Vector3f  `json:"head_forward"`
	LastUpdate        time.Time `json:"last_update"`
}
