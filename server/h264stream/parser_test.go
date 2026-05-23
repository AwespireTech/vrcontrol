package h264stream

import (
	"bytes"
	"context"
	"testing"
	"time"
)

func TestStreamAccessUnitsWaitsForKeyframeAndInjectsParameters(t *testing.T) {
	data := annexB(
		[]byte{0x67, 0x42, 0x00, 0x1f},
		[]byte{0x68, 0xce, 0x06, 0xe2},
		[]byte{0x41, 0x80, 0x11},
		[]byte{0x09, 0xf0},
		[]byte{0x65, 0x80, 0x22},
		[]byte{0x09, 0xf0},
	)

	units := collectAccessUnits(t, data)
	if len(units) != 1 {
		t.Fatalf("expected 1 access unit, got %d", len(units))
	}
	if !units[0].IsKeyframe {
		t.Fatal("expected first emitted access unit to be a keyframe")
	}
	expected := annexB(
		[]byte{0x67, 0x42, 0x00, 0x1f},
		[]byte{0x68, 0xce, 0x06, 0xe2},
		[]byte{0x65, 0x80, 0x22},
	)
	if !bytes.Equal(units[0].Data, expected) {
		t.Fatalf("unexpected access unit data: %x", units[0].Data)
	}
	if units[0].Duration != time.Second/30 {
		t.Fatalf("unexpected duration: %s", units[0].Duration)
	}
}

func TestStreamAccessUnitsEmitsDeltaAfterKeyframe(t *testing.T) {
	data := annexB(
		[]byte{0x67, 0x42, 0x00, 0x1f},
		[]byte{0x68, 0xce, 0x06, 0xe2},
		[]byte{0x65, 0x80, 0x22},
		[]byte{0x41, 0x80, 0x33},
		[]byte{0x09, 0xf0},
	)

	units := collectAccessUnits(t, data)
	if len(units) != 2 {
		t.Fatalf("expected 2 access units, got %d", len(units))
	}
	if !units[0].IsKeyframe {
		t.Fatal("expected first access unit to be a keyframe")
	}
	if units[1].IsKeyframe {
		t.Fatal("expected second access unit to be a delta frame")
	}
	expectedDelta := annexB([]byte{0x41, 0x80, 0x33})
	if !bytes.Equal(units[1].Data, expectedDelta) {
		t.Fatalf("unexpected delta access unit data: %x", units[1].Data)
	}
}

func collectAccessUnits(t *testing.T, data []byte) []AccessUnit {
	t.Helper()
	var units []AccessUnit
	err := StreamAccessUnits(context.Background(), bytes.NewReader(data), 30, func(unit AccessUnit) error {
		copied := make([]byte, len(unit.Data))
		copy(copied, unit.Data)
		unit.Data = copied
		units = append(units, unit)
		return nil
	})
	if err != nil {
		t.Fatalf("StreamAccessUnits returned error: %v", err)
	}
	return units
}

func annexB(nalus ...[]byte) []byte {
	var result []byte
	for _, nalu := range nalus {
		result = append(result, 0, 0, 0, 1)
		result = append(result, nalu...)
	}
	return result
}