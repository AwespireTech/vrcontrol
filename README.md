# VR Control - Integrated Project

完整的VR控制系統，集成Go後端 + Vite + React前端。

## 關於本專案

本專案是基於以下開源項目修改而來：

- **[QQQuest](https://github.com/jinyaolin/QQQuest)** - 原始業務邏輯和架構
- **[vrcontrol-client](https://github.com/chenyunwen/vrcontrol-client)** - 前端 React 組件
- **[vrcontrol-server](https://github.com/timothychen1999/vrcontrol-server)** - 後端 Go 服務

感謝原始作者的開源貢獻！

## 專案結構

```
vrcontrol/
├── server/          # Go後端
│   ├── main.go
│   ├── go.mod
│   ├── routes/
│   ├── controller/
│   ├── model/
│   ├── sockets/
│   └── ...
└── client/          # Vite + React前端
    ├── src/
    ├── public/
    ├── vite.config.ts
    ├── package.json
    └── index.html
```

## 快速開始

### 後端啟動 (Go)

```bash
cd server
go run main.go
```

伺服器將在 `http://localhost:8080` 上運行

### 前端啟動 (React + Vite)

```bash
cd client
npm install
npm run dev
```

開發伺服器將在 `http://localhost:5173` 上運行

## 構建

### 後端

```bash
cd server
go build -o vrcontrol-server main.go
```

### 前端

```bash
cd client
npm run build
```

## API 代理

開發時，Vite會自動代理API請求：
- `/api/*` → `http://localhost:8080`
- `/ws` → `ws://localhost:8080`

確保後端伺服器正在運行以使用這些代理。

## 環境變數

### 伺服器

在 `server/.env` 中配置：
```
# 你的環境變數在這裡
```

## 技術棧

- **後端**: Go + Gin Framework + WebSocket
- **前端**: React 19 + Vite + TypeScript + Tailwind CSS
