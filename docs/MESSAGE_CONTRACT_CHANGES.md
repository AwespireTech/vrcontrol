# Message Contract Changes

本文件記錄會影響接收方專案的 breaking changes。修改 socket 或 API message shape 時，請先在這裡留下舊格式、新格式與同步事項。

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
    "seed": 3141
  }
}
```

Breaking changes:

- `seed` 的來源從 room runtime session 改為 running Activity。
- `rh` deprecated；接收方不得再將 `rh` 視為正式 session id。
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

- `room_hash` deprecated。
- `current_activity_id` 是目前正式 session / game 的主 key。
- `activity_seed` 是目前 running Activity 的 seed。
- Room update 代表 hub 狀態與 current activity 狀態，不再代表玩家進出建立的 session 狀態。

接收方同步事項：

- UI 或控制端若需要判斷目前場次，改用 `current_activity_id`。
- 若需要 seed，改讀 `activity_seed` 或 activity API 回傳的 runtime snapshot。

### Lantern Results

舊查詢：

```http
GET /api/control/lantern/:roomId/:roomHash
```

新查詢：

```http
GET /api/activities/:activityId/results
```

再從 `artifact_refs` 找到 `name = "lantern"`、`type = "lantern_result"` 的 artifact。

Breaking changes:

- 新資料以 `activity_id` 保存為 activity artifact。
- 舊 `room_id + room_hash` lantern endpoint 保留為 deprecated fallback，不再是新流程主路徑。
- 無 running Activity 時收到的 lantern event 只做即時廣播，不保存成 activity result。

### Player -> Server Events Without Running Activity

`shot_event`、`lantern`、`qa`、`resume_qa` 仍可透過 room runtime 即時處理與廣播。

Breaking changes:

- 沒有 running Activity 時，這些事件不會保存到 activity result/artifact。
- 只有 running Activity 期間的事件會歸屬到 `activity_id`。

## Migration Checklist

- [ ] 接收方改以 `activity_id` 作為正式 session id。
- [ ] 接收方停止依賴 `config.rh`。
- [ ] 接收方處理沒有 running Activity 時的 hub-only `config`。
- [ ] 接收方在 Activity start 的新 `config` 廣播後更新 seed/context。
- [ ] lantern 歷史查詢改讀 Activity results/artifacts。
- [ ] 控制端顯示目前場次改讀 `current_activity_id` / `activity_seed`。
