# Quest 動作參數規格

本文件定義 Quest 動作（Action）在 `params` 欄位中使用的標準結構與必填欄位。

## 概述

每筆動作在資料中以 `params` 儲存 JSON 物件，執行時會被後端載入並傳遞給 ADB 管理器。

> 注意：JSON 數字在 Go 中會以 `float64` 讀取，建議仍以「整數」概念填寫。

## 參數格式

```json
{
  "action_type": "launch_app",
  "params": {
    "package": "com.example.app",
    "activity": ".MainActivity"
  }
}
```

## 動作類型與參數

### 1. 喚醒設備 (`wake_up`)

喚醒設備（按下電源鍵）。

**參數**：無（`{}`）

**範例**：
```json
{}
```

---

### 2. 休眠設備 (`sleep`)

讓設備進入睡眠。

**可選參數**：
- `force` (boolean)：強制睡眠
  - 預設：`false`

**範例**：
```json
{
  "force": false
}
```

---

### 3. 啟動應用 (`launch_app`)

啟動指定 App。

**必填參數**：
- `package` (string)：套件名稱

**可選參數**：
- `activity` (string)：指定 Activity
- `extras` (object)：Intent extras（僅支援 `string | boolean | number`）

**範例**：
```json
{
  "package": "com.AweSpire.ThreeTaoist",
  "activity": "com.unity3d.player.UnityPlayerGameActivity",
  "extras": {
    "debug": true,
    "user_id": "12345",
    "level": 3
  }
}
```

**最小範例**：
```json
{
  "package": "com.example.app"
}
```

---

### 4. 停止應用 (`stop_app`)

停止指定 App。

**必填參數**：
- `package` (string)：套件名稱

**可選參數**：
- `method` (string)：停止方式
  - 可選：`"force-stop"`（預設）、`"kill"`

**範例**：
```json
{
  "package": "com.example.app",
  "method": "force-stop"
}
```

---

### 5. 重啟應用 (`restart_app`)

停止後重新啟動指定 App。

**必填參數**：
- `package` (string)：套件名稱

**可選參數**：
- `activity` (string)：指定 Activity
- `delay` (integer)：停止後等待毫秒數（預設 `1000`）

**範例**：
```json
{
  "package": "com.example.app",
  "activity": ".MainActivity",
  "delay": 1500
}
```

---

### 6. 發送按鍵 (`send_key`)

模擬硬體按鍵事件。

**必填參數**：
- `keycode` (integer)：Android KeyCode

**可選參數**：
- `repeat` (integer)：重複次數（預設 `1`）

**範例**：
```json
{
  "keycode": 26,
  "repeat": 1
}
```

**常見 KeyCode**：
- `3`: KEYCODE_HOME
- `4`: KEYCODE_BACK
- `26`: KEYCODE_POWER
**其他常見 KeyCode**（參考用）：
- `24`: KEYCODE_VOLUME_UP
- `25`: KEYCODE_VOLUME_DOWN
- `82`: KEYCODE_MENU
- `187`: KEYCODE_APP_SWITCH

---

### 7. 安裝 APK (`install_apk`)

在設備上安裝 APK。

**必填參數**：
- `apk_path` (string)：伺服器可存取的檔案路徑

**可選參數**：
- `replace` (boolean)：覆蓋安裝（預設 `true`）
- `grant_permissions` (boolean)：安裝時授權（預設 `true`）

**範例**：
```json
{
  "apk_path": "/app/data/app-release.apk",
  "replace": true,
  "grant_permissions": true
}
```

---

### 8. 保持喚醒 (`keep_awake`)

**狀態**：目前後端尚未實作（`action_service.go` 未處理此類型）。

若需使用，請先在後端新增動作處理邏輯後再擴充參數定義。
