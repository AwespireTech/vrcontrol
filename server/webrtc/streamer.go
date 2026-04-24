package webrtc

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"time"

	pion "github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
)

const (
	maxAnnexBBuffer = 2 * 1024 * 1024
	readPollTimeout = 500 * time.Millisecond
)

func StreamH264(ctx context.Context, reader io.Reader, track *pion.TrackLocalStaticSample, fps int) error {
	if fps <= 0 {
		fps = 30
	}
	frameDuration := time.Second / time.Duration(fps)
	streamStartedAt := time.Now()

	buffer := make([]byte, 0, maxAnnexBBuffer)
	accessUnitNALUs := make([][]byte, 0, 8)
	accessUnitHasVCL := false
	chunk := make([]byte, 4096)
	firstPacketAt := time.Time{}
	firstPacketDeadline := time.Now().Add(8 * time.Second)
	firstDataAt := time.Time{}
	firstIDRAt := time.Time{}
	lastNoStartCodeWarn := time.Time{}
	lastKeyframeWaitWarn := time.Time{}
	framesSent := 0
	var latestSPS []byte
	var latestPPS []byte
	hasSentKeyframe := false
	statsTicker := time.NewTicker(1 * time.Second)
	defer statsTicker.Stop()
	defer func() {
		if len(accessUnitNALUs) == 0 {
			return
		}
		if _, _, flushErr := flushAccessUnit(track, accessUnitNALUs, latestSPS, latestPPS, frameDuration, hasSentKeyframe); flushErr == nil {
			return
		}
	}()

	deadlineReader, hasReadDeadline := reader.(interface{ SetReadDeadline(time.Time) error })

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-statsTicker.C:
			if !firstPacketAt.IsZero() {
				log.Printf("[WebRTC][stream] frames/s=%d", framesSent)
			}
			framesSent = 0
		default:
		}

		if firstPacketAt.IsZero() && time.Now().After(firstPacketDeadline) {
			return fmt.Errorf("no H264 packets produced within startup timeout")
		}

		if hasReadDeadline {
			_ = deadlineReader.SetReadDeadline(time.Now().Add(readPollTimeout))
		}

		n, err := reader.Read(chunk)
		if hasReadDeadline {
			_ = deadlineReader.SetReadDeadline(time.Time{})
		}
		if n > 0 {
			if firstDataAt.IsZero() {
				firstDataAt = time.Now()
				log.Printf("[WebRTC][stream] first source bytes after=%s", firstDataAt.Sub(streamStartedAt).Truncate(10*time.Millisecond))
			}
			buffer = append(buffer, chunk[:n]...)
		}

		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			if err == io.EOF {
				return nil
			}
			return err
		}

		if firstPacketAt.IsZero() && len(buffer) >= 128*1024 && findStartCode(buffer, 0) < 0 {
			if lastNoStartCodeWarn.IsZero() || time.Since(lastNoStartCodeWarn) >= 1*time.Second {
				log.Printf("[WebRTC][stream] no Annex-B start code yet, buffered=%d bytes", len(buffer))
				lastNoStartCodeWarn = time.Now()
			}
			if !firstDataAt.IsZero() && time.Since(firstDataAt) >= 3*time.Second && len(buffer) >= 256*1024 {
				return fmt.Errorf("invalid_h264_annexb_stream")
			}
		}

		if !firstDataAt.IsZero() && !hasSentKeyframe && time.Since(firstDataAt) >= 2*time.Second {
			if lastKeyframeWaitWarn.IsZero() || time.Since(lastKeyframeWaitWarn) >= 2*time.Second {
				log.Printf(
					"[WebRTC][stream] waiting for first keyframe source_age=%s stream_age=%s buffered=%d",
					time.Since(firstDataAt).Truncate(10*time.Millisecond),
					time.Since(streamStartedAt).Truncate(10*time.Millisecond),
					len(buffer),
				)
				lastKeyframeWaitWarn = time.Now()
			}
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
				nalType := nalu[0] & 0x1f
				if nalType == 5 && firstIDRAt.IsZero() {
					firstIDRAt = time.Now()
					if firstDataAt.IsZero() {
						log.Printf("[WebRTC][stream] first IDR detected after=%s", firstIDRAt.Sub(streamStartedAt).Truncate(10*time.Millisecond))
					} else {
						log.Printf(
							"[WebRTC][stream] first IDR detected stream_after=%s source_after=%s",
							firstIDRAt.Sub(streamStartedAt).Truncate(10*time.Millisecond),
							firstIDRAt.Sub(firstDataAt).Truncate(10*time.Millisecond),
						)
					}
				}

				switch nalType {
				case 7:
					latestSPS = append(latestSPS[:0], nalu...)
				case 8:
					latestPPS = append(latestPPS[:0], nalu...)
				}

				if nalType == 9 {
					if len(accessUnitNALUs) > 0 {
						written, sentKeyframe, writeErr := flushAccessUnit(track, accessUnitNALUs, latestSPS, latestPPS, frameDuration, hasSentKeyframe)
						if writeErr != nil {
							return writeErr
						}
						framesSent += written
						if !firstPacketAt.IsZero() || written == 0 {
						} else {
							firstPacketAt = time.Now()
							log.Printf(
								"[WebRTC][stream] first sample sent stream_after=%s source_after=%s",
								firstPacketAt.Sub(streamStartedAt).Truncate(10*time.Millisecond),
								firstPacketAt.Sub(firstDataAt).Truncate(10*time.Millisecond),
							)
						}
						if sentKeyframe {
							if !hasSentKeyframe {
								keyframeAt := time.Now()
								log.Printf(
									"[WebRTC][stream] first keyframe sample sent stream_after=%s source_after=%s",
									keyframeAt.Sub(streamStartedAt).Truncate(10*time.Millisecond),
									keyframeAt.Sub(firstDataAt).Truncate(10*time.Millisecond),
								)
							}
							hasSentKeyframe = true
						}
					}
					accessUnitNALUs = accessUnitNALUs[:0]
					accessUnitHasVCL = false
					buffer = buffer[next:]
					continue
				}

				if isVCLNALUType(nalType) {
					newPicture := isNewPictureNALU(nalu)
					if accessUnitHasVCL && newPicture {
						written, sentKeyframe, writeErr := flushAccessUnit(track, accessUnitNALUs, latestSPS, latestPPS, frameDuration, hasSentKeyframe)
						if writeErr != nil {
							return writeErr
						}
						framesSent += written
						if !firstPacketAt.IsZero() || written == 0 {
						} else {
							firstPacketAt = time.Now()
							log.Printf(
								"[WebRTC][stream] first sample sent stream_after=%s source_after=%s",
								firstPacketAt.Sub(streamStartedAt).Truncate(10*time.Millisecond),
								firstPacketAt.Sub(firstDataAt).Truncate(10*time.Millisecond),
							)
						}
						if sentKeyframe {
							if !hasSentKeyframe {
								keyframeAt := time.Now()
								log.Printf(
									"[WebRTC][stream] first keyframe sample sent stream_after=%s source_after=%s",
									keyframeAt.Sub(streamStartedAt).Truncate(10*time.Millisecond),
									keyframeAt.Sub(firstDataAt).Truncate(10*time.Millisecond),
								)
							}
							hasSentKeyframe = true
						}
						accessUnitNALUs = accessUnitNALUs[:0]
					}
					accessUnitHasVCL = true
				}

				accessUnitNALUs = append(accessUnitNALUs, append([]byte(nil), nalu...))
			}

			buffer = buffer[next:]
		}

	}
}

func flushAccessUnit(track *pion.TrackLocalStaticSample, nalus [][]byte, latestSPS, latestPPS []byte, duration time.Duration, hasSentKeyframe bool) (int, bool, error) {
	if len(nalus) == 0 {
		return 0, hasSentKeyframe, nil
	}

	containsIDR := false
	containsSPS := false
	containsPPS := false
	for _, nalu := range nalus {
		if len(nalu) == 0 {
			continue
		}
		switch nalu[0] & 0x1f {
		case 5:
			containsIDR = true
		case 7:
			containsSPS = true
		case 8:
			containsPPS = true
		}
	}

	if !hasSentKeyframe && !containsIDR {
		return 0, false, nil
	}

	accessUnit := make([]byte, 0, 4096)
	appendNALU := func(nalu []byte) {
		accessUnit = append(accessUnit, 0, 0, 0, 1)
		accessUnit = append(accessUnit, nalu...)
	}

	if containsIDR {
		if !containsSPS && len(latestSPS) > 0 {
			appendNALU(latestSPS)
		}
		if !containsPPS && len(latestPPS) > 0 {
			appendNALU(latestPPS)
		}
	}

	for _, nalu := range nalus {
		if len(nalu) == 0 {
			continue
		}
		appendNALU(nalu)
	}

	if len(accessUnit) == 0 {
		return 0, hasSentKeyframe, nil
	}

	if writeErr := track.WriteSample(media.Sample{Data: accessUnit, Duration: duration}); writeErr != nil {
		return 0, hasSentKeyframe, writeErr
	}

	return 1, hasSentKeyframe || containsIDR, nil
}

func isVCLNALUType(nalType byte) bool {
	return nalType == 1 || nalType == 2 || nalType == 5
}

func isNewPictureNALU(nalu []byte) bool {
	if len(nalu) < 2 {
		return false
	}
	firstMB, ok := readUE(removeEmulationBytes(nalu[1:]), 0)
	if !ok {
		return false
	}
	return firstMB == 0
}

func removeEmulationBytes(data []byte) []byte {
	result := make([]byte, 0, len(data))
	zeroCount := 0
	for _, b := range data {
		if zeroCount == 2 && b == 0x03 {
			zeroCount = 0
			continue
		}
		result = append(result, b)
		if b == 0 {
			zeroCount += 1
		} else {
			zeroCount = 0
		}
	}
	return result
}

func readUE(data []byte, bitOffset int) (uint, bool) {
	zeroBits := 0
	for {
		bit, ok := readBit(data, bitOffset)
		if !ok {
			return 0, false
		}
		bitOffset += 1
		if bit == 1 {
			break
		}
		zeroBits += 1
	}

	suffix := uint(0)
	for i := 0; i < zeroBits; i++ {
		bit, ok := readBit(data, bitOffset)
		if !ok {
			return 0, false
		}
		bitOffset += 1
		suffix = (suffix << 1) | uint(bit)
	}

	return uint((1<<zeroBits)-1) + suffix, true
}

func readBit(data []byte, bitOffset int) (byte, bool) {
	byteIndex := bitOffset / 8
	if byteIndex >= len(data) {
		return 0, false
	}
	shift := 7 - (bitOffset % 8)
	return (data[byteIndex] >> shift) & 0x01, true
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
