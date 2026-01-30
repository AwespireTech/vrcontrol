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
```

## API 連線

開發模式下，Vite 代理會將 `/api` 與 `/ws` 轉發到後端 `http://localhost:8080`。

如需自訂 API 位置，請調整 `src/environment.ts` 中的 `SERVER` 值。

## 專案結構

```
src/
├── app/                 # 路由頁面
├── components/          # UI 元件
├── services/            # API 與型別
└── hooks/               # 前端自訂 hooks
```
