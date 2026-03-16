package controller

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"vrcontrol/server/scrcpy"
	"vrcontrol/server/service"
	questwebrtc "vrcontrol/server/webrtc"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	pion "github.com/pion/webrtc/v3"
)

type WebRTCStreamController struct {
	streamService *service.ScrcpyStreamService
}

func NewWebRTCStreamController(streamService *service.ScrcpyStreamService) *WebRTCStreamController {
	return &WebRTCStreamController{streamService: streamService}
}

type signalMessage struct {
	Type      string                 `json:"type"`
	SDP       string                 `json:"sdp,omitempty"`
	Candidate *pion.ICECandidateInit `json:"candidate,omitempty"`
	Error     string                 `json:"error,omitempty"`
}

var webrtcStreamUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (c *WebRTCStreamController) Stream(ctx *gin.Context) {
	deviceID := ctx.Param("deviceId")

	conn, err := webrtcStreamUpgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	var (
		pc        *pion.PeerConnection
		session   *webrtcSession
		cancel    context.CancelFunc
		writeLock sync.Mutex
		cleanupMu sync.Mutex
		cleanupFn func()
	)

	sendSignal := func(message signalMessage) {
		writeLock.Lock()
		defer writeLock.Unlock()
		_ = conn.WriteJSON(message)
	}

	cleanup := func() {
		cleanupMu.Lock()
		fn := cleanupFn
		cleanupMu.Unlock()
		if fn != nil {
			fn()
		}
	}

	setCleanup := func(next func()) {
		cleanupMu.Lock()
		cleanupFn = next
		cleanupMu.Unlock()
	}

	setCleanup(func() {})

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			cleanup()
			return
		}

		var msg signalMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			sendSignal(signalMessage{Type: "error", Error: "invalid_signal"})
			continue
		}

		switch msg.Type {
		case "offer":
			cleanup()

			once := &sync.Once{}
			setCleanup(func() {
				once.Do(func() {
					if cancel != nil {
						cancel()
						cancel = nil
					}
					if session != nil {
						session.Stop()
						session = nil
					}
					if pc != nil {
						_ = pc.Close()
						pc = nil
					}
				})
			})

			sessionData, err := c.streamService.StartStream(deviceID)
			if err != nil {
				sendSignal(signalMessage{Type: "error", Error: classifyStreamError(err)})
				setCleanup(func() {})
				continue
			}
			session = &webrtcSession{session: sessionData}

			pc, err = newPeerConnection(deviceID, session, sendSignal)
			if err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				setCleanup(func() {})
				continue
			}

			pc.OnConnectionStateChange(func(state pion.PeerConnectionState) {
				switch state {
				case pion.PeerConnectionStateFailed,
					pion.PeerConnectionStateClosed,
					pion.PeerConnectionStateDisconnected:
					cleanup()
				}
			})

			pc.OnICEConnectionStateChange(func(state pion.ICEConnectionState) {
				switch state {
				case pion.ICEConnectionStateFailed,
					pion.ICEConnectionStateClosed,
					pion.ICEConnectionStateDisconnected:
					cleanup()
				}
			})

			if err := pc.SetRemoteDescription(pion.SessionDescription{Type: pion.SDPTypeOffer, SDP: msg.SDP}); err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				setCleanup(func() {})
				continue
			}

			answer, err := pc.CreateAnswer(nil)
			if err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				setCleanup(func() {})
				continue
			}

			if err := pc.SetLocalDescription(answer); err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				setCleanup(func() {})
				continue
			}

			sendSignal(signalMessage{Type: "answer", SDP: answer.SDP})

			// Drain RTCP packets from sender to keep Pion sender feedback path healthy.
			if session.sender != nil {
				go func(sender *pion.RTPSender) {
					buf := make([]byte, 1500)
					for {
						if _, _, readErr := sender.Read(buf); readErr != nil {
							return
						}
					}
				}(session.sender)
			}

			go func(counter *atomic.Int32) {
				timer := time.NewTimer(5 * time.Second)
				defer timer.Stop()
				<-timer.C
				if counter.Load() == 0 {
					log.Printf("[WebRTC][server] no local ICE candidates gathered for device=%s after 5s", deviceID)
				}
			}(session.localCandidateCount)

			streamCtx, cancelFn := context.WithCancel(context.Background())
			cancel = cancelFn
			go func() {
				fps := session.session.Header.FPS
				if err := questwebrtc.StreamH264(streamCtx, session.session, session.track, fps); err != nil && streamCtx.Err() == nil {
					classified := classifyStreamError(err)
					log.Printf("[WebRTC] stream error for %s: %v (%s)", deviceID, err, classified)
					sendSignal(signalMessage{Type: "error", Error: classified})
				}
			}()

		case "ice":
			if pc == nil {
				continue
			}
			if msg.Candidate == nil {
				if err := pc.AddICECandidate(pion.ICECandidateInit{}); err != nil {
					sendSignal(signalMessage{Type: "error", Error: err.Error()})
				}
				continue
			}
			if err := pc.AddICECandidate(*msg.Candidate); err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
			}

		case "close":
			cleanup()
			setCleanup(func() {})
			return
		}
	}
}

func classifyStreamError(err error) string {
	if err == nil {
		return "unknown_stream_error"
	}

	message := strings.ToLower(err.Error())
	switch {
	case strings.Contains(message, "source_server_exited_with_error"):
		return "source_server_exited_with_error"
	case strings.Contains(message, "source_server_exited"):
		return "source_server_exited"
	case strings.Contains(message, "source_backend_not_ready"):
		return "source_backend_not_ready"
	case strings.Contains(message, "source_dummy_byte_error_"):
		return "source_dummy_byte_error"
	case strings.Contains(message, "source_probe_eof"):
		return "source_probe_eof"
	case strings.Contains(message, "source_probe_failed"):
		return "source_probe_failed"
	case strings.Contains(message, "source_connected_but_no_data"):
		return "source_connected_but_no_data"
	case strings.Contains(message, "invalid_h264_annexb_stream"):
		return "invalid_h264_annexb_stream"
	case strings.Contains(message, "no h264 packets produced"):
		return "no_h264_packets"
	default:
		return err.Error()
	}
}

type webrtcSession struct {
	session             *scrcpy.StreamSession
	track               *pion.TrackLocalStaticRTP
	sender              *pion.RTPSender
	localCandidateCount *atomic.Int32
}

func (s *webrtcSession) Stop() {
	if s == nil || s.session == nil {
		return
	}
	s.session.Stop()
}

func newPeerConnection(deviceID string, session *webrtcSession, sendSignal func(signalMessage)) (*pion.PeerConnection, error) {
	mediaEngine := &pion.MediaEngine{}
	if err := mediaEngine.RegisterCodec(pion.RTPCodecParameters{
		RTPCodecCapability: pion.RTPCodecCapability{
			MimeType:     pion.MimeTypeH264,
			ClockRate:    90000,
			SDPFmtpLine:  "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
			RTCPFeedback: nil,
		},
		PayloadType: 96,
	}, pion.RTPCodecTypeVideo); err != nil {
		return nil, err
	}

	settingEngine := pion.SettingEngine{}
	settingEngine.SetNetworkTypes([]pion.NetworkType{
		pion.NetworkTypeUDP4,
		pion.NetworkTypeTCP4,
	})
	api := pion.NewAPI(pion.WithMediaEngine(mediaEngine), pion.WithSettingEngine(settingEngine))
	pc, err := api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		return nil, err
	}

	localCandidateCount := &atomic.Int32{}

	pc.OnICECandidate(func(candidate *pion.ICECandidate) {
		if candidate == nil {
			sendSignal(signalMessage{Type: "ice"})
			log.Printf("[WebRTC][server] end-of-candidates for device=%s", deviceID)
			return
		}
		candidateJSON := candidate.ToJSON()
		localCandidateCount.Add(1)
		log.Printf("[WebRTC][server] local candidate for device=%s: %s", deviceID, candidateJSON.Candidate)
		sendSignal(signalMessage{Type: "ice", Candidate: &candidateJSON})
	})

	pc.OnICEGatheringStateChange(func(state pion.ICEGathererState) {
		log.Printf("[WebRTC][server] ICE gathering state for device=%s: %s", deviceID, state.String())
	})

	pc.OnICEConnectionStateChange(func(state pion.ICEConnectionState) {
		log.Printf("[WebRTC][server] ICE state for device=%s: %s", deviceID, state.String())
	})

	pc.OnConnectionStateChange(func(state pion.PeerConnectionState) {
		log.Printf("[WebRTC][server] PeerConnection state for device=%s: %s", deviceID, state.String())
	})

	track, err := pion.NewTrackLocalStaticRTP(
		pion.RTPCodecCapability{MimeType: pion.MimeTypeH264, ClockRate: 90000},
		"video",
		deviceID,
	)
	if err != nil {
		return nil, err
	}

	sender, err := pc.AddTrack(track)
	if err != nil {
		return nil, err
	}

	session.track = track
	session.sender = sender
	session.localCandidateCount = localCandidateCount
	return pc, nil
}
