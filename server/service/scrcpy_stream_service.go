package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"vrcontrol/server/h264stream"
	"vrcontrol/server/model"
	"vrcontrol/server/repository"
	"vrcontrol/server/scrcpy"
)

const (
	streamSubscriberBuffer     = 60
	streamIdleGracePeriod      = 5 * time.Second
	keyframeRequestMinInterval = 1 * time.Second
)

type ScrcpyStreamService struct {
	streamManager *scrcpy.StreamManager
	deviceRepo    *repository.DeviceRepository
	configRepo    *repository.ScrcpyConfigRepository

	mu               sync.Mutex
	sources          map[string]*deviceStreamSource
	nextSubscriberID uint64
}

func NewScrcpyStreamService(
	streamManager *scrcpy.StreamManager,
	deviceRepo *repository.DeviceRepository,
	configRepo *repository.ScrcpyConfigRepository,
) *ScrcpyStreamService {
	return &ScrcpyStreamService{
		streamManager: streamManager,
		deviceRepo:    deviceRepo,
		configRepo:    configRepo,
		sources:       make(map[string]*deviceStreamSource),
	}
}

func (s *ScrcpyStreamService) StartStream(deviceID string) (*scrcpy.StreamSession, error) {
	return s.startDeviceStream(deviceID)
}

func (s *ScrcpyStreamService) SubscribeStream(deviceID string) (*StreamSubscription, error) {
	source, err := s.getOrCreateSource(deviceID)
	if err != nil {
		return nil, err
	}

	subscription := source.addSubscriber(s.nextSubscriptionID())
	source.requestKeyframe()
	return subscription, nil
}

func (s *ScrcpyStreamService) startDeviceStream(deviceID string) (*scrcpy.StreamSession, error) {
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}
	if device.Status != "online" {
		return nil, fmt.Errorf("device is not online (current status: %s)", device.Status)
	}

	config, err := s.configRepo.Get()
	if err != nil {
		config = model.DefaultScrcpyConfig()
	}

	return s.streamManager.StartStream(device.Serial, deviceID, config)
}

func (s *ScrcpyStreamService) getOrCreateSource(deviceID string) (*deviceStreamSource, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if source := s.sources[deviceID]; source != nil && !source.isDone() {
		return source, nil
	}

	session, err := s.startDeviceStream(deviceID)
	if err != nil {
		return nil, err
	}

	source := newDeviceStreamSource(s, session)
	s.sources[deviceID] = source
	go source.run()
	return source, nil
}

func (s *ScrcpyStreamService) removeSource(deviceID string, source *deviceStreamSource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.sources[deviceID] == source {
		delete(s.sources, deviceID)
	}
}

func (s *ScrcpyStreamService) nextSubscriptionID() uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextSubscriberID += 1
	return s.nextSubscriberID
}

type StreamSubscription struct {
	DeviceID string
	Header   scrcpy.StreamHeader
	Units    <-chan h264stream.AccessUnit

	id     uint64
	source *deviceStreamSource
	ch     chan h264stream.AccessUnit

	mu               sync.Mutex
	err              error
	awaitingKeyframe bool
	closed           bool
	closeOnce        sync.Once
}

func (s *StreamSubscription) Close() {
	if s == nil {
		return
	}
	s.close(nil, true)
}

func (s *StreamSubscription) Err() error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.err
}

func (s *StreamSubscription) close(err error, unsubscribe bool) {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		s.err = err
		source := s.source
		s.mu.Unlock()

		if unsubscribe && source != nil {
			source.removeSubscriber(s.id)
		}
		close(s.ch)
	})
}

func (s *StreamSubscription) enqueue(unit h264stream.AccessUnit) bool {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return false
	}

	select {
	case s.ch <- unit:
		s.mu.Unlock()
		return true
	default:
	}

	if !unit.IsKeyframe {
		s.mu.Unlock()
		return true
	}

	for {
		select {
		case <-s.ch:
		default:
			select {
			case s.ch <- unit:
				s.mu.Unlock()
				return true
			default:
				s.mu.Unlock()
				return false
			}
		}
	}
}

type deviceStreamSource struct {
	service *ScrcpyStreamService
	session *scrcpy.StreamSession
	header  scrcpy.StreamHeader

	ctx    context.Context
	cancel context.CancelFunc
	done   chan struct{}

	mu                  sync.Mutex
	subscribers         map[uint64]*StreamSubscription
	lastKeyframeRequest time.Time
}

func newDeviceStreamSource(service *ScrcpyStreamService, session *scrcpy.StreamSession) *deviceStreamSource {
	ctx, cancel := context.WithCancel(context.Background())
	return &deviceStreamSource{
		service:     service,
		session:     session,
		header:      session.Header,
		ctx:         ctx,
		cancel:      cancel,
		done:        make(chan struct{}),
		subscribers: make(map[uint64]*StreamSubscription),
	}
}

func (s *deviceStreamSource) isDone() bool {
	select {
	case <-s.done:
		return true
	default:
		return false
	}
}

func (s *deviceStreamSource) run() {
	defer func() {
		s.session.Stop()
		close(s.done)
		s.service.removeSource(s.session.DeviceID, s)
	}()

	err := h264stream.StreamAccessUnits(s.ctx, s.session, s.session.Header.FPS, s.broadcast)
	if err != nil && s.ctx.Err() == nil {
		log.Printf("[StreamHub] source error for device=%s: %v", s.session.DeviceID, err)
		s.closeSubscribers(err)
		return
	}
	s.closeSubscribers(nil)
}

func (s *deviceStreamSource) addSubscriber(id uint64) *StreamSubscription {
	subscription := &StreamSubscription{
		DeviceID:         s.session.DeviceID,
		Header:           s.header,
		id:               id,
		source:           s,
		ch:               make(chan h264stream.AccessUnit, streamSubscriberBuffer),
		awaitingKeyframe: true,
	}
	subscription.Units = subscription.ch

	s.mu.Lock()
	s.subscribers[id] = subscription
	s.mu.Unlock()

	log.Printf("[StreamHub] subscriber added device=%s id=%d", s.session.DeviceID, id)
	return subscription
}

func (s *deviceStreamSource) removeSubscriber(id uint64) {
	s.mu.Lock()
	delete(s.subscribers, id)
	remaining := len(s.subscribers)
	s.mu.Unlock()

	log.Printf("[StreamHub] subscriber removed device=%s id=%d remaining=%d", s.session.DeviceID, id, remaining)
	if remaining == 0 {
		go s.stopAfterIdleGrace()
	}
}

func (s *deviceStreamSource) stopAfterIdleGrace() {
	timer := time.NewTimer(streamIdleGracePeriod)
	defer timer.Stop()

	select {
	case <-s.done:
		return
	case <-timer.C:
	}

	s.mu.Lock()
	idle := len(s.subscribers) == 0
	s.mu.Unlock()
	if idle {
		log.Printf("[StreamHub] stopping idle source device=%s", s.session.DeviceID)
		s.cancel()
	}
}

func (s *deviceStreamSource) requestKeyframe() {
	s.mu.Lock()
	if !s.lastKeyframeRequest.IsZero() && time.Since(s.lastKeyframeRequest) < keyframeRequestMinInterval {
		s.mu.Unlock()
		return
	}
	s.lastKeyframeRequest = time.Now()
	s.mu.Unlock()

	go func() {
		if err := s.session.SendResetVideo(); err != nil {
			log.Printf("[StreamHub] keyframe request failed device=%s: %v", s.session.DeviceID, err)
			return
		}
		log.Printf("[StreamHub] keyframe requested device=%s", s.session.DeviceID)
	}()
}

func (s *deviceStreamSource) broadcast(unit h264stream.AccessUnit) error {
	s.mu.Lock()
	subscribers := make(map[uint64]*StreamSubscription, len(s.subscribers))
	for id, subscription := range s.subscribers {
		subscribers[id] = subscription
	}
	s.mu.Unlock()

	for id, subscription := range subscribers {
		if subscription.awaitingKeyframe {
			if !unit.IsKeyframe {
				continue
			}
			subscription.awaitingKeyframe = false
		}

		if !subscription.enqueue(unit) {
			s.removeSubscriber(id)
			go subscription.close(fmt.Errorf("stream subscriber queue overflow"), false)
			log.Printf("[StreamHub] subscriber queue overflow device=%s id=%d", s.session.DeviceID, id)
		}
	}

	return nil
}

func (s *deviceStreamSource) closeSubscribers(err error) {
	s.mu.Lock()
	subscribers := make([]*StreamSubscription, 0, len(s.subscribers))
	for id, subscription := range s.subscribers {
		subscribers = append(subscribers, subscription)
		delete(s.subscribers, id)
	}
	s.mu.Unlock()

	for _, subscription := range subscribers {
		subscription.close(err, false)
	}
}
