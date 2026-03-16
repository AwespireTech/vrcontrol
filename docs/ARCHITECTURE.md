# 專案架構概覽

## 系統總覽

- 後端：Go + Gin，負責設備/房間/動作/監控與 Socket 管理
- 前端：React + Vite，提供 Quest 管理 UI
- 外部依賴：ADB（裝置控制）、scrcpy（螢幕鏡像）

## 模組分層

### 後端（Quest 模組）
- 路由註冊：[server/quest/routes/quest_routes.go](../server/quest/routes/quest_routes.go)
- 控制器：server/quest/controller
- 服務層：server/quest/service
- 資料存取：server/quest/repository
- 資料模型：server/quest/model
- ADB 管理：server/quest/adb
- Scrcpy 管理：server/quest/scrcpy

### 前端
- App 入口：[client/src/App.tsx](../client/src/App.tsx)
- Quest 頁面實作：client/src/app
- 主要前端入口 URL：`/`（Quest 管理介面）
- API 封裝：client/src/services/quest-api.ts
- 型別定義：client/src/services/quest-types.ts

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
1. 前端呼叫 `/api/quest/scrcpy/*`
2. 後端檢查 scrcpy 是否安裝
3. 啟動 scrcpy 子行程並維護 session 狀態

## 重要資料儲存

- [server/data/quest_devices.json](../server/data/quest_devices.json)
- [server/data/quest_rooms.json](../server/data/quest_rooms.json)
- [server/data/quest_actions.json](../server/data/quest_actions.json)
- [server/data/quest_scrcpy_config.json](../server/data/quest_scrcpy_config.json)
- [server/data/quest_preferences.json](../server/data/quest_preferences.json)

## 已知限制

- `keep_awake` 尚未在後端實作
- Scrcpy 依賴作業系統已安裝並可從 PATH 呼叫
