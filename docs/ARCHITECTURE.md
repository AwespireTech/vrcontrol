# 專案架構概覽

## 系統總覽

- 後端：Go + Gin，負責設備/房間/動作/監控與 Socket 管理
- 前端：React + Vite，提供設備管理 UI
- 外部依賴：ADB（裝置控制）、scrcpy（螢幕鏡像）

## 模組分層

### 後端（API 模組）
- 路由註冊：[server/routes/api_routes.go](../server/routes/api_routes.go)
- 控制器：server/controller
- 服務層：server/service
- 資料存取：server/repository
- 資料模型：server/model
- ADB 管理：server/adb
- Scrcpy 管理：server/scrcpy

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
