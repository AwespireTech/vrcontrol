# Quest 設備管理模組 - 快速入門

## 快速開始

### 1. 啟動後端服務

```bash
cd vrcontrol/server
go run main.go
```

後端將在預設端口啟動，Quest API 端點: `http://localhost:8080/api/quest`

### 2. 啟動前端服務

```bash
cd vrcontrol/client
npm install  # 首次運行
npm run dev
```

前端將在 `http://localhost:5173` 啟動

### 3. 訪問 Quest 管理界面

在瀏覽器打開: `http://localhost:5173/quest`

## 基礎使用流程

### 添加第一個設備

1. 點擊「設備管理」進入設備列表
2. 點擊「+ 添加設備」
3. 填寫設備信息：
   - 設備名稱：例如 "Quest 2 #1"
   - IP 地址：例如 "192.168.1.100"
   - ADB 端口：預設 5555
4. 點擊「創建」

### 連接設備

**前提條件：**
- Quest 設備已開啟開發者模式
- Quest 設備已啟用 ADB over WiFi
- 設備和服務器在同一網絡

**步驟：**
1. 在設備卡片上點擊「連接」
2. 等待連接完成（狀態變為「在線」）
3. 連接成功後會顯示設備詳細信息

### 創建房間

1. 點擊「房間管理」進入房間列表
2. 點擊「+ 創建房間」
3. 填寫房間信息
4. 點擊「管理設備」添加設備到房間
5. 點擊「啟動 Socket」開啟 Socket Server

### 執行動作

1. 點擊「動作管理」進入動作列表
2. 點擊「+ 創建動作」
3. 選擇動作類型並設置參數
4. 點擊動作卡片的「執行」
5. 選擇要執行的設備
6. 確認執行

## 常見動作示例

### 喚醒設備
```json
{
  "name": "喚醒所有設備",
  "action_type": "wake_up",
  "parameters": {}
}
```

### 啟動應用
```json
{
  "name": "啟動 Beat Saber",
  "action_type": "launch_app",
  "parameters": {
    "package_name": "com.beatgames.beatsaber",
    "activity": ".MainActivity"
  }
}
```

### 安裝 APK
```json
{
  "name": "安裝應用",
  "action_type": "install_apk",
  "parameters": {
    "apk_path": "/path/to/app.apk"
  }
}
```

## 啟用網絡監控

1. 進入「系統設置」頁面
2. 點擊「啟動監控」
3. 設置監控間隔（建議 10-30 秒）
4. 監控服務將自動：
   - 每隔設定的時間 ping 所有設備
   - 更新設備狀態（在線/離線）
   - 自動重連斷線的設備

## Socket Server 使用

### 啟動 Socket Server

1. 創建房間並添加設備
2. 點擊「啟動 Socket」
3. 記錄顯示的端口號（例如 3001）

### 客戶端連接示例 (Node.js)

```javascript
const net = require('net');

const client = net.createConnection({ 
  port: 3001, 
  host: 'localhost' 
});

// 連接成功後登入
client.on('connect', () => {
  const loginMsg = JSON.stringify({
    type: 'login',
    device_id: 'device_001',
    device_name: 'Quest 2 #1'
  }) + '\n';
  
  client.write(loginMsg);
});

// 接收消息
client.on('data', (data) => {
  const messages = data.toString().split('\n').filter(m => m);
  messages.forEach(msg => {
    const message = JSON.parse(msg);
    console.log('Received:', message);
    
    // 處理參數更新
    if (message.type === 'params_update') {
      console.log('Parameters:', message.parameters);
    }
  });
});

// 發送 Ping
setInterval(() => {
  const pingMsg = JSON.stringify({ type: 'ping' }) + '\n';
  client.write(pingMsg);
}, 30000);
```

### 客戶端連接示例 (Python)

```python
import socket
import json
import time

def connect_to_room(host='localhost', port=3001):
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect((host, port))
    
    # 登入
    login_msg = json.dumps({
        'type': 'login',
        'device_id': 'device_001',
        'device_name': 'Quest 2 #1'
    }) + '\n'
    client.send(login_msg.encode())
    
    return client

def receive_messages(client):
    buffer = ''
    while True:
        data = client.recv(1024).decode()
        buffer += data
        
        while '\n' in buffer:
            line, buffer = buffer.split('\n', 1)
            if line:
                message = json.loads(line)
                print('Received:', message)
                
                if message['type'] == 'params_update':
                    print('Parameters:', message['parameters'])

# 使用
client = connect_to_room()
receive_messages(client)
```

## API 測試示例

### 使用 curl 測試

```bash
# 獲取所有設備
curl http://localhost:8080/api/quest/devices

# 創建設備
curl -X POST http://localhost:8080/api/quest/devices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quest 2",
    "ip": "192.168.1.100",
    "port": 5555
  }'

# 連接設備
curl -X POST http://localhost:8080/api/quest/devices/device_001/connect

# 批量 Ping
curl -X POST http://localhost:8080/api/quest/devices/batch/ping \
  -H "Content-Type: application/json" \
  -d '{
    "device_ids": ["device_001", "device_002"],
    "max_workers": 5
  }'
```

## 故障排除

### 設備無法連接

**檢查項目：**
1. Quest 設備是否在同一網絡
2. ADB over WiFi 是否已啟用
3. IP 地址是否正確
4. 防火牆是否阻擋 5555 端口

**手動測試 ADB 連接：**
```bash
adb connect 192.168.1.100:5555
adb devices
```

### Socket Server 無法啟動

**可能原因：**
1. 端口 3000-3100 被占用
2. 權限不足

**檢查端口：**
```bash
# Windows
netstat -ano | findstr "3000"

# Linux/Mac
lsof -i :3000
```

### 監控服務不更新狀態

**檢查項目：**
1. 監控服務是否已啟動（查看設置頁面）
2. 設備是否有有效的 IP 地址
3. 網絡連接是否正常

**手動測試 Ping：**
```bash
ping 192.168.1.100
```

## 進階配置

### 修改監控間隔

在「系統設置」頁面可以動態調整監控間隔（1-300 秒）

### 調整併發數量

批量操作時可以指定 `max_workers` 參數：
```javascript
await deviceApi.connectBatch(['device_001', 'device_002'], 10);
```

### 自定義 ADB 路徑

修改 `quest_routes.go` 中的 ADB Manager 初始化：
```go
adbManager := adb.NewADBManager("/custom/path/to/adb", 30*time.Second)
```

## 數據備份

所有數據存儲在 `./data/` 目錄的 JSON 文件中：
```
data/
├── quest_devices.json
├── quest_rooms.json
└── quest_actions.json
```

定期備份這些文件即可保存所有配置。

## 下一步

- 查看完整的 API 文檔: [README.md](README.md)
- 了解 Socket 協議詳情
- 自定義動作類型
- 集成到現有系統

## 支援

遇到問題請查看：
1. 服務器日誌
2. 瀏覽器控制台
3. ADB 連接狀態
4. 網絡配置
