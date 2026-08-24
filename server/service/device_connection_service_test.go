package service

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"vrcontrol/server/adb"
	"vrcontrol/server/model"
	"vrcontrol/server/repository"
)

type fakeDeviceConnectionADB struct {
	devices         []adb.Device
	deviceResponses [][]adb.Device
	err             error
	disconnectErr   error
	resolveDevice   *adb.Device
	resolveErr      error
	getDevicesCalls int
	disconnectPort  int
	connectCalls    int
}

func (f *fakeDeviceConnectionADB) GetDevices() ([]adb.Device, error) {
	if len(f.deviceResponses) > 0 {
		index := f.getDevicesCalls
		if index >= len(f.deviceResponses) {
			index = len(f.deviceResponses) - 1
		}
		f.getDevicesCalls++
		return f.deviceResponses[index], f.err
	}
	return f.devices, f.err
}

func (f *fakeDeviceConnectionADB) Connect(string, int) error {
	f.connectCalls++
	return f.err
}

func (f *fakeDeviceConnectionADB) Disconnect(_ string, port int) error {
	f.disconnectPort = port
	return f.disconnectErr
}

func (f *fakeDeviceConnectionADB) ResolveConnectedDevice(string, int, time.Duration) (*adb.Device, error) {
	return f.resolveDevice, f.resolveErr
}

func (f *fakeDeviceConnectionADB) GetDeviceInfo(string) (*adb.DeviceInfo, error) {
	return &adb.DeviceInfo{}, nil
}

func (f *fakeDeviceConnectionADB) GetDeviceStatus(string) (*adb.DeviceStatus, error) {
	return &adb.DeviceStatus{}, nil
}

func TestReconcileADBStatusesUsesADBAsGroundTruth(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "online-missing", model.DeviceStatusOnline, "10.0.0.1")
	createDeviceConnectionTestDevice(t, repo, "offline-present", model.DeviceStatusOffline, "10.0.0.2")
	createDeviceConnectionTestDevice(t, repo, "manual-missing", model.DeviceStatusDisconnected, "10.0.0.3")

	service := NewDeviceConnectionService(repo, &fakeDeviceConnectionADB{
		devices: []adb.Device{{Serial: "10.0.0.2:5555", State: "device"}},
	})

	snapshot, err := service.ReconcileADBStatuses()
	if err != nil {
		t.Fatalf("reconcile statuses: %v", err)
	}

	assertDeviceConnectionStatus(t, repo, "online-missing", model.DeviceStatusOffline)
	assertDeviceConnectionStatus(t, repo, "offline-present", model.DeviceStatusOnline)
	assertDeviceConnectionStatus(t, repo, "manual-missing", model.DeviceStatusDisconnected)
	if snapshot.LastSuccessful.IsZero() {
		t.Fatal("expected successful check timestamp")
	}
}

func TestReconcileADBStatusesPreservesStatusesWhenADBQueryFails(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "online-device", model.DeviceStatusOnline, "10.0.0.1")

	service := NewDeviceConnectionService(repo, &fakeDeviceConnectionADB{err: errors.New("adb unavailable")})

	if _, err := service.ReconcileADBStatuses(); err == nil {
		t.Fatal("expected reconcile error")
	}

	assertDeviceConnectionStatus(t, repo, "online-device", model.DeviceStatusOnline)
	if service.Health().LastError == "" {
		t.Fatal("expected health error")
	}
}

func TestConnectDeviceRequiresResolvedADBTarget(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "device-1", model.DeviceStatusOffline, "10.0.0.1")
	service := NewDeviceConnectionService(repo, &fakeDeviceConnectionADB{
		resolveErr: errors.New("target missing"),
	})

	if _, err := service.ConnectDevice("device-1"); err == nil {
		t.Fatal("expected connect verification error")
	}
	assertDeviceConnectionStatus(t, repo, "device-1", model.DeviceStatusOffline)
}

func TestReconnectDeviceDoesNotOverrideManualDisconnect(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "device-1", model.DeviceStatusDisconnected, "10.0.0.1")
	fakeADB := &fakeDeviceConnectionADB{}
	service := NewDeviceConnectionService(repo, fakeADB)

	if _, err := service.ReconnectDevice("device-1"); err == nil {
		t.Fatal("expected automatic reconnect to be skipped")
	}
	if err := service.RecordReconnectFailure("device-1", errors.New("stale reconnect failure"), time.Second, 5); err != nil {
		t.Fatalf("record reconnect failure: %v", err)
	}

	assertDeviceConnectionStatus(t, repo, "device-1", model.DeviceStatusDisconnected)
	if fakeADB.connectCalls != 0 {
		t.Fatalf("connect calls: got %d, want 0", fakeADB.connectCalls)
	}
}

func TestDisconnectDeviceConvergesWhenTargetIsAlreadyAbsent(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "device-1", model.DeviceStatusOnline, "10.0.0.1")
	fakeADB := &fakeDeviceConnectionADB{}
	service := NewDeviceConnectionService(repo, fakeADB)

	device, err := service.DisconnectDevice("device-1")
	if err != nil {
		t.Fatalf("disconnect absent target: %v", err)
	}
	if device.Status != model.DeviceStatusDisconnected || device.AutoReconnectDisabledReason != "manual_disconnect" {
		t.Fatalf("unexpected disconnected state: %+v", device)
	}
	if fakeADB.disconnectPort != 0 {
		t.Fatal("did not expect adb disconnect command for absent target")
	}
}

func TestDisconnectDeviceAcceptsCommandErrorWhenTargetDisappears(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "device-1", model.DeviceStatusOnline, "10.0.0.1")
	fakeADB := &fakeDeviceConnectionADB{
		deviceResponses: [][]adb.Device{
			{{Serial: "10.0.0.1:5555", State: "device"}},
			{},
		},
		disconnectErr: errors.New("transport closed"),
	}
	service := NewDeviceConnectionService(repo, fakeADB)

	if _, err := service.DisconnectDevice("device-1"); err != nil {
		t.Fatalf("disconnect converged target: %v", err)
	}
	assertDeviceConnectionStatus(t, repo, "device-1", model.DeviceStatusDisconnected)
}

func TestDisconnectDevicePreservesStatusWhenTargetRemainsOnline(t *testing.T) {
	repo := newDeviceConnectionTestRepo(t)
	createDeviceConnectionTestDevice(t, repo, "device-1", model.DeviceStatusOnline, "10.0.0.1")
	fakeADB := &fakeDeviceConnectionADB{
		devices:       []adb.Device{{Serial: "10.0.0.1:5555", State: "device"}},
		disconnectErr: errors.New("disconnect failed"),
	}
	service := NewDeviceConnectionService(repo, fakeADB)
	service.disconnectRetryDelay = 0

	if _, err := service.DisconnectDevice("device-1"); err == nil {
		t.Fatal("expected disconnect error while target remains online")
	}
	assertDeviceConnectionStatus(t, repo, "device-1", model.DeviceStatusOnline)
	if fakeADB.disconnectPort != 5555 {
		t.Fatalf("disconnect port: got %d, want 5555", fakeADB.disconnectPort)
	}
}

func newDeviceConnectionTestRepo(t *testing.T) *repository.DeviceRepository {
	t.Helper()
	repo := repository.NewDeviceRepository(filepath.Join(t.TempDir(), "devices.json"))
	if err := repo.Load(); err != nil {
		t.Fatalf("load repository: %v", err)
	}
	return repo
}

func createDeviceConnectionTestDevice(t *testing.T, repo *repository.DeviceRepository, id, status, ip string) {
	t.Helper()
	if err := repo.Create(&model.Device{
		DeviceID: id,
		IP:       ip,
		Port:     5555,
		Serial:   ip + ":5555",
		Status:   status,
	}); err != nil {
		t.Fatalf("create device %s: %v", id, err)
	}
}

func assertDeviceConnectionStatus(t *testing.T, repo *repository.DeviceRepository, id, want string) {
	t.Helper()
	device, err := repo.GetByID(id)
	if err != nil {
		t.Fatalf("get device %s: %v", id, err)
	}
	if device.Status != want {
		t.Fatalf("device %s status: got %s, want %s", id, device.Status, want)
	}
}
