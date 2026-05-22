# API 端點總表

## Base URL

- 本機開發：`http://localhost:8080`
- API 前綴：`/api`

## API 路由

### 裝置管理

- `GET /api/devices`
- `GET /api/devices/isolation`
- `GET /api/devices/usb`
- `GET /api/devices/:id`
- `POST /api/devices`
- `PUT /api/devices/:id`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`
- `POST /api/devices/usb/tcpip/enable`
- `POST /api/devices/:id/connect`
- `POST /api/devices/:id/disconnect`
- `GET /api/devices/:id/status`
- `POST /api/devices/:id/ping`
- `POST /api/devices/batch/connect`
- `POST /api/devices/batch/ping`
- `POST /api/devices/batch/status`
- `POST /api/devices/batch/auto-reconnect`
- `POST /api/devices/:id/auto-reconnect/reset`
- `POST /api/devices/batch/auto-reconnect/reset`

### 房間管理

- `GET /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms`
- `PUT /api/rooms/:id`
- `PATCH /api/rooms/:id`
- `DELETE /api/rooms/:id`
- `POST /api/rooms/:id/devices/:deviceId`
- `DELETE /api/rooms/:id/devices/:deviceId`
- `POST /api/rooms/:id/activities`
- `GET /api/rooms/:id/activities`

房間 payload 現在包含 `operation_profile`，用來保存單一可重複使用的操作設定：

```json
{
  "room_id": "ROOM-001",
  "name": "VR Room 1",
  "parameters": {
    "minimap": {
      "width": 6,
      "depth": 6
    }
  },
  "operation_profile": {
    "activity_defaults": {
      "name": "Standard Round",
      "activity_context": {
        "mode": "standard",
        "round": 1
      },
      "seed": 3141
    },
    "batch_action_ids": ["ACTION-001", "ACTION-002"],
    "allow_activity_name_override": true,
    "allow_seed_override": true
  }
}
```

- `parameters` 只保留房間級固定配置，例如 minimap、空間資料、長期 defaults。
- `operation_profile` 是控制頁重複執行的主要來源，包含 activity 預設與固定批次動作。

### 活動管理

- `GET /api/activities/:activityId`
- `POST /api/activities/:activityId/start`
- `POST /api/activities/:activityId/end`
- `POST /api/activities/:activityId/cancel`
- `GET /api/activities/:activityId/results`
- `GET /api/activities/:activityId/context`

### 動作管理

- `GET /api/actions`
- `GET /api/actions/:id`
- `POST /api/actions`
- `PUT /api/actions/:id`
- `PATCH /api/actions/:id`
- `DELETE /api/actions/:id`
- `POST /api/actions/:id/execute`
- `POST /api/actions/batch/execute`

### 監控服務

- `GET /api/monitoring/status`
- `POST /api/monitoring/start`
- `POST /api/monitoring/stop`
- `POST /api/monitoring/interval`
- `POST /api/monitoring/run-once`

### Scrcpy 螢幕鏡像

- `GET /api/scrcpy/system-info`
- `POST /api/scrcpy/start/:id`
- `POST /api/scrcpy/stop/:id`
- `POST /api/scrcpy/batch/start`
- `GET /api/scrcpy/sessions`
- `POST /api/scrcpy/sessions/refresh`
- `GET /api/scrcpy/config`
- `PUT /api/scrcpy/config`
- `GET /api/scrcpy/stream/:id`

### 使用者偏好

- `GET /api/preferences`
- `PUT /api/preferences`

### 控制

- `POST /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/roomlist`

### 簡化控制

- `GET /api/simple/forcemove/:roomId/:clientId/:dest`
- `GET /api/simple/forceallmove/:roomId/:dest`

### WebSocket

- `GET /api/ws/client/:clientId`
- `GET /api/ws/control/:roomId`
- `GET /api/ws/webrtc/:deviceId`

## 房間 Player WebSocket

### 目的與邊界

- `GET /api/ws/client/:clientId` 是玩家裝置連到 room runtime 的雙向 WebSocket。
- 這條路徑承接玩家 heartbeat、章節推進、同步等待、播放狀態、QA 作答與遊戲事件，並由 room runtime 轉成廣播 event。
- `clientId` 會在後端正規化成 device key；若裝置尚未分配到房間，連線會先留在 standby，直到設備與房間對上。
- 玩家進出 room 只代表 hub 連線狀態，不再代表正式 session lifecycle；正式遊戲/session 由 Activity start 建立，seed 也歸屬於 Activity。

### Client -> Server 訊息

#### Heartbeat

```json
{
  "message_type": "heartbeat",
  "heartbeat": {
    "timestamp": 1715000000000,
    "device_id": "device_001",
    "chapter": 3,
    "message": "ready",
    "head_position": { "x": 0, "y": 1.6, "z": 0 },
    "head_forward": { "x": 0, "y": 0, "z": 1 },
    "left_hand_position": { "x": -0.2, "y": 1.2, "z": 0.4 },
    "left_hand_forward": { "x": 0, "y": 0, "z": 1 },
    "right_hand_position": { "x": 0.2, "y": 1.2, "z": 0.4 },
    "right_hand_forward": { "x": 0, "y": 0, "z": 1 },
    "left_hand_available": true,
    "right_hand_available": true
  }
}
```

#### Play Status

```json
{
  "message_type": "play_status",
  "play_status": {
    "timestamp": 1716379200000,
    "status": 1
  }
}
```

- `status` 目前使用數值 enum：`0=idle`、`1=playing`、`2=pause`、`3=stop`、`4=snapshot`。
- 當 `status` 不是 `4` 時，後端只會更新該玩家在 room memory 的播放狀態。
- 這個狀態目前尚未出現在 control room update 或其他公開 API 回應中。

#### Ready To Move

```json
{
  "message_type": "ready_to_move",
  "ready_to_move": {
    "timestamp": 1715000000000,
    "device_id": "device_001",
    "chapter": 3
  }
}
```

- room 會用目前房內玩家狀態做 `MovementCheck`。
- 若所有需要同步的玩家都已 ready，後端會送出 `move_command`；否則只更新該玩家狀態，等待其他玩家。

#### Wait To Sync

```json
{
  "message_type": "wait_to_sync",
  "wait_to_sync": {
    "timestamp": 1715000000000,
    "device_id": "device_001",
    "chapter": 4
  }
}
```

- room 會用目前房內玩家章節做 `SyncCheck`。
- 當所有玩家都已到達或超過指定章節時，後端會廣播 `sync_command`。

#### QA 作答

```json
{
  "message_type": "qa",
  "qa": {
    "timestamp": 1715846400000,
    "qid": "question_01",
    "aid": "answer_b"
  }
}
```

- `qid` 是題目 ID，`aid` 是答案 ID。
- 作答 payload 不再使用舊的 `question_id`、`state_bool`、`state_int` 欄位。
- 後端會以目前連線的玩家身分覆蓋該題的最新答案，不需要另外傳 `device_id`。

#### Snapshot 協調

- 當玩家送出 `play_status.status = 4` 時，後端會把該玩家標記為等待 snapshot。
- 當 room 內所有在線玩家都已送出 snapshot 狀態後，後端會觸發一次 room snapshot 流程，將目前記憶體中的 lantern 與 QA 聚合資料 flush 到儲存層，並重置 snapshot 等待旗標。
- 這個流程目前是 room 內部協調邏輯，尚未定義額外的 server -> client snapshot event payload。

#### 其他玩家事件

- `shot_event`、`lantern`、`resume_qa` 仍由同一條 socket 傳入。
- 後端會把這些訊息轉成對應 `event_type` 廣播給房內其他玩家或所有玩家。

### Server -> Client Event 訊息

#### Config

```json
{
  "event_type": "config",
  "config": {
    "room_id": "room-a",
    "activity_id": "ACTIVITY-123456",
    "activity_context_path": "/api/activities/ACTIVITY-123456/context",
    "seed": 3141
  }
}
```

- `config` 會在玩家成功加入 room 後送出，也會在 Activity start 時重新廣播給已連線玩家。
- `room_id` 代表目前 hub / group。
- `activity_id` 代表正式遊戲/session；沒有 running Activity 時可能省略。
- `seed` 來自 running Activity，不再由玩家進出 room 自動建立。
- `activity_context_path` 指向該場 Activity 的 immutable context；QA 題目、題序、計分與顯示規則應從該 context 取得。
- Activity start 時，server 會先廣播這個 `config`，再送出 `play_command.isstart = true`。
- Activity end 時，server 會先送出 `play_command.isstart = false`，再廣播不帶 `activity_id` 的新 `config`。
- 若玩家在 room 已有 running Activity 時中途加入，server 也會先送 `config`，再補送一次 `play_command.isstart = true`，讓 late join client 對齊目前播放狀態。

#### Move Command

```json
{
  "event_type": "move_command",
  "move_command": {
    "force": false,
    "chapter": 4
  }
}
```

#### Sync Command

```json
{
  "event_type": "sync_command",
  "sync_command": {
    "pcnt": 4
  }
}
```

- `pcnt` 是廣播當下的房內玩家數。

#### Play Command

```json
{
  "event_type": "play_command",
  "play_command": {
    "pcnt": 4,
    "isstart": true
  }
}
```

- `isstart=true` 代表開始播放；`false` 代表停止播放。
- 這個 event 目前由 Activity lifecycle 觸發，不提供獨立的 REST API 來手動廣播。
- Start ordering 固定為 `config` -> `play_command(true)`；End ordering 固定為 `play_command(false)` -> cleared `config`。
- 若是 late join player，收到的第一個 `play_command(true)` 代表「補同步到目前已開始的 Activity」，不代表重新開始一場新的 Activity。

#### QA 聚合結果

```json
{
  "event_type": "qa",
  "qa": {
    "qid": "question_01",
    "answers": {
      "device_001": "answer_b",
      "device_002": "answer_a"
    }
  }
}
```

- 這個 event 會廣播「目前題目」的完整答案對照表，而不是單一玩家的 delta。
- `answers` 的 key 是正規化後的 `device_id`，value 是該玩家目前選擇的 `aid`。
- room 只會在 QA 狀態變更時廣播新的聚合結果，避免每個 tick 都重送同一份資料。

#### Assign Sequence

```json
{
  "event_type": "assign_sequence",
  "sequence": 2
}
```

#### 其他事件

- `shot_event`、`lantern`、`qa`、`resume_qa` 也都會以 `event_type` 包裝後回送。

## 房間 Control WebSocket

### Room Update 格式

- `GET /api/ws/control/:roomId` 會持續推送房間狀態 JSON。
- 這條 socket 只負責 server -> controller 的房間觀測資料流；目前沒有定義 controller -> server 的命令格式。
- 回傳內容包含 `room_id`、`current_activity_id`、`activity_seed`、`activity_status`、`player_count`、`players`。
- `players[]` 目前包含 `device_id`、`chapter`、`sequence`、`ready_to_move`、位置/朝向欄位、`message`、`last_update`。
- `room_hash` 不再作為正式場次識別；目前場次請以 `current_activity_id` 判斷。
- Lantern / QA 歷史資料請透過 Activity results/artifacts 查詢，不再依賴 room-hash-based lantern 查詢流程。

#### Room Update 範例

```json
{
  "room_id": "room-a",
  "current_activity_id": "ACTIVITY-123456",
  "activity_name": "Round 1",
  "activity_status": "running",
  "activity_seed": 3141,
  "player_count": 2,
  "players": [
    {
      "device_id": "device_001",
      "chapter": 3,
      "sequence": 1,
      "ready_to_move": true,
      "message": "ready",
      "left_hand_position": { "x": 0, "y": 0, "z": 0 },
      "left_hand_forward": { "x": 0, "y": 0, "z": 1 },
      "right_hand_position": { "x": 0, "y": 0, "z": 0 },
      "right_hand_forward": { "x": 0, "y": 0, "z": 1 },
      "left_hand_available": true,
      "right_hand_available": true,
      "head_position": { "x": 0, "y": 1.6, "z": 0 },
      "head_forward": { "x": 0, "y": 0, "z": 1 },
      "last_update": "2026-05-07T10:00:00Z"
    }
  ]
}
```

## WebRTC 即時畫面

### 目的與邊界

- `GET /api/ws/webrtc/:deviceId` 提供頁內即時畫面的 WebRTC signaling 通道。
- 這條路徑會啟動 scrcpy standalone server，並把 H264 視訊經由 WebRTC video track 送到瀏覽器。
- 既有 `POST /api/scrcpy/start/:id` 仍是外部 scrcpy 視窗監看用途，兩者並存，不互相取代。
- 前端新增的 live-stream popup 模式不會新增任何後端 API 或 WebSocket 端點；popup 與主頁仍共用同一組 `/api/ws/webrtc/:deviceId` signaling 路徑。
- popup 與主頁之間的 takeover / release / closing / source-unavailable 同步屬於前端瀏覽器內部通訊，使用 BroadcastChannel 協調，並非後端 signaling 契約的一部分。

### 連線方式

- 瀏覽器端應使用 WebSocket 連線至 `/api/ws/webrtc/:deviceId`。
- 前端實作會先送出 `offer`，後端回傳 `answer`，雙方再交換 `ice`。
- 結束時前端可送出 `close` 主動關閉 session。

### Signal Message 格式

#### Offer

```json
{
  "type": "offer",
  "sdp": "v=0\r\n..."
}
```

#### Answer

```json
{
  "type": "answer",
  "sdp": "v=0\r\n..."
}
```

#### ICE Candidate

```json
{
  "type": "ice",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

#### End of Candidates

```json
{
  "type": "ice"
}
```

#### Close

```json
{
  "type": "close"
}
```

#### Error

```json
{
  "type": "error",
  "error": "source_probe_failed"
}
```

### WebRTC 錯誤碼

- `invalid_signal`: 收到無法解析或不合法的 signaling message。
- `source_server_exited_with_error`: scrcpy standalone server 異常退出。
- `source_server_exited`: scrcpy standalone server 已結束。
- `source_backend_not_ready`: 後端來源尚未完成啟播準備。
- `source_dummy_byte_error`: scrcpy 啟播初始化失敗。
- `source_probe_eof`: 視訊來源在 probe 階段提前結束。
- `source_probe_failed`: 無法探測到有效的 H264 畫面資料。
- `source_connected_but_no_data`: 已連上來源 socket，但未收到畫面 bytes。
- `invalid_h264_annexb_stream`: H264 Annex-B 格式不合法。
- `no_h264_packets`: 未產生可播放的 H264 畫面封包。

### Scrcpy Config 與 Live View 關聯

- `GET /api/scrcpy/config` / `PUT /api/scrcpy/config` 目前也會影響 WebRTC live view 的 standalone scrcpy 啟播參數。
- `video_codec_options` 只會套用到 live view 的 standalone server 路徑，不會改變既有外部 scrcpy 視窗參數。
- `video_codec_options` 可作為首幀等待過久時的 fallback/診斷手段，例如 `i-frame-interval:int=1`；預設建議維持空字串，優先依賴 control channel 與 RESET_VIDEO 啟播優化。

#### 房間控制更新格式

- `GET /api/ws/control/:roomId` 會持續推送房間狀態 JSON。
- 回傳內容包含 `room_id`、`current_activity_id`、`activity_name`、`activity_status`、`activity_started_at`、`activity_seed`、`player_count`、`players`。

## Activity Context Sessions

### 目的與邊界

- Activity 是正式的 app session / 一局遊戲 entity，使用 `activity_id` 作為主要識別。
- Room 仍負責設備分組與 WebSocket hub runtime；Activity 負責開始、執行中 seed/context、結果與 artifact 保存。
- `activity_context` 是一場活動共用、且可由前端或參與設備讀取的 immutable snapshot，不是使用者偏好，也不是房間設定本身。
- 控制頁第一版不再直接管理 activity 歷史；它通常會先讀取 room `operation_profile`，再建立 draft 並立即 start。
- `server/data/activities.json` 只保留 activity index；完整單筆 metadata 會保存到 `server/data/activities/<activity_id>/detail.json`，其中也會重複包含 index 欄位。

### 建立活動草稿

- `POST /api/rooms/:id/activities`

```json
{
  "name": "Round 1 - Warmup",
  "activity_context": {
    "mode": "warmup",
    "round": 1,
    "qa": {
      "questionSetId": "QSET-001",
      "questionOrder": ["question_01", "question_02"],
      "timeLimitSec": 30,
      "allowRetry": false,
      "scoreMode": "team",
      "display": {
        "showCountdown": true,
        "showResultAfterEachQuestion": true
      },
      "resumePolicy": "from_current_question"
    }
  }
}
```

- QA 題目、題序、計分、倒數與顯示規則屬於單場活動，應放在 `activity_context.qa`。
- `Room.parameters.qa_defaults` 若存在，只能當作建立 activity draft 時的模板；活動啟動後以 `activity_context.qa` 快照為準。
- 若房間有 `operation_profile.activity_defaults`，控制頁應優先使用該預設來建立 draft，而不是在操作頁臨時維護多組 template。

### 啟動活動

- `POST /api/activities/:activityId/start`
- 可選擇在啟動前覆蓋 draft 的 `name` 或 `activity_context`。

```json
{
  "name": "Round 1 - Warmup",
  "seed": 3141,
  "activity_context": {
    "mode": "warmup",
    "round": 1
  }
}
```

- `seed` 可選；未提供時後端會在 Activity start 時產生。
- Activity start 後，server 會先透過玩家 socket `config` event 廣播 `activity_id`、`activity_context_path` 與 Activity seed，再送出 `play_command(true)`。

### 取得活動結果

- `GET /api/activities/:activityId/results`

```json
{
  "success": true,
  "data": {
    "activity_id": "ACTIVITY-123456",
    "status": "ended",
    "result_summary": {
      "participant_count": 4,
      "event_counts": {
        "lantern": 12,
        "qa": 3
      },
      "duration_sec": 182
    },
    "artifact_refs": [
      {
        "name": "qa",
        "path": "server/data/activities/ACTIVITY-123456/qa.json",
        "type": "qa_result"
      },
      {
        "name": "lantern",
        "path": "server/data/activities/ACTIVITY-123456/lantern.json",
        "type": "lantern_result"
      }
    ]
  }
}
```

- 若活動期間有 QA runtime 狀態，結束活動時會封存 `qa` artifact，內容包含最終 `answers`、`question_locked`、`current_qid` 與當場 `qa_context` 快照。
- 若活動期間有 lantern event，結束活動時會封存 `lantern` artifact；新接收方應以 `activity_id` 查詢 lantern 歷史。
- `detail.json` 會同步保存 `activity_id`、`room_id`、`name`、`status`、`created_at`、`started_at`、`ended_at`，方便單筆直接檢視。
- room runtime 仍負責即時 QA 聚合與廣播；歷史查詢以 activity result/artifact 為準。
- 控制頁不再顯示這些歷史結果；需要查詢歷史時，請直接使用 activity API。

### 取得活動上下文

- `GET /api/activities/:activityId/context`
- 回傳的是啟動當下快照下來的 `activity_context`，不會隨後續系統設定變動而改變。

## 已移除舊端點

- 舊 `/control/*`、`/simple/*`、`/ws/*` 端點已下線，不保留相容 alias。
- 舊 `/control/playerlist`、`/control/createroom`、`/control/assignroomandseq` 也已移除。

## 規格與參數

- 動作參數規格：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)
