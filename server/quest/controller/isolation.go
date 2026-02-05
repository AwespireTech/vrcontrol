package controller

import (
	"sort"
	"strings"
	"sync"
	"time"

	"vrcontrol/server/quest/utils"

	"github.com/gin-gonic/gin"
)

type IsolationEntry struct {
	ClientID    string    `json:"client_id"`
	DeviceID    string    `json:"device_id"`
	IP          string    `json:"ip"`
	Valid       bool      `json:"valid"`
	IDMatched   bool      `json:"id_matched"`
	IPMatched   bool      `json:"ip_matched"`
	ConnectedAt time.Time `json:"connected_at"`
	LastSeen    time.Time `json:"last_seen"`
}

var (
	isolationMu   sync.RWMutex
	isolationMap  = make(map[string]*IsolationEntry)
	clientIDRegex = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
)

func recordIsolation(clientId, ip string, valid bool, deviceId string, idMatched, ipMatched bool) {
	now := time.Now()
	isolationMu.Lock()
	defer isolationMu.Unlock()

	entry, exists := isolationMap[clientId]
	if !exists {
		isolationMap[clientId] = &IsolationEntry{
			ClientID:    clientId,
			DeviceID:    deviceId,
			IP:          ip,
			Valid:       valid,
			IDMatched:   idMatched,
			IPMatched:   ipMatched,
			ConnectedAt: now,
			LastSeen:    now,
		}
		return
	}

	entry.IP = ip
	entry.Valid = valid
	entry.DeviceID = deviceId
	entry.IDMatched = idMatched
	entry.IPMatched = ipMatched
	entry.LastSeen = now
}

func removeIsolation(clientId string) {
	isolationMu.Lock()
	defer isolationMu.Unlock()
	delete(isolationMap, clientId)
}

func removeIsolationByDeviceID(deviceId string) {
	if deviceId == "" {
		return
	}
	isolationMu.Lock()
	defer isolationMu.Unlock()
	for key, entry := range isolationMap {
		if entry == nil {
			continue
		}
		if strings.EqualFold(entry.DeviceID, deviceId) {
			delete(isolationMap, key)
		}
	}
}

func reconcileIsolationAfterDeviceUpdate(deviceId, ip string) {
	if deviceId == "" || ip == "" {
		return
	}
	isolationMu.RLock()
	matched := false
	for _, entry := range isolationMap {
		if entry == nil {
			continue
		}
		if strings.EqualFold(entry.DeviceID, deviceId) && entry.IP == ip {
			matched = true
			break
		}
	}
	isolationMu.RUnlock()

	if matched {
		removeIsolationByDeviceID(deviceId)
		updateDeviceWSStatus(deviceId, "connected")
	}
}

func listIsolation() []IsolationEntry {
	isolationMu.RLock()
	defer isolationMu.RUnlock()

	entries := make([]IsolationEntry, 0, len(isolationMap))
	for _, entry := range isolationMap {
		if entry == nil {
			continue
		}
		entries = append(entries, *entry)
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].LastSeen.After(entries[j].LastSeen)
	})

	return entries
}

func normalizeDeviceIDFromClient(clientId string) (string, bool) {
	if clientId == "" {
		return "", false
	}
	upper := strings.ToUpper(clientId)
	if len(upper) != 8 {
		return "", false
	}
	for _, ch := range upper {
		if !strings.ContainsRune(clientIDRegex, ch) {
			return "", false
		}
	}
	return "DEV-" + upper, true
}

func updateDeviceWSStatus(deviceId, status string) {
	if questDeviceService == nil {
		return
	}
	if !strings.HasPrefix(strings.ToUpper(deviceId), "DEV-") {
		return
	}
	normalizedID := utils.NormalizeDeviceIDKey(deviceId)
	if normalizedID == "" || !strings.HasPrefix(normalizedID, "DEV-") {
		return
	}
	_ = questDeviceService.UpdateWSStatus(normalizedID, status)
}

// GetIsolationDevices 回傳隔離區連線清單
func GetIsolationDevices(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    listIsolation(),
	})
}
