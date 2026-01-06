import { SERVER } from "@/environment"

// Quest API 基礎配置
export const QUEST_API_BASE = `${SERVER}/api/quest`

// Quest 設備狀態
export const QUEST_DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  CONNECTING: 'connecting',
  ERROR: 'error'
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
  name: string
  ip: string
  port: number
  serial: string
  status: string
  battery_level: number
  battery_temperature: number
  ping_ms: number
  room_id: string
  model: string
  android_version: string
  sort_order: number
  created_at: string
  updated_at: string
}

// 房間類型
export interface QuestRoom {
  room_id: string
  name: string
  description: string
  device_ids: string[]
  socket_port: number
  socket_address: string
  parameters: Record<string, any>
  created_at: string
  updated_at: string
}

// 動作類型
export interface QuestAction {
  action_id: string
  name: string
  description: string
  action_type: string
  parameters: Record<string, any>
  success_count: number
  failed_count: number
  last_executed_at: string
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
