package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vrcontrol/server/model"
	"vrcontrol/server/service"

	"github.com/gin-gonic/gin"
)

type ActivityController struct {
	activityService *service.ActivityService
	roomService     *service.RoomService
}

func NewActivityController(activityService *service.ActivityService, roomService *service.RoomService) *ActivityController {
	return &ActivityController{
		activityService: activityService,
		roomService:     roomService,
	}
}

func (c *ActivityController) CreateDraft(ctx *gin.Context) {
	roomID := ctx.Param("id")
	if _, err := c.roomService.GetRoom(roomID); err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	var req struct {
		Name            string                `json:"name"`
		ActivityContext model.ActivityContext `json:"activity_context"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request body"})
		return
	}

	activity := &model.Activity{
		RoomID:          roomID,
		Name:            req.Name,
		Status:          model.ActivityStatusDraft,
		ActivityContext: req.ActivityContext,
	}
	if err := c.activityService.CreateDraft(activity); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"success": true, "data": activity, "message": "Activity draft created successfully"})
}

func (c *ActivityController) ListByRoom(ctx *gin.Context) {
	roomID := ctx.Param("id")
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": c.activityService.ListActivitiesByRoom(roomID)})
}

func (c *ActivityController) GetCurrentActivityByRoom(ctx *gin.Context) {
	activity, err := c.activityService.GetRunningActivityByRoom(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": activity})
}

func (c *ActivityController) ListActivities(ctx *gin.Context) {
	query, err := parseActivityListQuery(ctx)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	result, err := c.activityService.QueryActivities(query)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func (c *ActivityController) GetActivity(ctx *gin.Context) {
	activity, err := c.activityService.GetActivity(ctx.Param("activityId"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": activity})
}

func (c *ActivityController) StartActivity(ctx *gin.Context) {
	activityID := ctx.Param("activityId")
	activity, err := c.activityService.GetActivity(activityID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	var req struct {
		Name            *string                `json:"name"`
		ActivityContext *model.ActivityContext `json:"activity_context"`
		Seed            *int                   `json:"seed"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request body"})
		return
	}
	if req.Name != nil || req.ActivityContext != nil {
		updated, err := c.activityService.UpdateDraft(activityID, service.ActivityDraftPatch{
			Name:            req.Name,
			ActivityContext: req.ActivityContext,
		})
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
			return
		}
		activity = updated
	}

	room, created := roomRuntimeManager.GetOrCreateRoom(activity.RoomID)
	if room == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to create room runtime"})
		return
	}
	if created {
		go room.Run()
	}
	if room.HasRunningActivity() {
		ctx.JSON(http.StatusConflict, gin.H{"success": false, "error": "Room already has a running activity"})
		return
	}

	runtimeInfo := &model.ActivityRuntimeInfo{PlayerCount: len(room.Players)}
	if req.Seed != nil {
		runtimeInfo.Seed = *req.Seed
	}
	started, err := c.activityService.StartActivity(activityID, runtimeInfo)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := room.StartActivity(started); err != nil {
		_, _ = c.activityService.CancelActivity(activityID)
		ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": started, "message": "Activity started successfully"})
}

func (c *ActivityController) EndActivity(ctx *gin.Context) {
	activityID := ctx.Param("activityId")
	activity, err := c.activityService.GetActivity(activityID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	var summary *model.ActivitySummary
	var qaSnapshot *model.ActivityQAResult
	var lanternSnapshot *model.ActivityLanternResult
	if room, ok := roomRuntimeManager.GetRoom(activity.RoomID); ok && room != nil && room.CurrentActivity != nil && room.CurrentActivity.ActivityID == activityID {
		qaSnapshot = room.BuildQASnapshot(activityID)
		lanternSnapshot = room.BuildLanternSnapshot(activityID)
		summary = room.EndActivity()
	}
	if summary == nil {
		summary, err = c.activityService.BuildResultSummary(activityID, 0)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
	}
	ended, err := c.activityService.EndActivity(activityID, summary)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if qaSnapshot != nil {
		updated, err := c.activityService.AttachArtifact(activityID, model.ActivityArtifactRef{Name: "qa", Type: "qa_result"}, qaSnapshot)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
		ended = updated
	}
	if lanternSnapshot != nil {
		updated, err := c.activityService.AttachArtifact(activityID, model.ActivityArtifactRef{Name: "lantern", Type: "lantern_result"}, lanternSnapshot)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
		ended = updated
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": ended, "message": "Activity ended successfully"})
}

func (c *ActivityController) CancelActivity(ctx *gin.Context) {
	activityID := ctx.Param("activityId")
	activity, err := c.activityService.GetActivity(activityID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	if room, ok := roomRuntimeManager.GetRoom(activity.RoomID); ok && room != nil && room.CurrentActivity != nil && room.CurrentActivity.ActivityID == activityID {
		room.EndActivity()
	}
	cancelled, err := c.activityService.CancelActivity(activityID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": cancelled, "message": "Activity cancelled successfully"})
}

func (c *ActivityController) GetResults(ctx *gin.Context) {
	activity, err := c.activityService.GetActivity(ctx.Param("activityId"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"activity_id": activity.ActivityID, "status": activity.Status, "result_summary": activity.ResultSummary, "artifact_refs": activity.ArtifactRefs}})
}

func (c *ActivityController) GetLantern(ctx *gin.Context) {
	activityID := ctx.Param("activityId")
	lantern, err := c.activityService.GetLanternResult(activityID)
	if err != nil {
		if errors.Is(err, service.ErrActivityArtifactNotFound) || strings.Contains(err.Error(), "activity not found") {
			ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": lantern})
}

func (c *ActivityController) GetContext(ctx *gin.Context) {
	activityContext, err := c.activityService.GetActivityContext(ctx.Param("activityId"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": activityContext})
}

func parseActivityListQuery(ctx *gin.Context) (service.ActivityListQuery, error) {
	query := service.ActivityListQuery{}
	var err error
	if value := strings.TrimSpace(ctx.Query("limit")); value != "" {
		query.Limit, err = strconv.Atoi(value)
		if err != nil || query.Limit < 0 {
			return service.ActivityListQuery{}, errors.New("limit must be a non-negative integer")
		}
	}
	if value := strings.TrimSpace(ctx.Query("offset")); value != "" {
		query.Offset, err = strconv.Atoi(value)
		if err != nil || query.Offset < 0 {
			return service.ActivityListQuery{}, errors.New("offset must be a non-negative integer")
		}
	}
	query.SortBy = strings.TrimSpace(ctx.Query("sort_by"))
	if query.SortBy != "" && !isValidActivitySortBy(query.SortBy) {
		return service.ActivityListQuery{}, errors.New("sort_by must be one of created_at, started_at, ended_at, name")
	}
	query.Order = strings.TrimSpace(ctx.Query("order"))
	if query.Order != "" && !isValidActivitySortOrder(query.Order) {
		return service.ActivityListQuery{}, errors.New("order must be asc or desc")
	}
	query.Status = strings.TrimSpace(ctx.Query("status"))
	if query.Status != "" && !model.IsValidActivityStatus(model.ActivityStatus(query.Status)) {
		return service.ActivityListQuery{}, errors.New("status must be one of draft, running, ended, cancelled")
	}
	query.RoomID = strings.TrimSpace(ctx.Query("room_id"))
	if query.CreatedBefore, err = parseOptionalRFC3339(ctx.Query("created_before")); err != nil {
		return service.ActivityListQuery{}, errors.New("created_before must be RFC3339 timestamp")
	}
	if query.CreatedAfter, err = parseOptionalRFC3339(ctx.Query("created_after")); err != nil {
		return service.ActivityListQuery{}, errors.New("created_after must be RFC3339 timestamp")
	}
	if query.StartedBefore, err = parseOptionalRFC3339(ctx.Query("started_before")); err != nil {
		return service.ActivityListQuery{}, errors.New("started_before must be RFC3339 timestamp")
	}
	if query.StartedAfter, err = parseOptionalRFC3339(ctx.Query("started_after")); err != nil {
		return service.ActivityListQuery{}, errors.New("started_after must be RFC3339 timestamp")
	}
	return query, nil
}

func parseOptionalRFC3339(value string) (*time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func isValidActivitySortBy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "created_at", "started_at", "ended_at", "name":
		return true
	default:
		return false
	}
}

func isValidActivitySortOrder(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "asc", "desc":
		return true
	default:
		return false
	}
}
