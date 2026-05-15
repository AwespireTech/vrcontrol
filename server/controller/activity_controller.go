package controller

import (
	"net/http"

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

	room, ok := RoomList[activity.RoomID]
	if !ok || room == nil {
		room = createRoomRuntime(activity.RoomID)
		RoomList[activity.RoomID] = room
		go room.Run()
	}
	if room.HasRunningActivity() {
		ctx.JSON(http.StatusConflict, gin.H{"success": false, "error": "Room already has a running activity"})
		return
	}

	runtimeInfo := &model.ActivityRuntimeInfo{RoomHash: room.RoomHash, PlayerCount: len(room.Players)}
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
	if room, ok := RoomList[activity.RoomID]; ok && room != nil && room.CurrentActivity != nil && room.CurrentActivity.ActivityID == activityID {
		qaSnapshot = room.BuildQASnapshot(activityID)
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

	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": ended, "message": "Activity ended successfully"})
}

func (c *ActivityController) CancelActivity(ctx *gin.Context) {
	activityID := ctx.Param("activityId")
	activity, err := c.activityService.GetActivity(activityID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	if room, ok := RoomList[activity.RoomID]; ok && room != nil && room.CurrentActivity != nil && room.CurrentActivity.ActivityID == activityID {
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

func (c *ActivityController) GetContext(ctx *gin.Context) {
	activityContext, err := c.activityService.GetActivityContext(ctx.Param("activityId"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": activityContext})
}
