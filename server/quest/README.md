# Quest 設備管理模組

完整的 Meta Quest 設備管理解決方案，整合進 vrcontrol 系統。

## 功能特性

### 設備管理
- ✅ 設備 CRUD 操作
- ✅ ADB 連接/斷開
- ✅ 實時設備狀態監控
- ✅ 電量和溫度顯示
- ✅ Ping 延遲測試
- ✅ 批量操作支持

### 房間管理
- ✅ 房間創建和配置
- ✅ 設備分配到房間
- ✅ TCP Socket Server 管理
- ✅ 動態端口分配 (3000-3100)
- ✅ 參數同步廣播

### 動作管理
- ✅ 8 種動作類型支持：
  - wake_up: 喚醒設備
  - sleep: 休眠設備
  - launch_app: 啟動應用
  - stop_app: 停止應用
  - restart_app: 重啟應用
  - keep_awake: 保持喚醒
  - send_key: 發送按鍵
  - install_apk: 安裝 APK
- ✅ 批量執行動作
- ✅ 執行統計記錄

### 網絡監控
- ✅ 後台定時監控 (可配置間隔)
- ✅ 自動狀態更新
- ✅ 斷線自動重連
- ✅ 並發 Ping 檢測

## 技術架構

### 後端 (Go)

```
quest/
├── adb/                    # ADB 管理
│   ├── manager.go         # ADB 命令執行
│   └── ping.go            # 跨平台 Ping
├── questsocket/           # Socket Server
│   ├── server.go          # TCP Server 實現
│   ├── socket_manager.go  # 多實例管理
│   ├── port_manager.go    # 端口池管理
│   └── errors.go          # 錯誤定義
├── model/                 # 數據模型
│   ├── device.go          # 設備模型
│   ├── room.go            # 房間模型
│   └── action.go          # 動作模型
├── repository/            # 數據存儲
│   ├── json_repository.go # 通用 JSON 存儲
│   ├── device_repo.go     # 設備存儲
│   ├── room_repo.go       # 房間存儲
│   └── action_repo.go     # 動作存儲
├── service/               # 業務邏輯
│   ├── device_service.go  # 設備服務
│   ├── room_service.go    # 房間服務
│   ├── action_service.go  # 動作服務
│   └── monitoring_service.go # 監控服務
├── controller/            # API 控制器
│   ├── device_controller.go
│   ├── room_controller.go
│   ├── action_controller.go
│   └── monitoring_controller.go
└── routes/
    └── quest_routes.go    # 路由配置
```

### 前端 (React + TypeScript)

```
client/src/
├── services/              # API 服務層
│   ├── quest-types.ts     # TypeScript 類型定義
│   └── quest-api.ts       # API 封裝
├── components/quest/      # Quest 組件
│   ├── device-card.tsx    # 設備卡片
│   ├── device-form.tsx    # 設備表單
│   ├── room-card.tsx      # 房間卡片
│   └── action-card.tsx    # 動作卡片
└── app/quest/            # Quest 頁面
    ├── page.tsx           # 主頁面
    ├── devices/
    │   ├── page.tsx       # 設備列表
    │   └── new/page.tsx   # 新增設備
    ├── rooms/
    │   └── page.tsx       # 房間列表
    ├── actions/
    │   └── page.tsx       # 動作列表
    └── settings/
        └── page.tsx       # 系統設置
```

## API 端點

### 設備管理 API
- `GET /api/quest/devices` - 獲取所有設備
- `GET /api/quest/devices/:id` - 獲取單個設備
- `POST /api/quest/devices` - 創建設備
- `PUT /api/quest/devices/:id` - 更新設備
- `DELETE /api/quest/devices/:id` - 刪除設備
- `POST /api/quest/devices/:id/connect` - 連接設備
- `POST /api/quest/devices/:id/disconnect` - 斷開設備
- `GET /api/quest/devices/:id/status` - 獲取設備狀態
- `POST /api/quest/devices/:id/ping` - Ping 設備
- `POST /api/quest/devices/batch/connect` - 批量連接
- `POST /api/quest/devices/batch/ping` - 批量 Ping

### 房間管理 API
- `GET /api/quest/rooms` - 獲取所有房間
- `GET /api/quest/rooms/:id` - 獲取單個房間
- `POST /api/quest/rooms` - 創建房間
- `PUT /api/quest/rooms/:id` - 更新房間
- `DELETE /api/quest/rooms/:id` - 刪除房間
- `POST /api/quest/rooms/:id/devices/:deviceId` - 添加設備
- `DELETE /api/quest/rooms/:id/devices/:deviceId` - 移除設備
- `POST /api/quest/rooms/:id/socket/start` - 啟動 Socket Server
- `POST /api/quest/rooms/:id/socket/stop` - 停止 Socket Server
- `GET /api/quest/rooms/:id/socket/info` - 獲取 Socket 信息
- `POST /api/quest/rooms/:id/parameters/sync` - 同步參數

### 動作管理 API
- `GET /api/quest/actions` - 獲取所有動作
- `GET /api/quest/actions/:id` - 獲取單個動作
- `POST /api/quest/actions` - 創建動作
- `PUT /api/quest/actions/:id` - 更新動作
- `DELETE /api/quest/actions/:id` - 刪除動作
- `POST /api/quest/actions/:id/execute` - 執行動作
- `POST /api/quest/actions/batch/execute` - 批量執行

### 監控服務 API
- `GET /api/quest/monitoring/status` - 獲取監控狀態
- `POST /api/quest/monitoring/start` - 啟動監控
- `POST /api/quest/monitoring/stop` - 停止監控
- `POST /api/quest/monitoring/interval` - 設置監控間隔
- `POST /api/quest/monitoring/run-once` - 手動執行監控

## Socket 協議

### 消息格式
所有消息使用 JSON 格式，以 `\n` 作為分隔符。

### 消息類型

#### 1. Login (客戶端 → 服務器)
```json
{
  "type": "login",
  "device_id": "device_001",
  "device_name": "Quest 1"
}
```

#### 2. Ping (客戶端 → 服務器)
```json
{
  "type": "ping"
}
```

#### 3. Pong (服務器 → 客戶端)
```json
{
  "type": "pong",
  "timestamp": "2026-01-06T10:30:00Z"
}
```

#### 4. Params Update (服務器 → 所有客戶端)
```json
{
  "type": "params_update",
  "parameters": {
    "key1": "value1",
    "key2": 123
  }
}
```

## 數據存儲

所有數據使用 JSON 文件存儲在 `./data/` 目錄：
- `quest_devices.json` - 設備數據
- `quest_rooms.json` - 房間數據
- `quest_actions.json` - 動作數據

數據操作使用原子寫入，保證並發安全。

## 配置說明

### 監控服務
- **預設間隔**: 10 秒
- **Ping 超時**: 2 秒
- **自動重連**: 支持
- **並發限制**: 10 個並發 Ping

### Socket Server
- **端口範圍**: 3000-3100
- **協議**: TCP
- **格式**: JSON + `\n` 分隔符
- **動態分配**: 自動尋找可用端口

### 前端刷新
- **自動更新**: 5 秒間隔
- **狀態同步**: 實時顯示
- **倒計時顯示**: 友好的 UI 提示

## 使用流程

### 1. 添加設備
1. 進入「設備管理」頁面
2. 點擊「+ 添加設備」
3. 填寫設備名稱和 IP 地址
4. 點擊「創建」

### 2. 連接設備
1. 在設備卡片上點擊「連接」按鈕
2. 系統自動執行 ADB 連接
3. 連接成功後顯示設備信息（型號、電量、溫度等）

### 3. 創建房間
1. 進入「房間管理」頁面
2. 點擊「+ 創建房間」
3. 填寫房間信息
4. 添加設備到房間

### 4. 啟動 Socket Server
1. 在房間卡片上點擊「啟動 Socket」
2. 系統自動分配端口並啟動服務器
3. 客戶端可通過顯示的地址連接

### 5. 執行動作
1. 進入「動作管理」頁面
2. 點擊動作卡片的「執行」按鈕
3. 選擇要執行的設備
4. 確認執行

### 6. 啟用監控
1. 進入「系統設置」頁面
2. 點擊「啟動監控」
3. 配置監控間隔（可選）
4. 系統自動監控所有在線設備

## 開發指南

### 添加新的動作類型

1. 在 `quest/model/action.go` 添加動作常量
2. 在 `quest/service/action_service.go` 的 `executeActionToDevice` 方法中添加處理邏輯
3. 在前端 `quest-types.ts` 更新 `QUEST_ACTION_TYPES`
4. 在 `action-card.tsx` 更新圖標和文字映射

### 添加新的 API 端點

1. 在對應的 Service 中實現業務邏輯
2. 在對應的 Controller 中添加 API 端點
3. 在 `quest_routes.go` 註冊路由
4. 在前端 `quest-api.ts` 添加 API 調用方法

## 故障排除

### 設備無法連接
1. 確認設備已開啟 ADB 調試
2. 確認設備和服務器在同一網絡
3. 檢查防火牆設置
4. 嘗試手動執行 `adb connect <ip>:5555`

### Socket Server 無法啟動
1. 檢查端口範圍 3000-3100 是否被占用
2. 確認系統有足夠的權限
3. 查看服務器日誌

### 監控服務不工作
1. 檢查監控服務是否已啟動
2. 確認設備有有效的 IP 地址
3. 檢查網絡連接

## 版本信息

- **Go 版本**: 1.24.1
- **React 版本**: 19
- **Gin 版本**: Latest
- **完成日期**: 2026-01-06

## 授權

此模組是 vrcontrol 項目的一部分，遵循相同的授權條款。
