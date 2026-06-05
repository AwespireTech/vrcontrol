package controller

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"vrcontrol/server/h264stream"

	"github.com/pion/webrtc/v3/pkg/media"
)

func TestRunWebRTCStreamForwarderProcessesUnitsAndStops(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	units := make(chan h264stream.AccessUnit, 1)
	units <- h264stream.AccessUnit{Data: []byte{0x01, 0x02}, Duration: time.Millisecond}
	close(units)

	var writeCount atomic.Int32
	runWebRTCStreamForwarder(
		ctx,
		units,
		func() error { return nil },
		func(sample media.Sample) error {
			if len(sample.Data) != 2 {
				t.Fatalf("unexpected sample payload length: %d", len(sample.Data))
			}
			writeCount.Add(1)
			return nil
		},
		func(signalMessage) {},
		"device-1",
	)

	if writeCount.Load() != 1 {
		t.Fatalf("expected one sample write, got %d", writeCount.Load())
	}
}

func TestRunWebRTCStreamForwarderReturnsWhenContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	runWebRTCStreamForwarder(
		ctx,
		make(chan h264stream.AccessUnit),
		func() error { return nil },
		func(media.Sample) error {
			t.Fatal("writeSample should not be called after cancellation")
			return nil
		},
		func(signalMessage) {},
		"device-1",
	)
}
