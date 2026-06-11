# VRControl Client

Vite + React 19 前端，負責顯示設備、房間與動作管理 UI。

## 開發啟動

```bash
npm install
npm run dev
```

預設開發位址：`http://localhost:5173`

## 主要指令

```bash
npm run dev     # 開發模式
npm run build   # 產出靜態檔案
npm run preview # 預覽 build 結果
npm run lint    # ESLint 檢查
npm run test    # Vitest 單元 / 頁面 smoke 測試
npm run test:e2e # Playwright 路由 smoke 測試
```

如要首次執行 Playwright，先安裝 Chromium：

```bash
npm run test:e2e:install
```

## API 連線

開發模式下，Vite 代理會將 `/api` 與 `/ws` 轉發到後端 `http://localhost:8080`。
若要從另一台裝置開啟 `http://<server-ip>:5173`，請在啟動前設定 `VITE_API_SERVER=http://<server-ip>:8080`，或讓前端使用目前 `window.location.hostname` 的 dev 目標 `:8080`。
如需自訂 API 位置，也可在啟動時設定 `VITE_API_SERVER`。

## 專案結構

```
src/
├── app/                 # 路由頁面
├── components/          # UI 元件
├── services/            # API 與型別
├── hooks/               # 前端自訂 hooks
└── test/                # Vitest 測試工具與 smoke tests

tests/
├── e2e/                 # Playwright smoke tests
└── fixtures/            # 共用 mock fixture
```

## 測試策略

- Vitest 負責快速驗證頁面與元件在 mock/stub 資料下的基本行為。
- Playwright 負責巡 Dashboard、Devices、Rooms、Actions 等關鍵路由，並產生當前畫面截圖工件。
- 第一階段刻意不依賴真實後端、ADB、scrcpy、WebRTC；這些整合驗證留到後續獨立 phase。

## Agent 可視化巡檢

目前已準備兩條路徑，讓 agent 在真正修改 UI 前先看到畫面：

1. 專案內 Playwright smoke test

```bash
npm run test:e2e
npm run test:e2e:headed
```

執行後會在 `test-results/` 產生每個路由的截圖工件，`playwright-report/` 會保存 HTML 報告。

2. Playwright skill

- 先啟動前端開發伺服器：`npm run dev`
- 讓 Playwright skill 自動偵測 localhost dev server
- 以可視瀏覽器巡 Dashboard、Devices、Rooms、Actions
- 先觀察現況畫面與互動，再決定後續 redesign 方向，避免憑空修改
