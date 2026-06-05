package sockets

import (
	"encoding/json"
	"testing"
)

func TestBuildConfigMessageIncludesRoomParameters(t *testing.T) {
	room := &Room{
		RoomID: "ROOM-001",
		Parameters: map[string]any{
			"minimap": map[string]any{"width": 6, "depth": 6},
		},
	}

	message := room.buildConfigMessage()
	if message.Config == nil {
		t.Fatal("expected config message to be populated")
	}

	if message.Config.RoomID != room.RoomID {
		t.Fatalf("expected room_id %q, got %q", room.RoomID, message.Config.RoomID)
	}

	if message.Config.Parameters == nil {
		t.Fatal("expected room parameters to be included in config")
	}

	payload, err := json.Marshal(message)
	if err != nil {
		t.Fatalf("marshal config message: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal config message: %v", err)
	}

	config, ok := decoded["config"].(map[string]any)
	if !ok {
		t.Fatal("expected config field in payload")
	}

	if _, ok := config["parameters"]; !ok {
		t.Fatal("expected parameters field in config payload")
	}
}
