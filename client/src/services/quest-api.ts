import {
  QUEST_API_BASE,
  type ApiResponse,
  type QuestDevice,
  type QuestRoom,
  type QuestAction,
  type BatchExecuteRequest,
  type BatchExecuteResponse,
  type SocketInfo,
  type MonitoringStatus,
  type ExecutionResult,
} from './quest-types'

// ============ 設備 API ============

export const deviceApi = {
  // 獲取所有設備
  getAll: async (): Promise<QuestDevice[]> => {
    const res = await fetch(`${QUEST_API_BASE}/devices`)
    const data: ApiResponse<QuestDevice[]> = await res.json()
    return data.data || []
  },

  // 獲取單個設備
  get: async (deviceId: string): Promise<QuestDevice | null> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}`)
    const data: ApiResponse<QuestDevice> = await res.json()
    return data.data || null
  },

  // 創建設備
  create: async (device: Partial<QuestDevice>): Promise<QuestDevice> => {
    const res = await fetch(`${QUEST_API_BASE}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    })
    const data: ApiResponse<QuestDevice> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to create device')
    return data.data!
  },

  // 更新設備
  update: async (deviceId: string, device: Partial<QuestDevice>): Promise<QuestDevice> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    })
    const data: ApiResponse<QuestDevice> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to update device')
    return data.data!
  },

  // 刪除設備
  delete: async (deviceId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}`, {
      method: 'DELETE',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to delete device')
  },

  // 連接設備
  connect: async (deviceId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}/connect`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to connect device')
  },

  // 斷開設備
  disconnect: async (deviceId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}/disconnect`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to disconnect device')
  },

  // 獲取設備狀態
  getStatus: async (deviceId: string): Promise<QuestDevice> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}/status`)
    const data: ApiResponse<QuestDevice> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to get device status')
    return data.data!
  },

  // Ping 設備
  ping: async (deviceId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/${deviceId}/ping`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to ping device')
  },

  // 批量連接
  connectBatch: async (deviceIds: string[], maxWorkers?: number): Promise<BatchExecuteResponse> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/batch/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: deviceIds, max_workers: maxWorkers }),
    })
    return await res.json()
  },

  // 批量 Ping
  pingBatch: async (deviceIds: string[], maxWorkers?: number): Promise<BatchExecuteResponse> => {
    const res = await fetch(`${QUEST_API_BASE}/devices/batch/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: deviceIds, max_workers: maxWorkers }),
    })
    return await res.json()
  },
}

// ============ 房間 API ============

export const roomApi = {
  // 獲取所有房間
  getAll: async (): Promise<QuestRoom[]> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms`)
    const data: ApiResponse<QuestRoom[]> = await res.json()
    return data.data || []
  },

  // 獲取單個房間
  get: async (roomId: string): Promise<QuestRoom | null> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}`)
    const data: ApiResponse<QuestRoom> = await res.json()
    return data.data || null
  },

  // 創建房間
  create: async (room: Partial<QuestRoom>): Promise<QuestRoom> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    })
    const data: ApiResponse<QuestRoom> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to create room')
    return data.data!
  },

  // 更新房間
  update: async (roomId: string, room: Partial<QuestRoom>): Promise<QuestRoom> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    })
    const data: ApiResponse<QuestRoom> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to update room')
    return data.data!
  },

  // 刪除房間
  delete: async (roomId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}`, {
      method: 'DELETE',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to delete room')
  },

  // 添加設備到房間
  addDevice: async (roomId: string, deviceId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}/devices/${deviceId}`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to add device to room')
  },

  // 從房間移除設備
  removeDevice: async (roomId: string, deviceId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}/devices/${deviceId}`, {
      method: 'DELETE',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to remove device from room')
  },

  // 啟動 Socket Server
  startSocket: async (roomId: string): Promise<number> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}/socket/start`, {
      method: 'POST',
    })
    const data: ApiResponse<{ port: number }> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to start socket server')
    return data.data!.port
  },

  // 停止 Socket Server
  stopSocket: async (roomId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}/socket/stop`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to stop socket server')
  },

  // 獲取 Socket 信息
  getSocketInfo: async (roomId: string): Promise<SocketInfo> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}/socket/info`)
    const data: ApiResponse<SocketInfo> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to get socket info')
    return data.data!
  },

  // 同步參數
  syncParameters: async (roomId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/rooms/${roomId}/parameters/sync`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to sync parameters')
  },
}

// ============ 動作 API ============

export const actionApi = {
  // 獲取所有動作
  getAll: async (): Promise<QuestAction[]> => {
    const res = await fetch(`${QUEST_API_BASE}/actions`)
    const data: ApiResponse<QuestAction[]> = await res.json()
    return data.data || []
  },

  // 獲取單個動作
  get: async (actionId: string): Promise<QuestAction | null> => {
    const res = await fetch(`${QUEST_API_BASE}/actions/${actionId}`)
    const data: ApiResponse<QuestAction> = await res.json()
    return data.data || null
  },

  // 創建動作
  create: async (action: Partial<QuestAction>): Promise<QuestAction> => {
    const res = await fetch(`${QUEST_API_BASE}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    })
    const data: ApiResponse<QuestAction> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to create action')
    return data.data!
  },

  // 更新動作
  update: async (actionId: string, action: Partial<QuestAction>): Promise<QuestAction> => {
    const res = await fetch(`${QUEST_API_BASE}/actions/${actionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    })
    const data: ApiResponse<QuestAction> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to update action')
    return data.data!
  },

  // 刪除動作
  delete: async (actionId: string): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/actions/${actionId}`, {
      method: 'DELETE',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to delete action')
  },

  // 執行動作
  execute: async (actionId: string, deviceId: string): Promise<ExecutionResult> => {
    const res = await fetch(`${QUEST_API_BASE}/actions/${actionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    })
    const data: ApiResponse<ExecutionResult> = await res.json()
    return data.data!
  },

  // 批量執行動作
  executeBatch: async (request: BatchExecuteRequest): Promise<BatchExecuteResponse> => {
    const res = await fetch(`${QUEST_API_BASE}/actions/batch/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return await res.json()
  },
}

// ============ 監控 API ============

export const monitoringApi = {
  // 獲取監控狀態
  getStatus: async (): Promise<MonitoringStatus> => {
    const res = await fetch(`${QUEST_API_BASE}/monitoring/status`)
    const data: ApiResponse<MonitoringStatus> = await res.json()
    return data.data || { running: false }
  },

  // 啟動監控
  start: async (): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/monitoring/start`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to start monitoring')
  },

  // 停止監控
  stop: async (): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/monitoring/stop`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to stop monitoring')
  },

  // 設置監控間隔
  setInterval: async (intervalSeconds: number): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/monitoring/interval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval: intervalSeconds }),
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to set monitoring interval')
  },

  // 手動執行一次監控
  runOnce: async (): Promise<void> => {
    const res = await fetch(`${QUEST_API_BASE}/monitoring/run-once`, {
      method: 'POST',
    })
    const data: ApiResponse<void> = await res.json()
    if (!data.success) throw new Error(data.error || 'Failed to run monitoring')
  },
}
