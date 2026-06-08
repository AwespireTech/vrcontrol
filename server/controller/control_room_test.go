package controller

import (
	"path/filepath"
	"testing"

	"vrcontrol/server/model"
	"vrcontrol/server/repository"
	"vrcontrol/server/service"
)

func TestCreateRoomRuntimeHydratesRoomParameters(t *testing.T) {
	tempDir := t.TempDir()
	roomRepo := repository.NewRoomRepository(filepath.Join(tempDir, "rooms.json"))
	if err := roomRepo.Load(); err != nil {
		t.Fatalf("load room repository: %v", err)
	}

	room := &model.Room{
		RoomID: "ROOM-001",
		Parameters: map[string]any{
			"theme": "forest",
			"layout": map[string]any{
				"size": "small",
			},
		},
	}
	if err := roomRepo.Create(room); err != nil {
		t.Fatalf("create room: %v", err)
	}

	roomService := service.NewRoomService(roomRepo, nil)
	oldRoomServiceRef := roomServiceRef
	oldActivityServiceRef := activityServiceRef
	roomServiceRef = roomService
	activityServiceRef = nil
	t.Cleanup(func() {
		roomServiceRef = oldRoomServiceRef
		activityServiceRef = oldActivityServiceRef
	})

	runtimeRoom := createRoomRuntime("ROOM-001")
	if runtimeRoom == nil {
		t.Fatal("expected runtime room to be created")
	}

	if runtimeRoom.Parameters == nil {
		t.Fatal("expected runtime room parameters to be hydrated")
	}
	if got := runtimeRoom.Parameters["theme"]; got != "forest" {
		t.Fatalf("expected hydrated theme %q, got %#v", "forest", got)
	}
	layout, ok := runtimeRoom.Parameters["layout"].(map[string]any)
	if !ok {
		t.Fatalf("expected nested layout map, got %#v", runtimeRoom.Parameters["layout"])
	}
	if got := layout["size"]; got != "small" {
		t.Fatalf("expected hydrated nested size %q, got %#v", "small", got)
	}

	layout["size"] = "large"
	storedRoom, err := roomRepo.GetByID("ROOM-001")
	if err != nil {
		t.Fatalf("get stored room: %v", err)
	}
	storedLayout, ok := storedRoom.Parameters["layout"].(map[string]any)
	if !ok {
		t.Fatalf("expected stored nested layout map, got %#v", storedRoom.Parameters["layout"])
	}
	if got := storedLayout["size"]; got != "small" {
		t.Fatalf("expected stored nested size to remain %q, got %#v", "small", got)
	}
}
