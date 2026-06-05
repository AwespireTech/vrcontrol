package service

import (
	"testing"
	"time"

	"vrcontrol/server/h264stream"
	"vrcontrol/server/scrcpy"
)

func TestStreamSubscriptionClosePreventsFurtherEnqueue(t *testing.T) {
	subscription := &StreamSubscription{
		DeviceID: "device-1",
		Header:   scrcpy.StreamHeader{FPS: 30},
		ch:       make(chan h264stream.AccessUnit, 1),
	}
	subscription.Units = subscription.ch

	subscription.Close()
	subscription.Close()

	if ok := subscription.enqueue(h264stream.AccessUnit{Data: []byte{0x01}, Duration: time.Millisecond}); ok {
		t.Fatal("expected enqueue to fail after subscription close")
	}
}

func TestDeviceStreamSourceBroadcastRemovesOverflowingSubscriber(t *testing.T) {
	source := &deviceStreamSource{
		session:     &scrcpy.StreamSession{DeviceID: "device-1"},
		subscribers: map[uint64]*StreamSubscription{},
	}

	overflowing := &StreamSubscription{
		DeviceID:         "device-1",
		id:               1,
		source:           source,
		ch:               make(chan h264stream.AccessUnit),
		awaitingKeyframe: false,
	}
	overflowing.Units = overflowing.ch

	healthy := &StreamSubscription{
		DeviceID:         "device-1",
		id:               2,
		source:           source,
		ch:               make(chan h264stream.AccessUnit, 1),
		awaitingKeyframe: false,
	}
	healthy.Units = healthy.ch

	source.subscribers[overflowing.id] = overflowing
	source.subscribers[healthy.id] = healthy

	if err := source.broadcast(h264stream.AccessUnit{Data: []byte{0x01}, Duration: time.Millisecond, IsKeyframe: true}); err != nil {
		t.Fatalf("broadcast failed: %v", err)
	}

	if _, ok := source.subscribers[overflowing.id]; ok {
		t.Fatal("expected overflowing subscriber to be removed")
	}
	if _, ok := source.subscribers[healthy.id]; !ok {
		t.Fatal("expected healthy subscriber to remain registered")
	}
}
