# VR Control

整合 Go 後端與 Vite + React 前端的 VR 控制系統，包含設備管理、房間管理、動作控制與監控機制。

目前螢幕觀看有兩種模式：
- 外部 scrcpy 監看視窗
- 頁內 WebRTC 即時畫面（live view）

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

本專案的 VR 裝置控制與螢幕鏡像功能需要在系統中安裝 **ADB** 與 **scrcpy**，並加入 `PATH`。

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

> WebRTC live view 同樣依賴 scrcpy 作為視訊來源，因此若 `scrcpy` 未安裝，頁內即時畫面也無法使用。

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

目前前端 API 與 WebSocket 都統一經由 `/api/*` 命名空間對接後端。

## 即時畫面（WebRTC Live View）

- 設備頁與房間控制頁目前都提供「即時畫面」入口。
- 頁內即時畫面使用 WebRTC 播放，舊的 scrcpy 監看按鈕仍保留作為並行方案與 fallback。
- 後端 signaling 端點為 `/api/ws/webrtc/:deviceId`。
- 若畫面啟播較慢，可在設定頁的 scrcpy config 中使用 `video_codec_options` 做診斷或 fallback；預設建議保持空值。

## Docker（選用）

```bash
docker compose up
```

若要使用 Docker 啟動前端，請確認已提供 `client/Dockerfile.dev`（目前專案未包含）。

## 重要文件

- AI Agent 指南：[AGENTS.md](AGENTS.md)
- 後端 API 詳情：[server/README.md](server/README.md)
- 動作參數規格：[docs/ACTION_PARAMETERS.md](docs/ACTION_PARAMETERS.md)
- API 總表：[docs/API.md](docs/API.md)
- 架構概覽：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 開發流程：[docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md)

## 資料儲存

系統資料以 JSON 儲存在 `server/data/` 目錄：

- `devices.json`
- `rooms.json`
- `actions.json`
- `scrcpy_config.json`
- `preferences.json`

## 技術棧

- **後端**: Go + Gin + WebSocket
- **前端**: React 19 + Vite + TypeScript + Tailwind CSS
