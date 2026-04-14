import { SERVER } from "@/environment"

// API 基礎配置
export const API_BASE = `${SERVER}/api`

// 設備狀態
export const DEVICE_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  CONNECTING: "connecting",
  ERROR: "error",
  DISCONNECTED: "disconnected",
} as const

// 設備 Ping 狀態
export const DEVICE_PING_STATUS = {
  OK: "ok",
  FAIL: "fail",
  TIMEOUT: "timeout",
  UNKNOWN: "unknown",
} as const

// 動作類型
export const ACTION_TYPES = {
  WAKE_UP: "wake_up",
  SLEEP: "sleep",
  LAUNCH_APP: "launch_app",
  STOP_APP: "stop_app",
  RESTART_APP: "restart_app",
  KEEP_AWAKE: "keep_awake",
  SEND_KEY: "send_key",
  INSTALL_APK: "install_apk",
} as const

// API 響應類型
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 設備類型
export interface Device {
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
  ping_status: string
  room_id: string
  notes: string

  // 是否允許自動重連（由使用者控制，預設 true）
  auto_reconnect_enabled: boolean

  // 自動重連狀態（由後端維護）
  auto_reconnect_disabled_reason?:
    | "manual_disconnect"
    | "max_retries_exhausted"
    | "adb_not_found"
    | "adb_connect_failed"
    | "unknown"
  auto_reconnect_retry_count?: number
  auto_reconnect_next_attempt_at?: string
  auto_reconnect_last_error?: string

  // WebSocket 連線狀態
  ws_status?: "connected" | "disconnected"
  ws_last_seen?: string

  last_seen: string
  first_connected: string
  created_at: string
  updated_at: string
}

// 隔離區連線資料
export interface IsolationDevice {
  client_id: string
  device_id: string
  ip: string
  valid: boolean
  id_matched: boolean
  ip_matched: boolean
  connected_at: string
  last_seen: string
}

export interface USBDevice {
  serial: string
  state: string
  model: string
  ip?: string
  connection_type: "usb" | "network" | "unknown"
  tcpip_enabled: boolean
  tcpip_port?: number
}

// 房間類型
export interface Room {
  room_id: string
  name: string
  description: string
  max_devices: number
  device_ids: string[]
  assigned_sequences: Record<string, number>
  socket_ip: string
  socket_port: number
  socket_running: boolean
  parameters: Record<string, unknown>
  created_at: string
  updated_at: string
}

// 動作類型
export interface Action {
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

export type WebRTCSignalMessageType = "offer" | "answer" | "ice" | "close" | "error"

export type WebRTCStreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "stalled"
  | "error"
  | "closed"

export type WebRTCStreamErrorCode =
  | "invalid_signal"
  | "source_server_exited_with_error"
  | "source_server_exited"
  | "source_backend_not_ready"
  | "source_dummy_byte_error"
  | "source_probe_eof"
  | "source_probe_failed"
  | "source_connected_but_no_data"
  | "invalid_h264_annexb_stream"
  | "no_h264_packets"

export interface WebRTCSignalMessage {
  type: WebRTCSignalMessageType
  sdp?: string
  candidate?: RTCIceCandidateInit
  error?: WebRTCStreamErrorCode | string
}

export interface LiveStreamTarget {
  device_id: string
  title: string
  subtitle?: string
}

// Scrcpy 配置
export interface ScrcpyConfig {
  bitrate: string // 視訊位元率 (e.g., "8M", "16M")
  max_size: number // 最大螢幕寬度
  max_fps: number // 最大幀率
  video_codec_options: string // 額外 video codec options，主要用於 WebRTC 即時畫面
  window_width?: number // 視窗寬度
  window_height?: number // 視窗高度
  window_x?: number // 視窗 X 位置
  window_y?: number // 視窗 Y 位置
  stay_awake: boolean // 保持設備清醒
  show_touches: boolean // 顯示觸控點
  fullscreen: boolean // 全螢幕模式
  always_on_top: boolean // 視窗置頂
  turn_screen_off: boolean // 關閉設備螢幕
  enable_audio: boolean // 啟用音訊轉發
  render_driver: string // 渲染驅動
}

// Scrcpy 會話
export interface ScrcpySession {
  device_id: string // 設備 ID
  process_id: number // 進程 PID
  started_at: string // 啟動時間
  is_running: boolean // 是否運行中
}

// Scrcpy 系統信息
export interface ScrcpySystemInfo {
  installed: boolean // 是否已安裝
  version: string // 版本號
  path: string // 執行檔路徑
  error_message: string // 錯誤訊息
}

// Scrcpy 批量啟動請求
export interface ScrcpyBatchStartRequest {
  device_ids: string[]
  config?: ScrcpyConfig
  layout?: {
    mode?: "tile" | "manual"
    columns?: number
    screen_width?: number
    screen_height?: number
    padding_x?: number
    padding_y?: number
    base_x?: number
    base_y?: number
    gap_x?: number
    gap_y?: number
    frame_margin_x?: number
    frame_margin_y?: number
    window_width?: number
    window_height?: number
  }
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
  poll_interval_sec: number // 輪詢間隔（秒）
  batch_size: number // 批次大小
  max_concurrency: number // 最大併發數
  reconnect_cooldown_sec: number // 自動重連冷卻（秒）
  reconnect_max_retries: number // 自動重連最大重試次數
  updated_at: string // 更新時間
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
