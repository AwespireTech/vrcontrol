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

## 常用連線

- 玩家連線：`ws://localhost:8080/api/ws/client/<player_id>`
- 房間控制：`ws://localhost:8080/api/ws/control/<roomId>`

## API 概覽

Quest API 皆以 `/api` 為前綴（完整清單請見 [docs/API.md](../docs/API.md)）：

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

## Socket 協議

### 訊息格式
所有訊息為 JSON，以 `\n` 分隔。

**登入**（Client → Server）
```json
{
	"type": "login",
	"device_id": "device_001",
	"device_name": "Quest 1"
}
```

**Ping**（Client → Server）
```json
{ "type": "ping" }
```

**Pong**（Server → Client）
```json
{
	"type": "pong",
	"timestamp": "2026-01-06T10:30:00Z"
}
```

**Params Update**（Server → Client）
```json
{
	"type": "params_update",
	"data": {
		"from": "device_001",
		"data": {
			"key1": "value1",
			"key2": 123
		},
		"timestamp": 1704500000000
	}
}
```

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

Quest 模組資料存於 `data/`：

- `quest_devices.json`
- `quest_rooms.json`
- `quest_actions.json`

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
