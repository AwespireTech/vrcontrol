package sockets

import "testing"

func TestControllerStopRoomUpdaterIsIdempotent(t *testing.T) {
	controller := &Controller{UpdateStopChan: make(chan struct{})}

	controller.stopRoomUpdater()
	controller.stopRoomUpdater()

	select {
	case <-controller.UpdateStopChan:
	default:
		t.Fatal("expected update stop channel to be closed")
	}
}
