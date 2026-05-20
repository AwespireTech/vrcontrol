# VRControl Server

Go + Gin 後端服務，提供 Quest 設備/房間/動作管理，以及 WebSocket 連線與控制。

## 快速開始

### 先決條件：ADB 與 Scrcpy

Quest 裝置控制需要 **ADB**，螢幕鏡像功能需要 **scrcpy**。兩者都必須可在系統 `PATH` 中找到。

**官方下載**

- Android Platform Tools (ADB)：https://developer.android.com/tools/releases/platform-tools
- scrcpy：https://github.com/Genymobile/scrcpy/releases

**Windows**

- ADB：下載 Platform Tools → 解壓縮 → 將 `platform-tools` 目錄加入系統 `PATH`
- scrcpy：下載 Windows release → 解壓縮 → 將 `scrcpy` 所在目錄加入 `PATH`

**macOS**

- ADB：`brew install android-platform-tools`
- scrcpy：`brew install scrcpy`

> 若你是從 release zip 手動下載 scrcpy，遇到 `fork/exec ...: operation not permitted`，通常是 Gatekeeper quarantine。
> 可嘗試：`xattr -dr com.apple.quarantine $(which scrcpy)`

**Linux (Debian/Ubuntu)**

- ADB：`sudo apt-get install android-tools-adb`
- scrcpy：`sudo apt-get install scrcpy`

> `scrcpy` 會開啟鏡像視窗，需在「有桌面環境」的機器上執行（macOS 桌面、Linux X11/Wayland）。
>
> - Linux headless（無 `$DISPLAY` / 無 Wayland session）通常無法正常啟動 scrcpy。
> - Linux 若在 Wayland 下無法顯示視窗，請先確認已安裝/啟用 XWayland，或改用 X11 session 測試。
> - 若你用 systemd/LaunchAgent 等方式啟動後端，請確認該服務的 `PATH` 包含 `adb`/`scrcpy`（macOS Homebrew 常見路徑：`/opt/homebrew/bin`）。
>
> 若 `scrcpy` 未安裝，會導致鏡像相關 API（`/api/scrcpy/*`）無法使用。

### 1. 啟動後端

```bash
go run main.go
```

預設服務位址：`http://localhost:8080`

### 2. 啟動前端（選用）

```bash
cd ../client
npm install
npm run dev
```

前端管理介面：`http://localhost:5173/`

## 功能概覽

### 設備管理

- ✅ 設備 CRUD
- ✅ ADB 連接/斷開
- ✅ 實時狀態監控（電量/溫度/延遲）
- ✅ 批量操作

### 房間管理

- ✅ 房間配置、設備分配
- ✅ TCP Socket Server 管理
- ✅ 動態端口分配（3000–3100）
- ✅ 參數同步廣播

### 動作管理

- ✅ 支援 8 種動作類型
  - `wake_up`, `sleep`, `launch_app`, `stop_app`, `restart_app`, `keep_awake`, `send_key`, `install_apk`
- ✅ 批量執行
- ✅ 執行統計

> 注意：`keep_awake` 目前在後端尚未實作（`action_service.go` 未處理）。

### 網路監控

- ✅ 後台定時監控
- ✅ 自動狀態更新與重連
- ✅ 併發 Ping 檢測

### 螢幕觀看

- ✅ 外部 scrcpy 監看視窗
- ✅ WebRTC 頁內即時畫面（live view）
- ✅ WebRTC 外部 popup 視窗模式（前端路由 / popup takeover）
- ✅ scrcpy standalone stream + control channel 啟播優化

## 常用連線

- 玩家連線：`ws://localhost:8080/api/ws/client/<player_id>`
- 房間控制：`ws://localhost:8080/api/ws/control/<roomId>`

房間控制 WS 更新會包含目前的 `current_activity_id` 與 `activity_seed`。若需要讀取該局累積的 lantern 歷史資料，請直接用 Activity results/artifacts。

- 即時畫面 signaling：`ws://localhost:8080/api/ws/webrtc/<deviceId>`

## API 概覽

API 皆以 `/api` 為前綴（完整清單請見 [docs/API.md](../docs/API.md)）：

### 設備管理

- `GET /api/devices`
- `GET /api/devices/isolation`
- `GET /api/devices/:id`
- `POST /api/devices`
- `PUT /api/devices/:id`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`
- `POST /api/devices/:id/connect`
- `POST /api/devices/:id/disconnect`
- `GET /api/devices/:id/status`
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

`Room` payload 現在包含 `operation_profile`，作為控制頁的固定操作設定來源：

- `parameters`：房間級固定配置，例如 minimap、空間資料、長期 defaults。
- `operation_profile.activity_defaults`：建立 activity draft 時的預設名稱、context、seed。
- `operation_profile.batch_action_ids`：控制頁顯示的固定批次動作清單。
- `allow_activity_name_override`、`allow_seed_override`：控制頁是否允許現場臨時覆蓋少量欄位。

控制頁目前不再顯示 activity 歷史；若需要查歷史結果或 artifacts，請直接使用 Activity API。

### 動作管理

- `GET /api/actions`
- `POST /api/actions`
- `POST /api/actions/:id/execute`
- `POST /api/actions/batch/execute`

### 監控服務

- `GET /api/monitoring/status`
- `POST /api/monitoring/start`
- `POST /api/monitoring/stop`
- `POST /api/monitoring/interval`
- `POST /api/monitoring/run-once`

### 控制

- `POST /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/roomlist`

### 螢幕觀看 / Live View

- `GET /api/scrcpy/system-info`
- `POST /api/scrcpy/start/:id`
- `POST /api/scrcpy/stop/:id`
- `POST /api/scrcpy/batch/start`
- `GET /api/scrcpy/sessions`
- `POST /api/scrcpy/sessions/refresh`
- `GET /api/scrcpy/config`
- `PUT /api/scrcpy/config`
- `GET /api/scrcpy/stream/:id`
- `GET /api/ws/webrtc/:deviceId`

## WebRTC Live View 概要

- WebRTC live view 會在後端啟動 scrcpy standalone server，將 raw H264 視訊透過 Pion WebRTC 發送到瀏覽器。
- signaling 經由 `/api/ws/webrtc/:deviceId` 交換 `offer`、`answer`、`ice`、`close`、`error` 訊息。
- 後端會在 control socket 可用時送出一次 `RESET_VIDEO`，盡量提早取得第一個可解碼 keyframe。
- 設定檔中的 `video_codec_options` 可作為 live view 啟播診斷或 fallback，不影響既有外部 scrcpy 監看視窗。
- 前端新增的 popup 外部視窗模式仍然使用相同的 `/api/ws/webrtc/:deviceId` signaling；它不新增任何後端 API，只是改變前端由哪個視窗承載播放器。
- popup takeover、release、closing 與來源頁面同步中斷等流程皆屬前端瀏覽器內部協調，不需額外配置後端。

## Socket 協議

### 傳輸方式

- 所有 room socket 訊息都是 WebSocket text frame JSON，不使用額外 `\n` framing。
- 玩家端與控制端使用不同路徑：`/api/ws/client/:clientId`、`/api/ws/control/:roomId`。

### 玩家 Socket: Client -> Server

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

- `status` enum 目前為 `0=idle`、`1=playing`、`2=pause`、`3=stop`、`4=snapshot`。
- 非 snapshot 狀態只會更新 room 內的玩家狀態，不會觸發額外廣播。
- 當 `status=4` 時，後端會把玩家標記為已就緒 snapshot；等 room 內所有玩家都送出 snapshot 後，才會觸發資料快照。

### Snapshot 行為

- snapshot 協調目前由玩家主動送出 `play_status.status = 4` 來觸發。
- 當所有玩家都 ready 後，room 會完成 snapshot acknowledgement；running Activity 的 lantern 與 QA 聚合資料會保留到 Activity end 時封存為 artifacts。
- 目前沒有額外的 snapshot response event；這是 room 內部控制流程。

### Activity Results API

- Lantern 與 QA 歷史資料請透過 `GET /api/activities/:activityId/results` 的 `artifact_refs` 查詢。
- legacy room-hash-based lantern control API 已移除。

### 目前限制

- `play_status` 目前尚未被輸出到 control room update 或 REST API。
- room 清空時的 lantern / QA runtime data 不會落到 legacy storage；正式封存點是 Activity end。

#### Heartbeat

```json
{
  "message_type": "heartbeat",
  "heartbeat": {
    "timestamp": 1715000000000,
    "device_id": "device_001",
    "chapter": 3,
    "message": "ready"
  }
}
```

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

#### 玩家 QA 作答

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

- `status` enum 目前為 `0=idle`、`1=playing`、`2=pause`、`3=stop`、`4=snapshot`。
- 非 snapshot 狀態只會更新 room 內的玩家狀態，不會觸發額外廣播。
- 當 `status=4` 時，後端會把玩家標記為已就緒 snapshot；等 room 內所有玩家都送出 snapshot 後，才會觸發資料快照。
- `ready_to_move` 會進入 `MovementCheck`，符合條件時廣播 `move_command`。
- `wait_to_sync` 會進入 `SyncCheck`，全員到齊時廣播 `sync_command`。
- QA input 目前以 `qid`/`aid` 為準，不再使用舊的 `question_id`、`state_bool`、`state_int`。
- 後端會依連線玩家身分覆蓋目前答案，因此 payload 內不需要 `device_id`。
- `shot_event`、`lantern`、`resume_qa` 也走同一條 socket，由 room runtime 轉成 event 廣播。

### Snapshot 行為

- snapshot 協調目前由玩家主動送出 `play_status.status = 4` 來觸發。
- 當所有玩家都 ready 後，room 會 flush 記憶體中的 lantern 與 QA 聚合資料。
- 目前沒有額外的 snapshot response event；這是 room 內部控制流程。

### 玩家 Socket: Server -> Client

玩家加入 room 後，後端會依序送出 `assign_sequence`，以及目前 hub / Activity config：

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

- `room_id` 代表目前 hub / group。
- `activity_id` 代表正式遊戲/session；沒有 running Activity 時可能省略。
- `seed` 來自 running Activity，不再由玩家進出 room 自動建立。
- `activity_context_path` 指向該場 Activity 的 immutable context，QA 題目與規則請從該 activity context 取得。

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

- 這是 room 目前題目的完整作答狀態，不是單筆增量更新。
- 後端只有在答案資料真的發生變更時才會重送 QA event。
- 活動結束時，room runtime 會把 QA answers 與題目鎖定狀態封存為 activity 的 `qa` artifact；房間清空不代表 Activity 結束。

#### Assign Sequence

```json
{
  "event_type": "assign_sequence",
  "sequence": 2
}
```

- `play_command` payload 已在 room runtime 中定義；目前這個 repository 尚未暴露對外 API 來觸發播放/停止廣播。
- room 仍會送出既有的 `shot_event`、`lantern`、`resume_qa` 等 event。

### 控制端 Socket: Server -> Controller

控制端會持續收到 room update，例如：

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
      "last_update": "2026-05-07T10:00:00Z"
    }
  ]
}
```

這條 socket 目前只用於觀測房間狀態，不承接 controller -> server 命令。
若需要讀取該局累積的 lantern 歷史資料，請用 `current_activity_id` 查 Activity results/artifacts。

### Activity Results API

- Lantern 與 QA 歷史資料請透過 `GET /api/activities/:activityId/results` 的 `artifact_refs` 查詢。
- legacy room-hash-based lantern control API 已移除。

### 目前限制

- `play_status` 目前尚未被輸出到 control room update 或 REST API。
- room 清空時的 lantern / QA runtime data 不會落到 legacy storage；正式封存點是 Activity end。

## 基本使用流程

### 添加第一個設備

1. 進入「設備管理」
2. 點擊「+ 添加設備」
3. 填寫設備名稱、IP、ADB 端口（預設 5555）
4. 點擊「創建」

### 連接設備

**前提：** 已開啟開發者模式與 ADB over WiFi，設備與伺服器同網段。

1. 點擊「連接」
2. 連線成功後狀態顯示「在線」

### 創建房間

1. 進入「房間管理」
2. 點擊「+ 創建房間」
3. 添加設備並啟動 Socket Server

### 執行動作

1. 進入「動作管理」
2. 建立動作並設定 `params`
3. 選擇設備後執行

## 常見動作範例

### 喚醒設備

```json
{
  "name": "喚醒所有設備",
  "action_type": "wake_up",
  "params": {}
}
```

### 啟動應用

```json
{
  "name": "啟動 Beat Saber",
  "action_type": "launch_app",
  "params": {
    "package": "com.beatgames.beatsaber",
    "activity": ".MainActivity"
  }
}
```

### 安裝 APK

```json
{
  "name": "安裝應用",
  "action_type": "install_apk",
  "params": {
    "apk_path": "/path/to/app.apk",
    "replace": true,
    "grant_permissions": true
  }
}
```

## 資料儲存

系統資料存於 `data/`：

- `devices.json`
- `rooms.json`
- `actions.json`
- `scrcpy_config.json`
- `preferences.json`

## 故障排除

### 設備無法連接

1. 確認 ADB over WiFi 啟用
2. 確認設備與伺服器同網段
3. 檢查防火牆與 5555 端口

### Socket Server 無法啟動

1. 端口 3000–3100 是否被占用
2. 權限不足或防火牆阻擋

### 監控狀態不更新

1. 監控服務是否啟動
2. 設備 IP 是否有效
3. 網路連線是否正常

## 環境變數

支援 `.env`（載入失敗不影響啟動），常見設定：

- `GIN_MODE=release`

## Docker（選用）

```bash
docker compose up
```

請注意：Docker Compose 在專案根目錄提供，且前端啟動需 `client/Dockerfile.dev`。
