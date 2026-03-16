# AI Agent Guide

## TL;DR
- VR 裝置控制系統：Go 後端 + React 前端，核心功能是 Quest 設備、房間、動作管理與監控
- 後端入口：[server/main.go](server/main.go)
- 前端入口：[client/src/main.tsx](client/src/main.tsx) → [client/src/App.tsx](client/src/App.tsx)
- Quest API 基底路徑：`/api/quest`

## Repo Map
- 後端服務與 Quest 模組：[server](server)
- 前端 UI 與頁面：[client](client)
- 重要規格與說明文件：[docs](docs)

## Entry Points
- 伺服器啟動：`go run main.go`
- 前端啟動：`npm run dev`
- Quest 路由註冊：[server/quest/routes/quest_routes.go](server/quest/routes/quest_routes.go)

## Frontend Routes
- Quest 首頁頁面：[client/src/app/page.tsx](client/src/app/page.tsx)
- Quest 子頁面：`client/src/app/{devices,rooms,actions,monitoring,settings}`

## Key Data Stores
- Quest 資料儲存目錄：[server/data](server/data)
  - 裝置：[server/data/quest_devices.json](server/data/quest_devices.json)
  - 房間：[server/data/quest_rooms.json](server/data/quest_rooms.json)
  - 動作：[server/data/quest_actions.json](server/data/quest_actions.json)
  - Scrcpy 設定：[server/data/quest_scrcpy_config.json](server/data/quest_scrcpy_config.json)
  - 使用者偏好：[server/data/quest_preferences.json](server/data/quest_preferences.json)

## Dependencies
- 必要工具：ADB、scrcpy（需在 PATH）
- 詳細安裝與平台說明：
  - [README.md](README.md)
  - [server/README.md](server/README.md)

## When to Read Which Doc
- 動作參數格式與必填欄位：[docs/ACTION_PARAMETERS.md](docs/ACTION_PARAMETERS.md)
- API 端點與路由總表：[docs/API.md](docs/API.md)
- 架構與資料流：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 後端快速開始與操作流程：[server/README.md](server/README.md)
- 前端開發方式：[client/README.md](client/README.md)
- 變更流程與文件同步要求：[docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md)

## Common Pitfalls
- `keep_awake` 尚未在後端實作（動作會失敗）
- `scrcpy` 未安裝會導致 `/api/quest/scrcpy/*` 相關 API 失敗
- JSON 數值在 Go 會解析為 `float64`（動作參數需注意）
- 裝置必須為在線狀態才能啟動 scrcpy

## Coding Conventions
- 優先維持既有命名與結構（避免引入新的命名風格）
- 與現有模組一致的命名：後端使用 `snake_case` JSON 欄位、前端使用既有 TypeScript/React 慣例
- 改動後需使用 formatter（前端請使用專案既有 Prettier 設定；後端請維持 Go fmt 風格）

## Quick Commands
```bash
# 後端
cd server
go run main.go

# 前端
cd client
npm install
npm run dev
```
