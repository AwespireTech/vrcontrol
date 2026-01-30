# VR Control

整合 Go 後端與 Vite + React 前端的 VR 控制系統，包含 Quest 設備管理、房間管理、動作控制與監控機制。

## 來源與致謝

本專案基於以下開源項目整合與調整：

- **[QQQuest](https://github.com/jinyaolin/QQQuest)** - 原始業務邏輯與架構
- **[vrcontrol-client](https://github.com/chenyunwen/vrcontrol-client)** - 前端組件與 UI 參考
- **[vrcontrol-server](https://github.com/timothychen1999/vrcontrol-server)** - 後端服務參考

## 專案結構

```
vrcontrol/
├── server/          # Go 後端
│   ├── main.go
│   ├── quest/        # Quest 模組
│   ├── routes/
│   ├── controller/
│   └── data/
└── client/          # Vite + React 前端
    ├── src/
    ├── public/
    ├── vite.config.ts
    └── package.json
```

## 快速開始（本機開發）

### 先決條件：ADB 與 Scrcpy

本專案的 Quest 裝置控制與螢幕鏡像功能需要在系統中安裝 **ADB** 與 **scrcpy**，並加入 `PATH`。

**官方下載**
- Android Platform Tools (ADB)：https://developer.android.com/tools/releases/platform-tools
- scrcpy：https://github.com/Genymobile/scrcpy/releases

**Windows**
- ADB：下載 Platform Tools → 解壓縮 → 將 `platform-tools` 目錄加入系統 `PATH`
- scrcpy：下載 Windows release → 解壓縮 → 將 `scrcpy` 所在目錄加入 `PATH`

**macOS**
- ADB：`brew install android-platform-tools`
- scrcpy：`brew install scrcpy`

**Linux (Debian/Ubuntu)**
- ADB：`sudo apt-get install android-tools-adb`
- scrcpy：`sudo apt-get install scrcpy`

> 若 `scrcpy` 未安裝，僅會影響螢幕鏡像相關功能，其餘 API 仍可運作。

### 後端啟動 (Go)

```bash
cd server
go run main.go
```

後端預設運行於 `http://localhost:8080`。

### 前端啟動 (Vite + React)

```bash
cd client
npm install
npm run dev
```

前端開發伺服器預設運行於 `http://localhost:5173`。

### API / WS 代理

Vite 會將以下路徑代理到後端：

- `/api/*` → `http://localhost:8080`
- `/ws/*` → `ws://localhost:8080`

## Docker（選用）

```bash
docker compose up
```

若要使用 Docker 啟動前端，請確認已提供 `client/Dockerfile.dev`（目前專案未包含）。

## 重要文件

- AI Agent 指南：[AGENTS.md](AGENTS.md)
- Quest 模組詳情：[server/readme.md](server/readme.md)
- 動作參數規格：[docs/ACTION_PARAMETERS.md](docs/ACTION_PARAMETERS.md)
- API 總表：[docs/API.md](docs/API.md)
- 架構概覽：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 開發流程：[docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md)

## 資料儲存

Quest 模組資料以 JSON 儲存在 `server/data/` 目錄：

- `quest_devices.json`
- `quest_rooms.json`
- `quest_actions.json`

## 技術棧

- **後端**: Go + Gin + WebSocket
- **前端**: React 19 + Vite + TypeScript + Tailwind CSS
