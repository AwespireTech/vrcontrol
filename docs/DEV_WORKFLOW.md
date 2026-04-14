# 開發流程與擴充指引

## 新增動作類型

1. 後端動作常量：[server/model/action.go](../server/model/action.go)
2. 執行邏輯：`executeActionToDevice` in [server/service/action_service.go](../server/service/action_service.go)
3. 前端動作型別：[client/src/services/api-types.ts](../client/src/services/api-types.ts)
4. UI 顯示與對應字串：動作頁相關元件
5. 更新動作參數規格：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)

## 新增 API 端點

1. Service 層：server/service
2. Controller 層：server/controller
3. 路由註冊：[server/routes/api_routes.go](../server/routes/api_routes.go)
4. 前端呼叫封裝：[client/src/services/api.ts](../client/src/services/api.ts)
5. 更新 API 列表：[docs/API.md](API.md)

## 前端頁面與路由

- 路由定義：[client/src/App.tsx](../client/src/App.tsx)
- 頁面實作位置：client/src/app
- 管理介面目前直接掛在根路徑 `/`

## 常見注意事項

- `keep_awake` 目前尚未實作
- ADB 與 scrcpy 必須在 `PATH` 中
- JSON 數值在 Go 中會解析為 `float64`

## 文件同步要求（修改後務必更新）

> 任何功能或介面變更完成後，請同步更新以下文件，避免文件與實作落差。

- **新增/變更 API 端點**
	- 更新：[docs/API.md](API.md)
	- 如有新參數或格式調整，更新：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)
	- 若新增 WebSocket / WebRTC signaling 契約，也要補上 message 格式、錯誤碼與關閉流程

- **新增/變更動作類型或 params 結構**
	- 更新：[docs/ACTION_PARAMETERS.md](ACTION_PARAMETERS.md)
	- 影響前端顯示時，更新 UI 文字/對應檔案並補註於 [docs/DEV_WORKFLOW.md](DEV_WORKFLOW.md)

- **新增/變更資料儲存結構（JSON 欄位）**
	- 更新：[docs/ARCHITECTURE.md](ARCHITECTURE.md) 的資料儲存段落
	- 如影響 API 契約，更新：[docs/API.md](API.md)
	- 若欄位會同時影響 scrcpy 外部監看與 WebRTC live view，需明確寫出邊界；例如 `video_codec_options` 目前只影響 live view 的 standalone stream 路徑

- **新增/變更 WebRTC live view / 播放器行為**
	- 更新：[docs/API.md](API.md) 的 `/api/ws/webrtc/:deviceId` signaling 契約與錯誤碼
	- 更新：[docs/ARCHITECTURE.md](ARCHITECTURE.md) 的 live view 資料流與 scrcpy standalone/control channel 邊界
	- 若 UI 行為或入口改變，更新：[README.md](../README.md) 或 [server/README.md](../server/README.md) 的功能概覽與使用說明

- **新增/變更系統依賴（ADB/scrcpy 等）**
	- 更新：[README.md](../README.md) 與 [server/README.md](../server/README.md)

- **新增/變更啟動流程或入口**
	- 更新：[AGENTS.md](../AGENTS.md) 的 Entry Points
	- 更新：[README.md](../README.md)
