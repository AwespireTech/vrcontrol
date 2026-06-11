package service

import (
	"path/filepath"
	"testing"

	"vrcontrol/server/model"
	"vrcontrol/server/repository"
)

func TestGetRunningActivityByRoomReturnsRunningActivity(t *testing.T) {
	tempDir := t.TempDir()
	repo := repository.NewActivityRepository(filepath.Join(tempDir, "activities.json"))
	if err := repo.Load(); err != nil {
		t.Fatalf("load repository: %v", err)
	}

	svc := NewActivityService(repo, filepath.Join(tempDir, "activities"))
	activity := &model.Activity{
		RoomID:          "room-1",
		Name:            "Restore Test",
		ActivityContext: model.DefaultActivityContext(),
	}

	if err := svc.CreateDraft(activity); err != nil {
		t.Fatalf("create draft: %v", err)
	}

	if _, err := svc.StartActivity(activity.ActivityID, &model.ActivityRuntimeInfo{Seed: 7, PlayerCount: 1}); err != nil {
		t.Fatalf("start activity: %v", err)
	}

	found, err := svc.GetRunningActivityByRoom("room-1")
	if err != nil {
		t.Fatalf("get running activity: %v", err)
	}
	if found == nil {
		t.Fatal("expected running activity but got nil")
	}
	if found.ActivityID != activity.ActivityID {
		t.Fatalf("expected activity %s, got %s", activity.ActivityID, found.ActivityID)
	}
	if found.Status != model.ActivityStatusRunning {
		t.Fatalf("expected running status, got %s", found.Status)
	}
}
