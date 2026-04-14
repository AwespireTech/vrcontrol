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

### 裝置監控
1. 監控服務定期 Ping 裝置 IP
2. 狀態更新回寫至資料庫
3. 前端定期拉取狀態並更新 UI

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

## Live View 主要模組

### 前端
- [client/src/app/devices/page.tsx](../client/src/app/devices/page.tsx)：設備頁的 live wall 與單台開啟入口。
- [client/src/app/rooms/[id]/control/page.tsx](../client/src/app/rooms/[id]/control/page.tsx)：房間控制頁的 live wall 與批次開啟入口。
- [client/src/components/console/live-stream-player.tsx](../client/src/components/console/live-stream-player.tsx)：共用播放器，負責 signaling、peer lifecycle、首幀等待提示與診斷面板。
- [client/src/services/api.ts](../client/src/services/api.ts)：`webrtcApi.getSignalUrl()` 與錯誤碼對應。

### 後端
- [server/controller/webrtc_stream_controller.go](../server/controller/webrtc_stream_controller.go)：WebRTC signaling 入口、錯誤分類與 session lifecycle。
- [server/service/scrcpy_stream_service.go](../server/service/scrcpy_stream_service.go)：將 device/config 轉成 live view stream session。
- [server/scrcpy/stream_manager.go](../server/scrcpy/stream_manager.go)：scrcpy standalone 啟播、source probe、control socket、RESET_VIDEO 與 fallback。
- [server/scrcpy/protocol.go](../server/scrcpy/protocol.go)：目前只封裝 `RESET_VIDEO` control message。
- [server/webrtc/streamer.go](../server/webrtc/streamer.go)：H264 Annex-B 解析、首 IDR / 首 keyframe 量測與 sample 寫入。

## Scrcpy Config 與資料儲存

- `server/data/scrcpy_config.json` 目前除了既有 bitrate / max_size / max_fps / window_* 等欄位外，另有 `video_codec_options`。
- `video_codec_options` 是 WebRTC live view 用於啟播診斷與 fallback 的額外編碼器選項，不影響既有外部 scrcpy 視窗啟動參數。
- 預設建議維持空字串；只有在特定設備首幀等待過久時，才暫時用較積極的 codec options 做排障。

## 重要資料儲存

- [server/data/devices.json](../server/data/devices.json)
- [server/data/rooms.json](../server/data/rooms.json)
- [server/data/actions.json](../server/data/actions.json)
- [server/data/scrcpy_config.json](../server/data/scrcpy_config.json)
- [server/data/preferences.json](../server/data/preferences.json)
- `server/data/lantern/<room_id>_<room_hash>.json`：房間單局的 lantern 事件歷史資料

## Room Runtime

- Socket room 的執行時狀態由 [server/sockets/room.go](../server/sockets/room.go) 維護。
- 當房間從無玩家進入到有玩家時，會產生新的 `room_hash`，代表一局新的房間 session。
- lantern 事件會先暫存在記憶體，等房間玩家數回到 0 時寫入 `server/data/lantern`。
- 控制端可先從 room update 取得 `room_hash`，再用 control API 查詢該局 lantern 歷史資料。

## 已知限制

- `keep_awake` 尚未在後端實作
- Scrcpy 依賴作業系統已安裝並可從 PATH 呼叫
- WebRTC live view 目前僅傳視訊，不含音訊。
- WebRTC live view 的首畫面仍依賴來源 keyframe；目前已透過 control channel + `RESET_VIDEO` 優化啟播，但不同設備編碼器表現可能不同。
