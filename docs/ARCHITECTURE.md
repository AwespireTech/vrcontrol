# 專案架構概覽

## 系統總覽

- 後端：Go + Gin，負責設備/房間/動作/監控與 Socket 管理
- 前端：React + Vite，提供設備管理 UI
- 外部依賴：ADB（裝置控制與 WebRTC live view 啟播）

## 目前監看模式

- 頁內即時畫面：使用 WebRTC live view，由 `/api/ws/webrtc/:deviceId` 建立 signaling，後端以 scrcpy standalone server 提供 H264 來源。
- 外部 scrcpy CLI 視窗與 legacy raw H264 WebSocket 已移除。

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
3. 後端將 draft 保存到極簡 `server/data/activities.json`，只保留 activity 列舉、排序與篩選需要的 index 欄位。
4. 每個 activity 另外保存到 `server/data/activities/<activity_id>/detail.json`，其中會重複包含 index 欄位，並補上 `activity_context`、`runtime_snapshot`、`result_summary` 與 `artifact_manifest`，方便單筆直接檢視。
5. 啟動活動時，後端會將 draft 轉成 running activity，並把 `activity_context` 當作 immutable snapshot 保存到 detail。
6. room runtime 會保存目前活動狀態，並在收到 lantern、shot、qa、resume_qa 等事件時，把事件統計歸屬到當前 `activity_id`。
7. 活動結束時，後端會把 QA 與 lantern 詳細結果分別寫入 `qa.json`、`lantern.json`，再同步更新 detail 中的摘要與 artifact manifest。

### 裝置監控

1. 監控服務定期 Ping 裝置 IP
2. 狀態更新回寫至資料庫
3. 前端定期拉取狀態並更新 UI

### Room 播放狀態與 Snapshot

1. 玩家透過 `/api/ws/client/:clientId` 傳送 `play_status` 訊息到 room runtime。
2. 當 `status` 為 `idle/playing/pause/stop` 時，後端只更新該玩家在記憶體中的播放狀態。
3. 當 `status` 為 `snapshot` 時，後端將該玩家標記為已就緒 snapshot，並用 `CheckSnapShot` 檢查當前 room 內所有玩家是否都已送出 snapshot。
4. 當所有玩家都已就緒後，room 會透過 `SnapShotControl` acknowledgement 完成這次協調；running Activity 的 QA / lantern runtime data 會保留到 Activity end 時封存為 artifact。
5. 若沒有 running Activity，snapshot 只會清空無歸屬的暫存資料，不會寫入 legacy room-hash storage。

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
4. room runtime 也會在 Activity lifecycle 邊界對全房廣播 `play_command`，攜帶目前玩家數與 `isstart` 播放狀態。
5. 控制端透過 `/api/ws/control/:roomId` 只讀取 room update，不直接經由這條 socket 下 room command。

### Room Hub、Activity Session 與 QA 聚合

1. 玩家加入 room 後，後端會先送 `assign_sequence`，再送 `config` event，讓該玩家取得目前 hub 狀態；若 room 已有 running Activity，會再補送一次 `play_command(true)` 讓 late join player 對齊播放狀態。
2. 只有 Activity lifecycle 代表正式 app session / 一局遊戲；玩家進出 room 不再自動建立正式 session。
3. Activity start 時會產生或使用指定 seed，並先重新廣播 `config` event，內容包含 `activity_id`、`activity_context_path` 與 Activity seed，接著再廣播 `play_command(true)`。
4. Room 可在 `operation_profile` 內保存固定 activity defaults 與固定批次動作，但正式 session 資料仍屬於 Activity。
5. QA 題目、題序、計分、倒數與顯示規則屬於單場活動，放在 `activity_context.qa`；Room 只保留物理房間、設備分組、固定操作設定與 runtime 同步狀態。
6. 玩家作答時，透過 `/api/ws/client/:clientId` 送出 `qa` 訊息，payload 只包含 `qid` 與 `aid`。
7. room runtime 會把答案寫入 `Answers[qid][device_id]`，同一玩家對同一題重送時會直接覆蓋舊答案。
8. update loop 僅在 QA 狀態變更時廣播一次聚合後的 `qa` event，內容是該題目前所有玩家答案的完整 map。
9. 活動結束時，room runtime 會先廣播 `play_command(false)`，再把 QA answers、locked questions、lantern events 與當場 context 封存成 activity artifacts，最後送出不帶 `activity_id` 的新 config；當房間玩家數回到 0 時，不代表 Activity 結束。

### Independent Room Monitoring

1. 使用者可從左側 Monitor 房間子項、房間控制頁 live-stream section，或直接輸入 URL 開啟 `/monitoring/rooms/:roomId`。
2. 監控頁自行讀取 room/device metadata，並透過 `/api/ws/control/:roomId` 取得 room runtime 更新。
3. 監控頁使用 `LiveStreamStage` 與 `LiveStreamPlayer` 為房內裝置建立 WebRTC viewer；控制頁 inline live view 也使用同一組共用元件。
4. 控制頁的「在新視窗開啟」只負責 `window.open` 到 `/monitoring/rooms/:roomId?display=wall`，不再與外部視窗交換 UI 狀態或接管播放器。
5. 控制頁、監控頁與其他裝置上的監控頁都是獨立 viewer。任一頁面關閉都不會改變其他頁面的 UI 生命週期。
6. 同一 device 的多個 viewer 會在後端共享同一個 scrcpy source，但各自擁有 signaling WebSocket、PeerConnection 與 RTP track。

## Live View 主要模組

### 前端

- [client/src/app/devices/page.tsx](../client/src/app/devices/page.tsx)：設備頁的 live-stream section 與單台開啟入口。
- [client/src/app/rooms/[id]/control/page.tsx](../client/src/app/rooms/%5Bid%5D/control/page.tsx)：房間控制頁的 live-stream section、批次開啟入口與開啟獨立監控視窗的入口。
- [client/src/app/monitoring/rooms/[id]/page.tsx](../client/src/app/monitoring/rooms/%5Bid%5D/page.tsx)：獨立房間監控頁，承載房間狀態、平面圖與即時串流 grid/wall 模式。
- [client/src/components/console/live-stream-player.tsx](../client/src/components/console/live-stream-player.tsx)：共用播放器，負責 signaling、peer lifecycle、首幀等待提示與診斷面板。
- [client/src/components/console/live-stream-stage.tsx](../client/src/components/console/live-stream-stage.tsx)：共用 inline stack / grid 排版容器，供控制頁與監控頁共用。
- [client/src/lib/utils/monitoring-window.ts](../client/src/lib/utils/monitoring-window.ts)：房間監控 URL 與 `window.open` helper。
- [client/src/services/api.ts](../client/src/services/api.ts)：`webrtcApi.getSignalUrl()` 與錯誤碼對應。

### 後端

- [server/controller/webrtc_stream_controller.go](../server/controller/webrtc_stream_controller.go)：WebRTC signaling 入口、錯誤分類與 session lifecycle。
- [server/service/scrcpy_stream_service.go](../server/service/scrcpy_stream_service.go)：將 device/config 轉成 shared live view source，並管理同 device 多 viewer fan-out。
- [server/scrcpy/stream_manager.go](../server/scrcpy/stream_manager.go)：scrcpy standalone 啟播、source probe、control socket、RESET_VIDEO 與 fallback。
- [server/scrcpy/protocol.go](../server/scrcpy/protocol.go)：目前只封裝 `RESET_VIDEO` control message。
- [server/h264stream/parser.go](../server/h264stream/parser.go)：H264 Annex-B 解析、首 IDR / 首 keyframe 量測、SPS/PPS 注入與 access unit 產生。
- [server/webrtc/streamer.go](../server/webrtc/streamer.go)：將 H264 access units 寫入 Pion WebRTC track 的 adapter。

## Live View Shared Source

- 同一台 device 只會啟動一個 scrcpy standalone source；多個 WebRTC viewer 都透過 [server/service/scrcpy_stream_service.go](../server/service/scrcpy_stream_service.go) 訂閱同一個 source。
- 每個 WebRTC viewer 仍有自己的 signaling WebSocket、PeerConnection 與 Pion track；共享範圍只到後端 device H264 source，不共享瀏覽器端連線。
- 每個 subscriber 使用 bounded queue 接收 H264 access units。慢 viewer 不會阻塞 source；keyframe 會優先清掉該 viewer 的舊 queue，讓新 GOP 能盡快送達。
- 新 subscriber 會先等待 IDR。等待期間，後端會丟棄該 subscriber 的 non-keyframe access units，避免瀏覽器從 P/B frame 開始解碼。
- 新 subscriber 加入時會呼叫 scrcpy control socket 的 `RESET_VIDEO` 請求 keyframe，並以短時間 rate limit 合併密集加入事件。若 control socket 不可用，subscriber 仍會等待下一個自然 keyframe。
- 最後一個 subscriber 離開後，source 會保留短暫 grace period，避免前端重試或頁面切換造成 scrcpy 反覆啟停。

## Scrcpy Config 與資料儲存

- `server/data/scrcpy_config.json` 目前包含 `bitrate`、`max_size`、`max_fps`、`video_codec_options`。
- `video_codec_options` 是 WebRTC live view 用於啟播診斷與 fallback 的額外編碼器選項。
- 預設建議維持空字串；只有在特定設備首幀等待過久時，才暫時用較積極的 codec options 做排障。

## 重要資料儲存

- [server/data/devices.json](../server/data/devices.json)
- [server/data/rooms.json](../server/data/rooms.json)
- [server/data/actions.json](../server/data/actions.json)
- [server/data/activities.json](../server/data/activities.json)
- [server/data/scrcpy_config.json](../server/data/scrcpy_config.json)
- [server/data/preferences.json](../server/data/preferences.json)
- `server/data/activities/<activity_id>/detail.json`：單筆 activity 的完整 metadata，包含 index 欄位副本
- `server/data/activities/<activity_id>/qa.json`：活動結束時封存的 QA 詳細結果
- `server/data/activities/<activity_id>/lantern.json`：活動結束時封存的 lantern 詳細結果

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
- WebRTC live view 依賴 ADB 與 `vendor/scrcpy/scrcpy-server-v*` artifact
- WebRTC live view 目前僅傳視訊，不含音訊。
- WebRTC live view 的首畫面仍依賴來源 keyframe；新 viewer 加入時會透過 control channel + `RESET_VIDEO` 請求 keyframe，但不同設備編碼器表現可能不同。
- 監控頁初版會尊重前端 `LIVE_VIEW_MAX_STREAMS` 限制；房間裝置超過上限時，未顯示的裝置需後續以分頁、排序或焦點模式處理。
