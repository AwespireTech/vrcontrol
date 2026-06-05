# Message Contract Changes

本文件記錄會影響接收方專案的 breaking changes。修改 socket 或 API message shape 時，請先在這裡留下舊格式、新格式與同步事項。

## 2026-05-23 Shared Live View Source

### 背景

- 同一台 device 的 WebRTC live view 與 legacy raw H264 WebSocket 現在共享單一後端 scrcpy/H264 source。
- 每個 WebRTC viewer 仍維持獨立 PeerConnection；這次沒有變更 `/api/ws/webrtc/:deviceId` 的 signaling message shape。

### WebRTC Signaling

不變：

```json
{
  "type": "offer",
  "sdp": "..."
}
```

Server 仍回傳 `answer`、`ice`、`error`，client 仍可送 `close`。接收方不需要因多 viewer fan-out 修改 WebRTC signaling payload。

### Raw H264 WebSocket

`GET /api/scrcpy/stream/:id` 的連線流程維持：

1. server 先送 text frame stream header。
2. server 再送 binary H264 Annex-B data。

行為變更：

- binary frame 現在對齊 H264 access unit，而不是任意 TCP read chunk。
- 多個 raw client 連到同一台 device 時共享同一個 source。
- 新 client 在收到 IDR 前不會收到 delta frame；server 會嘗試請求新的 keyframe。

接收方同步事項：

- 若 client 只把 binary payload 當連續 Annex-B bytes 丟給 decoder，通常不需修改。
- 若 client 依賴舊的任意 chunk boundary，需改成接受「每個 binary frame 是一個 access unit」。

## 2026-05-15 Activity as Session

### 背景

- `Room` 逐步收斂為 device hub / group，負責裝置分群與即時通訊協調。
- `Activity` 代表 app 內實際一局遊戲 / session，承載 seed、context、runtime state、result 與 artifacts。
- 玩家進出 room 不再代表正式 session 開始或結束；只有 Activity lifecycle 代表正式場次。

### Server -> Player: `config` Event

舊格式：

```json
{
  "event_type": "config",
  "config": {
    "seed": 3141,
    "rh": "1715846400",
    "activity_id": "ACTIVITY-123456",
    "activity_context_path": "/api/activities/ACTIVITY-123456/context"
  }
}
```

新格式：

```json
{
  "event_type": "config",
  "config": {
    "room_id": "ROOM-001",
    "activity_id": "ACTIVITY-123456",
    "activity_context_path": "/api/activities/ACTIVITY-123456/context",
    "seed": 3141,
    "parameters": {
      "minimap": {
        "width": 6,
        "depth": 6
      }
    }
  }
}
```

Breaking changes:

- `seed` 的來源從 room runtime session 改為 running Activity。
- `parameters` 是可選的 room-level 固定設定；接收方可在 `config` event 中直接取得，不必再另外查 room API。
- `rh` 已移除；接收方不得再將它視為正式 session id。
- 沒有 running Activity 時，`config` 只代表 hub 狀態，可能只有 `room_id`，不一定有 `activity_id` 或 `seed`。
- Activity start 時 server 會重新廣播 `config`，已連線玩家需用新的 `activity_id` / `seed` 更新場次狀態。

接收方同步事項：

- 以 `activity_id` 判斷目前遊戲/session。
- 以 `activity_context_path` 取得單場 activity context。
- 以 `seed` 作為該 activity 的隨機種子生命週期。
- 停止依賴 `rh` / room hash。

### Control WS: Room Update

舊語意：

- `room_hash` 代表房間從 0 位玩家進入 active room 時建立的隱性 session。

新語意：

- `current_activity_id` 是目前正式 session / game 的主 key。
- `activity_seed` 是目前 running Activity 的 seed。
- Room update 代表 hub 狀態與 current activity 狀態，不再代表玩家進出建立的 session 狀態。

接收方同步事項：

- UI 或控制端若需要判斷目前場次，改用 `current_activity_id`。
- 若需要 seed，改讀 `activity_seed` 或 activity API 回傳的 runtime snapshot。

### Lantern Results

新查詢：

```http
GET /api/activities/:activityId/results
```

再從 `artifact_refs` 找到 `name = "lantern"`、`type = "lantern_result"` 的 artifact。

Breaking changes:

- 新資料以 `activity_id` 保存為 activity artifact。
- 舊 `room_id + room_hash` lantern endpoint 已移除。
- 無 running Activity 時收到的 lantern event 只做即時廣播，不保存成 activity result。

### Player -> Server Events Without Running Activity

`shot_event`、`lantern`、`qa`、`resume_qa` 仍可透過 room runtime 即時處理與廣播。

Breaking changes:

- 沒有 running Activity 時，這些事件不會保存到 activity result/artifact。
- 只有 running Activity 期間的事件會歸屬到 `activity_id`。

## Migration Checklist

- [ ] 接收方改以 `activity_id` 作為正式 session id。
- [ ] 接收方移除 `config.rh` 依賴。
- [ ] 接收方處理沒有 running Activity 時的 hub-only `config`。
- [ ] 接收方在 Activity start 的新 `config` 廣播後更新 seed/context。
- [ ] lantern 歷史查詢改讀 Activity results/artifacts。
- [ ] 控制端顯示目前場次改讀 `current_activity_id` / `activity_seed`。

## 2026-05-18 Activity Storage Split

### 背景

- Activity 改為「極簡 index + 單筆 detail + artifact 分檔」的儲存結構。
- 目前既有 `server/data/activities.json` 只視為測試資料，這次直接捨棄，不做 migration。

### 新結構

- `server/data/activities.json`：只保留 `activity_id`、`room_id`、`name`、`status`、`created_at`、`started_at`、`ended_at`。
- `server/data/activities/<activity_id>/detail.json`：保存完整單筆 metadata，且重複包含上述 index 欄位。
- `server/data/activities/<activity_id>/qa.json`：QA 詳細結果。
- `server/data/activities/<activity_id>/lantern.json`：lantern 詳細結果。

### Breaking changes

- 直接讀取 `server/data/activities.json` 的工具，現在只能拿到極簡 index。
- `detail.json` 內的 artifact 清單欄位為 `artifact_manifest`；對外 API 仍維持 `artifact_refs` 回應。
- `activity_id` 生成格式改為 `ACTIVITY-{timestamp}`。

## 2026-05-18 Room Operation Profile

### 背景

- 控制頁改成以 Room 上的單一固定操作設定重複執行，不再在 UI 中管理多組 activity template 或 activity 歷史。
- 這次變更不影響 player/control WebSocket shape，但會影響 room REST payload 與前端控制流程。

### Room REST Payload

`GET /api/rooms`、`GET /api/rooms/:id`、`POST /api/rooms`、`PUT /api/rooms/:id`、`PATCH /api/rooms/:id` 現在都包含：

```json
{
  "operation_profile": {
    "activity_defaults": {
      "name": "Standard Round",
      "activity_context": {
        "mode": "standard"
      },
      "seed": 3141
    },
    "batch_action_ids": ["ACTION-001"],
    "allow_activity_name_override": true,
    "allow_seed_override": true
  }
}
```

注意事項：

- `parameters` 應只保留房間級固定配置，不再作為主要操作 template 容器。
- 控制頁會優先讀 `operation_profile` 來建立並啟動 activity。
- Activity 歷史 API 仍保留，但不再是控制頁主流程的一部分。
