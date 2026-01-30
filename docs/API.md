# API 端點總表

## Base URL
- 本機開發：`http://localhost:8080`
- Quest API 前綴：`/api/quest`

## Quest API

### 裝置管理
- `GET /api/quest/devices`
- `GET /api/quest/devices/isolation`
- `GET /api/quest/devices/:id`
- `POST /api/quest/devices`
- `PUT /api/quest/devices/:id`
- `PATCH /api/quest/devices/:id`
- `DELETE /api/quest/devices/:id`
- `POST /api/quest/devices/:id/connect`
- `POST /api/quest/devices/:id/disconnect`
- `GET /api/quest/devices/:id/status`
- `POST /api/quest/devices/:id/ping`
- `POST /api/quest/devices/batch/connect`
- `POST /api/quest/devices/batch/ping`
- `POST /api/quest/devices/batch/status`
- `POST /api/quest/devices/batch/auto-reconnect`
- `POST /api/quest/devices/:id/auto-reconnect/reset`
- `POST /api/quest/devices/batch/auto-reconnect/reset`

### 房間管理
- `GET /api/quest/rooms`
- `GET /api/quest/rooms/:id`
- `POST /api/quest/rooms`
- `PUT /api/quest/rooms/:id`
- `PATCH /api/quest/rooms/:id`
- `DELETE /api/quest/rooms/:id`
- `POST /api/quest/rooms/:id/devices/:deviceId`
- `DELETE /api/quest/rooms/:id/devices/:deviceId`

### 動作管理
- `GET /api/quest/actions`
- `GET /api/quest/actions/:id`
- `POST /api/quest/actions`
- `PUT /api/quest/actions/:id`
- `PATCH /api/quest/actions/:id`
- `DELETE /api/quest/actions/:id`
- `POST /api/quest/actions/:id/execute`
- `POST /api/quest/actions/batch/execute`

### 監控服務
- `GET /api/quest/monitoring/status`
- `POST /api/quest/monitoring/start`
- `POST /api/quest/monitoring/stop`
- `POST /api/quest/monitoring/interval`
- `POST /api/quest/monitoring/run-once`

### Scrcpy 螢幕鏡像
- `GET /api/quest/scrcpy/system-info`
- `POST /api/quest/scrcpy/start/:id`
- `POST /api/quest/scrcpy/stop/:id`
- `POST /api/quest/scrcpy/batch/start`
- `GET /api/quest/scrcpy/sessions`
- `POST /api/quest/scrcpy/sessions/refresh`
- `GET /api/quest/scrcpy/config`
- `PUT /api/quest/scrcpy/config`

### 使用者偏好
- `GET /api/quest/preferences`
- `PUT /api/quest/preferences`

### Quest 內部控制（複製自舊控制路由）
- `POST /api/quest/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/quest/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/quest/control/roomlist`

### Quest 內部簡化控制
- `GET /api/quest/simple/assignseq/:roomId/:clientId/:seq`
- `GET /api/quest/simple/forcemove/:roomId/:clientId/:dest`
- `GET /api/quest/simple/forceallmove/:roomId/:dest`

### Quest 內部 WebSocket
- `GET /api/quest/ws/client/:clientId`
- `GET /api/quest/ws/control/:roomId`

## 全域 WebSocket（非 Quest 前綴）
- `GET /ws/client/:clientId`
- `GET /ws/control/:roomId`

## 舊控制路由（非 Quest 前綴）
- `POST /control/assignseq/:roomId/:clientId/:seq`
- `GET /control/assignseq/:roomId/:clientId/:seq`
- `POST /control/assignroomandseq/:clientId/:roomId/:seq`
- `GET /control/assignroomandseq/:clientId/:roomId/:seq`
- `POST /control/createroom/:roomId`
- `GET /control/createroom/:roomId`
- `GET /control/roomlist`
- `GET /control/playerlist`

## 簡化控制路由（非 Quest 前綴）
- `GET /simple/assignseq/:roomId/:clientId/:seq`
- `GET /simple/forcemove/:roomId/:clientId/:dest`
- `GET /simple/forceallmove/:roomId/:dest`

## 規格與參數
- 動作參數規格：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)
