package model

import "time"

type ActivityStatus string

const (
	ActivityStatusDraft     ActivityStatus = "draft"
	ActivityStatusRunning   ActivityStatus = "running"
	ActivityStatusEnded     ActivityStatus = "ended"
	ActivityStatusCancelled ActivityStatus = "cancelled"
)

// ActivityContext 是一場活動共用、且可提供給參與設備讀取的只讀快照。
type ActivityContext map[string]any

type ActivityIndex struct {
	ActivityID string         `json:"activity_id"`
	RoomID     string         `json:"room_id"`
	Name       string         `json:"name"`
	Status     ActivityStatus `json:"status"`
	CreatedAt  time.Time      `json:"created_at"`
	StartedAt  *time.Time     `json:"started_at,omitempty"`
	EndedAt    *time.Time     `json:"ended_at,omitempty"`
}

type ActivityDetail struct {
	ActivityID       string                `json:"activity_id"`
	RoomID           string                `json:"room_id"`
	Name             string                `json:"name"`
	Status           ActivityStatus        `json:"status"`
	CreatedAt        time.Time             `json:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
	StartedAt        *time.Time            `json:"started_at,omitempty"`
	EndedAt          *time.Time            `json:"ended_at,omitempty"`
	ActivityContext  ActivityContext       `json:"activity_context"`
	RuntimeSnapshot  *ActivityRuntimeInfo  `json:"runtime_snapshot,omitempty"`
	ResultSummary    *ActivitySummary      `json:"result_summary,omitempty"`
	ArtifactManifest []ActivityArtifactRef `json:"artifact_manifest,omitempty"`
}

type Activity struct {
	ActivityID      string                `json:"activity_id"`
	RoomID          string                `json:"room_id"`
	Name            string                `json:"name"`
	Status          ActivityStatus        `json:"status"`
	ActivityContext ActivityContext       `json:"activity_context"`
	RuntimeSnapshot *ActivityRuntimeInfo  `json:"runtime_snapshot,omitempty"`
	ResultSummary   *ActivitySummary      `json:"result_summary,omitempty"`
	ArtifactRefs    []ActivityArtifactRef `json:"artifact_refs,omitempty"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
	StartedAt       *time.Time            `json:"started_at,omitempty"`
	EndedAt         *time.Time            `json:"ended_at,omitempty"`
}

type ActivityRuntimeInfo struct {
	Seed             int       `json:"seed,omitempty"`
	PlayerCount      int       `json:"player_count"`
	LastEventAt      time.Time `json:"last_event_at,omitempty"`
	LastUpdatedAt    time.Time `json:"last_updated_at,omitempty"`
	ContextVersion   string    `json:"context_version,omitempty"`
	ContextDelivered bool      `json:"context_delivered"`
}

type ActivitySummary struct {
	ParticipantCount int            `json:"participant_count"`
	EventCounts      map[string]int `json:"event_counts,omitempty"`
	DurationSec      int64          `json:"duration_sec"`
}

type ActivityArtifactRef struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type,omitempty"`
}

type ActivityQAResult struct {
	ActivityID     string                       `json:"activity_id"`
	RoomID         string                       `json:"room_id"`
	CurrentQID     string                       `json:"current_qid,omitempty"`
	Answers        map[string]map[string]string `json:"answers"`
	QuestionLocked map[string]bool              `json:"question_locked,omitempty"`
	QAContext      any                          `json:"qa_context,omitempty"`
	CapturedAt     time.Time                    `json:"captured_at"`
}

type ActivityLanternResult struct {
	ActivityID string                            `json:"activity_id"`
	RoomID     string                            `json:"room_id"`
	Events     map[string][]*LanternEventMessage `json:"events"`
	CapturedAt time.Time                         `json:"captured_at"`
}

func DefaultActivityContext() ActivityContext {
	return make(ActivityContext)
}

func IsValidActivityStatus(status ActivityStatus) bool {
	switch status {
	case ActivityStatusDraft, ActivityStatusRunning, ActivityStatusEnded, ActivityStatusCancelled:
		return true
	default:
		return false
	}
}
