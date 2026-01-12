import { SERVER } from "@/environment"

// Quest API 基礎配置
export const QUEST_API_BASE = `${SERVER}/api/quest`

// Quest 設備狀態
export const QUEST_DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  CONNECTING: 'connecting',
  ERROR: 'error',
  DISCONNECTED: 'disconnected'
} as const

// Quest 動作類型
export const QUEST_ACTION_TYPES = {
  WAKE_UP: 'wake_up',
  SLEEP: 'sleep',
  LAUNCH_APP: 'launch_app',
  STOP_APP: 'stop_app',
  RESTART_APP: 'restart_app',
  KEEP_AWAKE: 'keep_awake',
  SEND_KEY: 'send_key',
  INSTALL_APK: 'install_apk'
} as const

// API 響應類型
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 設備類型
export interface QuestDevice {
  device_id: string
  serial: string
  alias: string
  name: string
  model: string
  android_version: string
  ip: string
  port: number
  status: string
  battery: number
  temperature: number
  is_charging: boolean
  ping_ms: number
  room_id: string
  notes: string
  sort_order: number

  // 自動重連狀態（由後端維護）
  auto_reconnect_disabled_reason?: 'manual_disconnect' | 'max_retries_exhausted'
  auto_reconnect_retry_count?: number
  auto_reconnect_next_attempt_at?: string
  auto_reconnect_last_error?: string

  last_seen: string
  first_connected: string
  created_at: string
  updated_at: string
}

// 房間類型
export interface QuestRoom {
  room_id: string
  name: string
  description: string
  max_devices: number
  device_ids: string[]
  socket_ip: string
  socket_port: number
  socket_running: boolean
  parameters: Record<string, unknown>
  created_at: string
  updated_at: string
}

// 動作類型
export interface QuestAction {
  action_id: string
  name: string
  description: string
  action_type: string
  params: Record<string, unknown>
  execution_count: number
  success_count: number
  failure_count: number
  last_executed_at?: string
  created_at: string
  updated_at: string
}

// 執行結果類型
export interface ExecutionResult {
  device_id: string
  device_name: string
  success: boolean
  message: string
  error: string
}

// 批量執行請求
export interface BatchExecuteRequest {
  action_id: string
  device_ids: string[]
  max_workers?: number
}

// 批量執行響應
export interface BatchExecuteResponse {
  success: boolean
  total: number
  success_count: number
  failed_count: number
  results: ExecutionResult[]
}

// Socket 信息
export interface SocketInfo {
  room_id: string
  port: number
  address: string
  is_running: boolean
}

// 監控狀態
export interface MonitoringStatus {
  running: boolean
}

// Scrcpy 配置
export interface ScrcpyConfig {
  bitrate: string          // 視訊位元率 (e.g., "8M", "16M")
  max_size: number         // 最大螢幕寬度
  max_fps: number          // 最大幀率
  window_width?: number    // 視窗寬度
  window_height?: number   // 視窗高度
  window_x?: number        // 視窗 X 位置
  window_y?: number        // 視窗 Y 位置
  stay_awake: boolean      // 保持設備清醒
  show_touches: boolean    // 顯示觸控點
  fullscreen: boolean      // 全螢幕模式
  always_on_top: boolean   // 視窗置頂
  turn_screen_off: boolean // 關閉設備螢幕
  enable_audio: boolean    // 啟用音訊轉發
  render_driver: string    // 渲染驅動
}

// Scrcpy 會話
export interface ScrcpySession {
  device_id: string        // 設備 ID
  process_id: number       // 進程 PID
  started_at: string       // 啟動時間
  is_running: boolean      // 是否運行中
}

// Scrcpy 系統信息
export interface ScrcpySystemInfo {
  installed: boolean       // 是否已安裝
  version: string          // 版本號
  path: string            // 執行檔路徑
  error_message: string    // 錯誤訊息
}

// Scrcpy 批量啟動請求
export interface ScrcpyBatchStartRequest {
  device_ids: string[]
  config?: ScrcpyConfig
}

// Scrcpy 批量啟動響應（最小型別：目前 UI 只依賴 success_count / failed_count）
export interface ScrcpyBatchStartResponse {
  success: boolean
  total?: number
  success_count: number
  failed_count: number
  results?: unknown[]
}

// 使用者偏好
export interface UserPreference {
  poll_interval_sec: number    // 輪詢間隔（秒）
  batch_size: number            // 批次大小
  max_concurrency: number       // 最大併發數
  reconnect_cooldown_sec: number // 自動重連冷卻（秒）
  reconnect_max_retries: number  // 自動重連最大重試次數
  updated_at: string            // 更新時間
}

// 批量狀態查詢結果項
export interface DeviceStatusResult {
  device_id: string
  battery: number
  temperature: number
  is_charging: boolean
  error: string
}

// 批量狀態查詢響應
export interface BatchStatusResponse {
  success: boolean
  count: number
  results: DeviceStatusResult[]
}
