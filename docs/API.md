# API 端點總表

## Base URL
- 本機開發：`http://localhost:8080`
- API 前綴：`/api`

## API 路由

### 裝置管理
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

### 使用者偏好
- `GET /api/preferences`
- `PUT /api/preferences`

### 控制
- `POST /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/assignseq/:roomId/:clientId/:seq`
- `GET /api/control/roomlist`

### 簡化控制
- `GET /api/simple/forcemove/:roomId/:clientId/:dest`
- `GET /api/simple/forceallmove/:roomId/:dest`

### WebSocket
- `GET /api/ws/client/:clientId`
- `GET /api/ws/control/:roomId`

## 已移除舊端點
- 舊 `/control/*`、`/simple/*`、`/ws/*` 端點已下線，不保留相容 alias。
- 舊 `/control/playerlist`、`/control/createroom`、`/control/assignroomandseq` 也已移除。

## 規格與參數
- 動作參數規格：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)
