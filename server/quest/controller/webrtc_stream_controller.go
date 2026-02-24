package controller

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"vrcontrol/server/quest/scrcpy"
	"vrcontrol/server/quest/service"
	questwebrtc "vrcontrol/server/quest/webrtc"

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
	)

	sendSignal := func(message signalMessage) {
		writeLock.Lock()
		defer writeLock.Unlock()
		_ = conn.WriteJSON(message)
	}

	cleanup := func() {
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
	}

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

			sessionData, err := c.streamService.StartStream(deviceID)
			if err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				continue
			}
			session = &webrtcSession{session: sessionData}

			pc, err = newPeerConnection(deviceID, session, sendSignal)
			if err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				continue
			}

			if err := pc.SetRemoteDescription(pion.SessionDescription{Type: pion.SDPTypeOffer, SDP: msg.SDP}); err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				continue
			}

			answer, err := pc.CreateAnswer(nil)
			if err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				continue
			}

			if err := pc.SetLocalDescription(answer); err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
				cleanup()
				continue
			}

			sendSignal(signalMessage{Type: "answer", SDP: answer.SDP})

			streamCtx, cancelFn := context.WithCancel(context.Background())
			cancel = cancelFn
			go func() {
				fps := session.session.Header.FPS
				if err := questwebrtc.StreamH264(streamCtx, session.session, session.track, fps); err != nil && streamCtx.Err() == nil {
					log.Printf("[WebRTC] stream error for %s: %v", deviceID, err)
				}
			}()

		case "ice":
			if pc == nil || msg.Candidate == nil {
				continue
			}
			if err := pc.AddICECandidate(*msg.Candidate); err != nil {
				sendSignal(signalMessage{Type: "error", Error: err.Error()})
			}

		case "close":
			cleanup()
			return
		}
	}
}

type webrtcSession struct {
	session *scrcpy.StreamSession
	track   *pion.TrackLocalStaticRTP
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

	api := pion.NewAPI(pion.WithMediaEngine(mediaEngine))
	pc, err := api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		return nil, err
	}

	pc.OnICECandidate(func(candidate *pion.ICECandidate) {
		if candidate == nil {
			return
		}
		candidateJSON := candidate.ToJSON()
		sendSignal(signalMessage{Type: "ice", Candidate: &candidateJSON})
	})

	track, err := pion.NewTrackLocalStaticRTP(
		pion.RTPCodecCapability{MimeType: pion.MimeTypeH264, ClockRate: 90000},
		"video",
		deviceID,
	)
	if err != nil {
		return nil, err
	}

	if _, err := pc.AddTrack(track); err != nil {
		return nil, err
	}

	session.track = track
	return pc, nil
}
