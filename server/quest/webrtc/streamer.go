package webrtc

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"io"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/rtp/codecs"
	pion "github.com/pion/webrtc/v3"
)

const (
	h264PayloadType = 96
	h264ClockRate   = 90000
	maxAnnexBBuffer = 2 * 1024 * 1024
	rtpMTU          = 1200
)

func StreamH264(ctx context.Context, reader io.Reader, track *pion.TrackLocalStaticRTP, fps int) error {
	if fps <= 0 {
		fps = 30
	}

	ssrc := randomUint32()
	packetizer := rtp.NewPacketizer(
		rtpMTU,
		h264PayloadType,
		ssrc,
		&codecs.H264Payloader{},
		rtp.NewRandomSequencer(),
		h264ClockRate,
	)

	timestamp := uint32(0)
	timestampStep := uint32(h264ClockRate / fps)

	buffer := make([]byte, 0, maxAnnexBBuffer)
	chunk := make([]byte, 4096)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := reader.Read(chunk)
		if n > 0 {
			buffer = append(buffer, chunk[:n]...)
		}

		for {
			start := findStartCode(buffer, 0)
			if start < 0 {
				buffer = trimAnnexBBuffer(buffer)
				break
			}

			next := findStartCode(buffer, start+3)
			if next < 0 {
				if start > 0 {
					buffer = buffer[start:]
				}
				buffer = trimAnnexBBuffer(buffer)
				break
			}

			startCodeSize := 3
			if start+3 < len(buffer) && buffer[start+2] == 0 && buffer[start+3] == 1 {
				startCodeSize = 4
			}

			nalu := buffer[start+startCodeSize : next]
			if len(nalu) > 0 {
				packets := packetizer.Packetize(nalu, timestamp)
				for _, pkt := range packets {
					if writeErr := track.WriteRTP(pkt); writeErr != nil {
						return writeErr
					}
				}

				nalType := nalu[0] & 0x1f
				if nalType != 7 && nalType != 8 {
					timestamp += timestampStep
				}
			}

			buffer = buffer[next:]
		}

		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
	}
}

func findStartCode(data []byte, start int) int {
	for i := start; i+3 < len(data); i += 1 {
		if data[i] == 0 && data[i+1] == 0 && data[i+2] == 1 {
			return i
		}
		if data[i] == 0 && data[i+1] == 0 && data[i+2] == 0 && data[i+3] == 1 {
			return i
		}
	}
	return -1
}

func trimAnnexBBuffer(buffer []byte) []byte {
	if len(buffer) <= maxAnnexBBuffer {
		return buffer
	}
	if start := findStartCode(buffer, len(buffer)-maxAnnexBBuffer); start >= 0 {
		return buffer[start:]
	}
	return buffer[len(buffer)-maxAnnexBBuffer:]
}

func randomUint32() uint32 {
	var b [4]byte
	if _, err := rand.Read(b[:]); err == nil {
		return binary.LittleEndian.Uint32(b[:])
	}
	return uint32(time.Now().UnixNano())
}
