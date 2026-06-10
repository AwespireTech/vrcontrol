package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"vrcontrol/server/model"
	"vrcontrol/server/repository"

	"github.com/gin-gonic/gin"
)

func newScrcpyControllerTestRepo(t *testing.T) *repository.ScrcpyConfigRepository {
	t.Helper()

	repoPath := filepath.Join(t.TempDir(), "scrcpy_config.json")
	repo := repository.NewScrcpyConfigRepository(repoPath)
	if err := repo.Update(model.DefaultScrcpyConfig()); err != nil {
		t.Fatalf("repo.Update() failed: %v", err)
	}
	return repo
}

func TestScrcpyControllerUpdateConfigRejectsInvalidBitrate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := newScrcpyControllerTestRepo(t)
	controller := NewScrcpyController(repo)

	body := bytes.NewBufferString(`{"bitrate":"abc","max_size":960,"max_fps":15,"video_codec_options":""}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPut, "/api/scrcpy/config", body)
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	controller.UpdateConfig(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status code = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	if !strings.Contains(recorder.Body.String(), "invalid_bitrate") {
		t.Fatalf("response body %q does not contain invalid_bitrate", recorder.Body.String())
	}
}

func TestScrcpyControllerUpdateConfigAcceptsCustomBitrate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := newScrcpyControllerTestRepo(t)
	controller := NewScrcpyController(repo)

	body := bytes.NewBufferString(`{"bitrate":"800k","max_size":720,"max_fps":10,"video_codec_options":""}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPut, "/api/scrcpy/config", body)
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	controller.UpdateConfig(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", recorder.Code, http.StatusOK)
	}

	config, err := repo.Get()
	if err != nil {
		t.Fatalf("repo.Get() failed: %v", err)
	}
	if config.Bitrate != "800k" {
		t.Fatalf("bitrate = %q, want %q", config.Bitrate, "800k")
	}
	if config.MaxSize != 720 {
		t.Fatalf("max_size = %d, want %d", config.MaxSize, 720)
	}
	if config.MaxFPS != 10 {
		t.Fatalf("max_fps = %d, want %d", config.MaxFPS, 10)
	}
}
