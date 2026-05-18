# 專案架構概覽

## 系統總覽

- 後端：Go + Gin，負責設備/房間/動作/監控與 Socket 管理
- 前端：React + Vite，提供設備管理 UI
- 外部依賴：ADB（裝置控制）、scrcpy（螢幕鏡像）

## 目前監看模式

- 外部監看視窗：沿用 scrcpy CLI，由 `/api/scrcpy/*` 啟動並管理外部桌面視窗。
- 頁內即時畫面：使用 WebRTC live view，由 `/api/ws/webrtc/:deviceId` 建立 signaling，後端以 scrcpy standalone server 提供 H264 來源。
- 兩條路徑目前並存。舊的 scrcpy 監看按鈕仍保留，WebRTC live view 是新增的頁內觀看方式。

## 模組分層

### 後端（API 模組）

- 路由註冊：[server/routes/api_routes.go](../server/routes/api_routes.go)
- 控制器：server/controller
- 服務層：server/service
- 資料存取：server/repository
- 資料模型：server/model
- ADB 管理：server/adb
- Scrcpy 管理：server/scrcpy
- WebRTC H264 發送：server/webrtc

### 前端

- App 入口：[client/src/App.tsx](../client/src/App.tsx)
- 頁面實作：client/src/app
- 主要前端入口 URL：`/`（管理介面）
- API 封裝：client/src/services/api.ts
- 型別定義：client/src/services/api-types.ts

## 資料流

### 動作執行

1. 前端建立動作（`params` 依規格填寫）
2. 後端保存至 JSON 資料庫
3. 執行時由後端讀取動作並透過 ADB 對設備下指令

### Activity Context Sessions

1. 房間設定頁在 `Room.operation_profile` 保存單一可重複使用的 activity 預設與固定批次動作。
2. 前端在房間控制頁通常不是維護多筆 draft/history，而是用 room 的 `operation_profile.activity_defaults` 建立 activity draft。
3. 後端將 draft 保存到 `server/data/activities.json`，作為正式場次資料索引。
4. 啟動活動時，後端會將 draft 轉成 running activity，並把 `activity_context` 當作 immutable snapshot 保存。
5. room runtime 會保存目前活動狀態，並在收到 lantern、shot、qa、resume_qa 等事件時，把事件統計歸屬到當前 `activity_id`。
6. 活動結束時，後端以 `activity_id` 保存結果摘要與 artifact 索引，而不是依賴房間清空才封存。

### 裝置監控

1. 監控服務定期 Ping 裝置 IP
2. 狀態更新回寫至資料庫
3. 前端定期拉取狀態並更新 UI

### Room 播放狀態與 Snapshot

1. 玩家透過 `/api/ws/client/:clientId` 傳送 `play_status` 訊息到 room runtime。
2. 當 `status` 為 `idle/playing/pause/stop` 時，後端只更新該玩家在記憶體中的播放狀態。
3. 當 `status` 為 `snapshot` 時，後端將該玩家標記為已就緒 snapshot，並用 `CheckSnapShot` 檢查當前 room 內所有玩家是否都已送出 snapshot。
4. 當所有玩家都已就緒後，room 會透過 `SnapShotControl` 觸發一次資料快照流程，將目前記憶體中的 lantern 與 QA 聚合資料 flush 掉。
5. 目前房間清空時的 lantern / QA flush 已不再自動觸發，snapshot 是新的主要切點。

### Lantern 最新列表查詢

1. 控制端可呼叫 `GET /api/control/lantern/newest` 取得 lantern 資料目錄中最新的檔名清單。
2. 後端會依檔案修改時間排序後，回傳最新檔案名稱陣列。
3. 目前控制器固定要求最新 2 筆，因此這條 API 現階段更像是「最近 session 快速入口」而不是完整分頁列表。

### Scrcpy 鏡像

1. 前端呼叫 `/api/scrcpy/*`
2. 後端檢查 scrcpy 是否安裝
3. 啟動 scrcpy 子行程並維護 session 狀態

### WebRTC 即時畫面

1. 前端在設備頁或房間控制頁開啟 `LiveStreamPlayer`。
2. 前端透過 `/api/ws/webrtc/:deviceId` 建立 WebSocket signaling。
3. 後端 `WebRTCStreamController` 啟動 `ScrcpyStreamService`，建立 scrcpy standalone server session。
4. `server/scrcpy/stream_manager.go` 會建立 video socket，並在可用時嘗試建立 control socket。
5. control socket 建立成功後，後端會送出一次 `RESET_VIDEO`，盡量提早取得第一個可解碼 keyframe。
6. `server/webrtc/streamer.go` 讀取 scrcpy raw H264 Annex-B stream，重組 access unit，並透過 Pion sample track 寫入 WebRTC video。
7. 瀏覽器端收到 track 後，由 `client/src/components/console/live-stream-player.tsx` 顯示畫面，並回報首幀與解碼診斷資訊。

### 房間同步與播放控制

1. 玩家裝置透過 `/api/ws/client/:clientId` 連到 room runtime，持續送出 `heartbeat` 更新姿態、章節與狀態文字。
2. 玩家送出 `ready_to_move` 後，後端在 `server/sockets/move.go` 執行 `MovementCheck`；當同步條件成立時，由 `MoveControl` 廣播 `move_command`。
3. 玩家送出 `wait_to_sync` 後，後端執行 `SyncCheck`；當房內玩家都到達或超過指定章節時，由 `SyncControl` 廣播 `sync_command`。
4. room runtime 也保留 `PlayCommander` channel，可對全房廣播 `play_command`，攜帶目前玩家數與 `isstart` 播放狀態。
5. 控制端透過 `/api/ws/control/:roomId` 只讀取 room update，不直接經由這條 socket 下 room command。

### Room Hub、Activity Session 與 QA 聚合

1. 玩家加入 room 後，後端會先送 `assign_sequence`，再送 `config` event，讓該玩家取得目前 hub 狀態。
2. 只有 Activity lifecycle 代表正式 app session / 一局遊戲；玩家進出 room 不再自動建立正式 session。
3. Activity start 時會產生或使用指定 seed，並重新廣播 `config` event，內容包含 `activity_id`、`activity_context_path` 與 Activity seed。
4. Room 可在 `operation_profile` 內保存固定 activity defaults 與固定批次動作，但正式 session 資料仍屬於 Activity。
5. QA 題目、題序、計分、倒數與顯示規則屬於單場活動，放在 `activity_context.qa`；Room 只保留物理房間、設備分組、固定操作設定與 runtime 同步狀態。
6. 玩家作答時，透過 `/api/ws/client/:clientId` 送出 `qa` 訊息，payload 只包含 `qid` 與 `aid`。
7. room runtime 會把答案寫入 `Answers[qid][device_id]`，同一玩家對同一題重送時會直接覆蓋舊答案。
8. update loop 僅在 QA 狀態變更時廣播一次聚合後的 `qa` event，內容是該題目前所有玩家答案的完整 map。
9. 活動結束時，room runtime 會把 QA answers、locked questions、lantern events 與當場 context 封存成 activity artifacts；當房間玩家數回到 0 時，不代表 Activity 結束。

### Live View Popup Takeover

1. 使用者在設備頁或房間控制頁的 live-stream section 點擊「在新視窗開啟」。
2. 前端透過 `window.open` 開啟 `/live-stream-popup`，popup 頁面載入後用 BroadcastChannel 對主頁送出 `popup-ready`。
3. 主頁收到 `popup-ready` 後送出 `init`，後續在清單或 layout 變動時送出 `state-update`。
4. popup 套用第一次 `init` 後送出 `takeover-requested`，主頁才切換到 takeover placeholder，停止在主頁 DOM 中渲染播放器。
5. takeover 期間主頁仍維護 stream 清單與版型，popup 為唯一播放器承載者。
6. 使用者在主頁點「回到本頁顯示」時，主頁切回 inline stage，並送出 `takeover-released`。
7. 若 popup 關閉，會送出 `popup-closing`，主頁自動解除 takeover 並恢復頁內顯示。
8. 若主頁關閉或重新整理，會送出 `source-unavailable`，popup 顯示來源頁面已中斷同步的提示，但不自動關閉視窗。

## Live View 主要模組

### 前端

- [client/src/app/devices/page.tsx](../client/src/app/devices/page.tsx)：設備頁的 live-stream section、外部視窗接管狀態與單台開啟入口。
- [client/src/app/rooms/[id]/control/page.tsx](../client/src/app/rooms/%5Bid%5D/control/page.tsx)：房間控制頁的 live-stream section、批次開啟入口與 popup takeover 流程。
- [client/src/app/live-stream-popup/page.tsx](../client/src/app/live-stream-popup/page.tsx)：外部 live-stream 視窗頁面，承接 popup 顯示與同步狀態提示。
- [client/src/components/console/live-stream-player.tsx](../client/src/components/console/live-stream-player.tsx)：共用播放器，負責 signaling、peer lifecycle、首幀等待提示與診斷面板。
- [client/src/components/console/live-stream-stage.tsx](../client/src/components/console/live-stream-stage.tsx)：共用 inline stack / grid 排版容器，供主頁與 popup 共用。
- [client/src/components/console/live-stream-takeover-placeholder.tsx](../client/src/components/console/live-stream-takeover-placeholder.tsx)：主頁在 popup 接管期間顯示的 placeholder 與回到本頁顯示控制。
- [client/src/lib/utils/live-stream-popup.ts](../client/src/lib/utils/live-stream-popup.ts)：popup `window.open` helper、BroadcastChannel 訊息型別與跨視窗同步工具。
- [client/src/services/api.ts](../client/src/services/api.ts)：`webrtcApi.getSignalUrl()` 與錯誤碼對應。

### 後端

- [server/controller/webrtc_stream_controller.go](../server/controller/webrtc_stream_controller.go)：WebRTC signaling 入口、錯誤分類與 session lifecycle。
- [server/service/scrcpy_stream_service.go](../server/service/scrcpy_stream_service.go)：將 device/config 轉成 live view stream session。
- [server/scrcpy/stream_manager.go](../server/scrcpy/stream_manager.go)：scrcpy standalone 啟播、source probe、control socket、RESET_VIDEO 與 fallback。
- [server/scrcpy/protocol.go](../server/scrcpy/protocol.go)：目前只封裝 `RESET_VIDEO` control message。
- [server/webrtc/streamer.go](../server/webrtc/streamer.go)：H264 Annex-B 解析、首 IDR / 首 keyframe 量測與 sample 寫入。

## Scrcpy Config 與資料儲存

- `server/data/scrcpy_config.json` 目前除了既有 `bitrate`、`max_size`、`max_fps`、`window_*` 等欄位外，另有 `video_codec_options`。
- `video_codec_options` 是 WebRTC live view 用於啟播診斷與 fallback 的額外編碼器選項，不影響既有外部 scrcpy 視窗啟動參數。
- 預設建議維持空字串；只有在特定設備首幀等待過久時，才暫時用較積極的 codec options 做排障。

## 重要資料儲存

- [server/data/devices.json](../server/data/devices.json)
- [server/data/rooms.json](../server/data/rooms.json)
- [server/data/actions.json](../server/data/actions.json)
- [server/data/activities.json](../server/data/activities.json)
- [server/data/scrcpy_config.json](../server/data/scrcpy_config.json)
- [server/data/preferences.json](../server/data/preferences.json)
- `server/data/lantern/<room_id>_<room_hash>.json`：deprecated lantern fallback，舊 room hash 流程的歷史資料
- `server/data/activities/<activity_id>/*.json`：活動級 artifact 資料，預留給 lantern / shot / qa 等詳細事件檔案

## Room Runtime

- Socket room 的執行時狀態由 [server/sockets/room.go](../server/sockets/room.go) 維護。
- Room runtime 是 device hub 的即時協調層，不再代表正式遊戲/session lifecycle。
- Activity 才是正式 session；Activity start 會產生或使用指定 seed，並透過玩家 socket 的 `config` event 發給加入中的玩家。
- lantern 事件會先暫存在記憶體，Activity 結束時寫入 activity `lantern` artifact。
- QA 作答會先暫存在 room memory 的 `Answers` map，由 update loop 做 dirty-check 後再廣播聚合結果；活動結束時會另外封存為 activity `qa` artifact。
- QA 聚合資料與 lantern runtime data 在封存後由 activity artifact 承接，Room 只負責清空暫存狀態。
- `QuestionLocked` 是 room 內部保護機制；若某題被標記 locked，後續玩家送來的答案會被忽略。
- 控制端應從 room update 取得 `current_activity_id`，再用 Activity results/artifacts 查詢該局 lantern 歷史資料。
- `MoveControl`、`SyncControl`、`PlayCommander` 是 room 內部協調 channel，分別對應章節移動、同步完成與播放狀態廣播。
- room update 目前輸出 `ready_to_move`，但不輸出 `wait_to_sync` 旗標；同步等待狀態仍由 player socket 與 `sync_command` event 協調。
- room 目前會記住玩家的 `play_status`，但這個狀態尚未被輸出到 room update payload。

## Activity Runtime

- Room runtime 目前會額外維護 `currentActivityID`、活動開始時間、活動事件統計與共享 `activity_context` cache。
- `activity_context` 代表整場活動共用、且可提供給參與設備讀取的共享上下文，不只是設定值。
- Activity runtime snapshot 保存 Activity seed，作為該場遊戲/session 的隨機性來源。
- 同一個 room 在同一時間只允許一個 running activity。
- 活動狀態與 `activity_seed` 會透過 [server/sockets/control.go](../server/sockets/control.go) 推送到控制端房間更新 payload。
- 第一版設備讀取 `activity_context` 以 REST API 為主；玩家 socket 的 `config` event 只提供 `activity_id` 與 `activity_context_path` 指標。若後續需要更即時同步，再擴充 WS 訊息型別。

## 已知限制

- `keep_awake` 尚未在後端實作
- Scrcpy 依賴作業系統已安裝並可從 PATH 呼叫
- WebRTC live view 目前僅傳視訊，不含音訊。
- WebRTC live view 的首畫面仍依賴來源 keyframe；目前已透過 control channel + `RESET_VIDEO` 優化啟播，但不同設備編碼器表現可能不同。
- live-stream popup 模式目前只支援單一 popup 視窗，不支援多 popup 管理。
- popup 與主頁之間的同步依賴瀏覽器 BroadcastChannel；若瀏覽器不支援，popup 只會保留骨架頁面與提示，不會收到即時串流資料。
