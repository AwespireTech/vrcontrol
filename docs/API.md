# API 端點總表

## Base URL
- 本機開發：`http://localhost:8080`
- API 前綴：`/api`

## API 路由

### 裝置管理
- `GET /api/devices`
- `GET /api/devices/isolation`
- `GET /api/devices/usb`
- `GET /api/devices/:id`
- `POST /api/devices`
- `PUT /api/devices/:id`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`
- `POST /api/devices/usb/tcpip/enable`
- `POST /api/devices/:id/connect`
- `POST /api/devices/:id/disconnect`
- `GET /api/devices/:id/status`
- `POST /api/devices/:id/ping`
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
- `GET /api/actions/:id`
- `POST /api/actions`
- `PUT /api/actions/:id`
- `PATCH /api/actions/:id`
- `DELETE /api/actions/:id`
- `POST /api/actions/:id/execute`
- `POST /api/actions/batch/execute`

### 監控服務
- `GET /api/monitoring/status`
- `POST /api/monitoring/start`
- `POST /api/monitoring/stop`
- `POST /api/monitoring/interval`
- `POST /api/monitoring/run-once`

### Scrcpy 螢幕鏡像
- `GET /api/scrcpy/system-info`
- `POST /api/scrcpy/start/:id`
- `POST /api/scrcpy/stop/:id`
- `POST /api/scrcpy/batch/start`
- `GET /api/scrcpy/sessions`
- `POST /api/scrcpy/sessions/refresh`
- `GET /api/scrcpy/config`
- `PUT /api/scrcpy/config`
- `GET /api/scrcpy/stream/:id`

### 使用者偏好
- `GET /api/preferences`
- `PUT /api/preferences`

### 控制
- `POST /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/roomlist`
- `GET /api/control/lantern/:roomId/:roomHash`

### 簡化控制
- `GET /api/simple/forcemove/:roomId/:clientId/:dest`
- `GET /api/simple/forceallmove/:roomId/:dest`

### WebSocket
- `GET /api/ws/client/:clientId`
- `GET /api/ws/control/:roomId`
- `GET /api/ws/webrtc/:deviceId`

## WebRTC 即時畫面

### 目的與邊界
- `GET /api/ws/webrtc/:deviceId` 提供頁內即時畫面的 WebRTC signaling 通道。
- 這條路徑會啟動 scrcpy standalone server，並把 H264 視訊經由 WebRTC video track 送到瀏覽器。
- 既有 `POST /api/scrcpy/start/:id` 仍是外部 scrcpy 視窗監看用途，兩者並存，不互相取代。

### 連線方式
- 瀏覽器端應使用 WebSocket 連線至 `/api/ws/webrtc/:deviceId`。
- 前端實作會先送出 `offer`，後端回傳 `answer`，雙方再交換 `ice`。
- 結束時前端可送出 `close` 主動關閉 session。

### Signal Message 格式

#### Offer
```json
{
	"type": "offer",
	"sdp": "v=0\r\n..."
}
```

#### Answer
```json
{
	"type": "answer",
	"sdp": "v=0\r\n..."
}
```

#### ICE Candidate
```json
{
	"type": "ice",
	"candidate": {
		"candidate": "candidate:...",
		"sdpMid": "0",
		"sdpMLineIndex": 0
	}
}
```

#### End of Candidates
```json
{
	"type": "ice"
}
```

#### Close
```json
{
	"type": "close"
}
```

#### Error
```json
{
	"type": "error",
	"error": "source_probe_failed"
}
```

### WebRTC 錯誤碼
- `invalid_signal`: 收到無法解析或不合法的 signaling message。
- `source_server_exited_with_error`: scrcpy standalone server 異常退出。
- `source_server_exited`: scrcpy standalone server 已結束。
- `source_backend_not_ready`: 後端來源尚未完成啟播準備。
- `source_dummy_byte_error`: scrcpy 啟播初始化失敗。
- `source_probe_eof`: 視訊來源在 probe 階段提前結束。
- `source_probe_failed`: 無法探測到有效的 H264 畫面資料。
- `source_connected_but_no_data`: 已連上來源 socket，但未收到畫面 bytes。
- `invalid_h264_annexb_stream`: H264 Annex-B 格式不合法。
- `no_h264_packets`: 未產生可播放的 H264 畫面封包。

### Scrcpy Config 與 Live View 關聯
- `GET /api/scrcpy/config` / `PUT /api/scrcpy/config` 目前也會影響 WebRTC live view 的 standalone scrcpy 啟播參數。
- `video_codec_options` 只會套用到 live view 的 standalone server 路徑，不會改變既有外部 scrcpy 視窗參數。
- `video_codec_options` 可作為首幀等待過久時的 fallback/診斷手段，例如 `i-frame-interval:int=1`；預設建議維持空字串，優先依賴 control channel 與 RESET_VIDEO 啟播優化。

#### 房間控制更新格式
- `GET /api/ws/control/:roomId` 會持續推送房間狀態 JSON。
- 回傳內容包含 `room_id`、`room_hash`、`player_count`、`players`。
- `room_hash` 會在房間從 0 位玩家進入到有玩家的那一刻產生；當房間再次清空後，下次新局會更新成新的 hash。
- `GET /api/control/lantern/:roomId/:roomHash` 可讀取該局累積的 lantern 事件資料。

## 已移除舊端點
- 舊 `/control/*`、`/simple/*`、`/ws/*` 端點已下線，不保留相容 alias。
- 舊 `/control/playerlist`、`/control/createroom`、`/control/assignroomandseq` 也已移除。

## 規格與參數
- 動作參數規格：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)
