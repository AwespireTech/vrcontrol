import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { deviceApi, scrcpyApi, preferenceApi } from '@/services/quest-api'
import type { QuestDevice, ScrcpySession, ScrcpySystemInfo, UserPreference } from '@/services/quest-types'
import DeviceCard, { type StatusErrorType } from '@/components/quest/device-card'
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from '@/environment'

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)
  
  // Scrcpy 相關狀態
  const [scrcpySystemInfo, setScrcpySystemInfo] = useState<ScrcpySystemInfo | null>(null)
  const [scrcpySessions, setScrcpySessions] = useState<ScrcpySession[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])

  // 使用者偏好與狀態錯誤追蹤
  const [preference, setPreference] = useState<UserPreference | null>(null)
  const [statusErrors, setStatusErrors] = useState<Record<string, StatusErrorType>>({})
  
  // 輪詢控制
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 避免 useCallback 依賴 devices 導致輪詢 interval 反覆重設
  const devicesRef = useRef<QuestDevice[]>([])
  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  const loadDevices = async () => {
    try {
      const data = await deviceApi.getAll()
      setDevices(data)
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshOnlineStatuses = useCallback(async () => {
    if (!preference) return

    const onlineDeviceIds = devicesRef.current
      .filter((d) => d.status === 'online')
      .map((d) => d.device_id)

    if (onlineDeviceIds.length === 0) return

    const batchSize =
      typeof preference.batch_size === 'number' && preference.batch_size > 0
        ? preference.batch_size
        : DEFAULT_BATCH_SIZE

    const maxWorkers =
      typeof preference.max_concurrency === 'number' && preference.max_concurrency > 0
        ? preference.max_concurrency
        : DEFAULT_MAX_CONCURRENCY

    for (let i = 0; i < onlineDeviceIds.length; i += batchSize) {
      const batchIds = onlineDeviceIds.slice(i, i + batchSize)

      try {
        const result = await deviceApi.getStatusBatch(batchIds, maxWorkers)

        if (result.success && result.results) {
          setDevices((prevDevices) => {
            const newDevices = [...prevDevices]
            result.results.forEach((statusResult) => {
              const deviceIndex = newDevices.findIndex(
                (d) => d.device_id === statusResult.device_id
              )
              if (deviceIndex >= 0) {
                if (statusResult.error) {
                  // 分類錯誤：含 timeout 為超時，其他為 ADB 錯誤
                  const errorType = statusResult.error.toLowerCase().includes('timeout')
                    ? 'timeout'
                    : 'adb-error'
                  setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: errorType }))
                } else {
                  // 成功獲取狀態
                  newDevices[deviceIndex] = {
                    ...newDevices[deviceIndex],
                    battery: statusResult.battery,
                    temperature: statusResult.temperature,
                    is_charging: statusResult.is_charging,
                  }
                  setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: 'ok' }))
                }
              }
            })
            return newDevices
          })
        }
      } catch (error) {
        console.error('Failed to refresh status batch:', error)
      }
    }
  }, [preference])

  const loadScrcpyInfo = async () => {
    try {
      const info = await scrcpyApi.getSystemInfo()
      setScrcpySystemInfo(info)
      
      if (info.installed) {
        const sessions = await scrcpyApi.getSessions()
        setScrcpySessions(sessions)
      }
    } catch (error) {
      console.error('Failed to load scrcpy info:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      // 載入偏好設定
      try {
        const pref = await preferenceApi.get()
        setPreference(pref)
      } catch (error) {
        console.error('Failed to load preference:', error)
        // 使用預設值
        setPreference({
          poll_interval_sec: DEFAULT_POLL_INTERVAL_SECONDS,
          batch_size: DEFAULT_BATCH_SIZE,
          max_concurrency: DEFAULT_MAX_CONCURRENCY,
          updated_at: '',
        })
      }

      // 載入設備列表
      await loadDevices()
      await loadScrcpyInfo()
    }

    init()
  }, [])

  // 當設備列表或偏好設定更新時，執行一次狀態刷新
  useEffect(() => {
    if (devices.length > 0 && preference) {
      refreshOnlineStatuses()
    }
  }, [devices.length, preference, refreshOnlineStatuses])

  // 設定輪詢和可見性監聽
  useEffect(() => {
    if (!preference) return

    const pollIntervalSeconds =
      typeof preference.poll_interval_sec === 'number' && preference.poll_interval_sec > 0
        ? preference.poll_interval_sec
        : DEFAULT_POLL_INTERVAL_SECONDS

    // Option B：每次進入頁面（mount）就重置倒數
    setCountdown(pollIntervalSeconds)

    // 設定狀態輪詢（使用偏好設定的間隔）
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
    }
    statusIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        refreshOnlineStatuses()
      }
    }, pollIntervalSeconds * 1000)

    // 設定列表輪詢（60 秒）
    if (listIntervalRef.current) {
      clearInterval(listIntervalRef.current)
    }
    listIntervalRef.current = setInterval(() => {
      if (!document.hidden) loadDevices()
    }, 60000)

    // 倒數計時器（UI 顯示用）
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return pollIntervalSeconds
        return prev - 1
      })
    }, 1000)

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
      if (listIntervalRef.current) clearInterval(listIntervalRef.current)
      clearInterval(countdownInterval)
    }
  }, [preference, refreshOnlineStatuses])

  const handleConnect = async (deviceId: string) => {
    try {
      await deviceApi.connect(deviceId)
      await loadDevices()
      
      // 連接成功後立即查詢狀態
      try {
        const status = await deviceApi.getStatus(deviceId)
        setDevices((prevDevices) =>
          prevDevices.map((d) =>
            d.device_id === deviceId
              ? {
                  ...d,
                  battery: status.battery,
                  temperature: status.temperature,
                  is_charging: status.is_charging,
                }
              : d
          )
        )
        setStatusErrors((prev) => ({ ...prev, [deviceId]: 'ok' }))
      } catch (statusError: unknown) {
        console.error('Failed to get device status after connect:', statusError)
        const message = statusError instanceof Error ? statusError.message : String(statusError)
        // 分類錯誤
        const errorType = message.toLowerCase().includes('timeout') ? 'timeout' : 'adb-error'
        setStatusErrors((prev) => ({ ...prev, [deviceId]: errorType }))
      }
    } catch (error) {
      console.error('Failed to connect device:', error)
      alert('連接失敗')
    }
  }

  const handleDisconnect = async (deviceId: string) => {
    try {
      await deviceApi.disconnect(deviceId)
      await loadDevices()
    } catch (error) {
      console.error('Failed to disconnect device:', error)
      alert('斷開失敗')
    }
  }

  const handlePing = async (deviceId: string) => {
    try {
      await deviceApi.ping(deviceId)
      await loadDevices()
    } catch (error) {
      console.error('Failed to ping device:', error)
      alert('Ping 失敗')
    }
  }

  const handleDelete = async (deviceId: string) => {
    if (!confirm('確定要刪除這個設備嗎？')) return

    try {
      await deviceApi.delete(deviceId)
      await loadDevices()
    } catch (error) {
      console.error('Failed to delete device:', error)
      alert('刪除失敗')
    }
  }

  const handleConnectAll = async () => {
    const offlineDevices = devices.filter((d) => d.status === 'offline')
    if (offlineDevices.length === 0) {
      alert('沒有離線設備')
      return
    }

    try {
      const result = await deviceApi.connectBatch(
        offlineDevices.map((d) => d.device_id),
        5,
      )
      alert(`批量連接完成：成功 ${result.success_count}，失敗 ${result.failed_count}`)
      await loadDevices()
    } catch (error) {
      console.error('Failed to connect all devices:', error)
      alert('批量連接失敗')
    }
  }

  const handlePingAll = async () => {
    const onlineDevices = devices.filter((d) => d.status === 'online')
    if (onlineDevices.length === 0) {
      alert('沒有在線設備')
      return
    }

    try {
      await deviceApi.pingBatch(
        onlineDevices.map((d) => d.device_id),
        10,
      )
      await loadDevices()
    } catch (error) {
      console.error('Failed to ping all devices:', error)
      alert('批量 Ping 失敗')
    }
  }

  const handleMonitor = async (deviceId: string) => {
    if (!scrcpySystemInfo?.installed) {
      alert('Scrcpy 未安裝，請先安裝 scrcpy')
      return
    }

    try {
      await scrcpyApi.start(deviceId)
      alert('已啟動監看視窗')
      await loadScrcpyInfo()
    } catch (error: unknown) {
      console.error('Failed to start scrcpy:', error)
      const message = error instanceof Error ? error.message : ''
      alert(message || '啟動監看失敗')
    }
  }

  const handleMonitorBatch = async () => {
    if (!scrcpySystemInfo?.installed) {
      alert('Scrcpy 未安裝，請先安裝 scrcpy')
      return
    }

    if (selectedDeviceIds.length === 0) {
      alert('請先選擇要監看的設備')
      return
    }

    try {
      const result = await scrcpyApi.startBatch({ device_ids: selectedDeviceIds })
      alert(`批量監看啟動完成：成功 ${result.success_count}，失敗 ${result.failed_count}`)
      await loadScrcpyInfo()
      setSelectedDeviceIds([])
    } catch (error) {
      console.error('Failed to start batch scrcpy:', error)
      alert('批量監看啟動失敗')
    }
  }

  const handleStopScrcpy = async (deviceId: string) => {
    try {
      await scrcpyApi.stop(deviceId)
      alert('已停止監看')
      await loadScrcpyInfo()
    } catch (error) {
      console.error('Failed to stop scrcpy:', error)
      alert('停止監看失敗')
    }
  }

  const handleRefreshSessions = async () => {
    try {
      const sessions = await scrcpyApi.refreshSessions()
      setScrcpySessions(sessions)
    } catch (error) {
      console.error('Failed to refresh sessions:', error)
    }
  }

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground">加載中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* 頁面標題和操作 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/quest')}
              className="text-primary hover:text-primary/80 mb-2"
            >
              ← 返回
            </button>
            <h1 className="text-3xl font-bold text-foreground">設備管理</h1>
            <p className="text-foreground/70 mt-2">下次更新: {countdown} 秒</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConnectAll}
              className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/80 transition-colors"
            >
              批量連接
            </button>
            <button
              onClick={handlePingAll}
              className="px-4 py-2 bg-success text-foreground rounded-lg hover:bg-success/80 transition-colors"
            >
              批量 Ping
            </button>
            {scrcpySystemInfo?.installed && selectedDeviceIds.length > 0 && (
              <button
                onClick={handleMonitorBatch}
                className="px-4 py-2 bg-accent text-foreground rounded-lg hover:bg-accent/80 transition-colors"
              >
                批量監看 ({selectedDeviceIds.length})
              </button>
            )}
            <button
              onClick={() => navigate('/quest/devices/new')}
              className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/80 transition-colors"
            >
              + 添加設備
            </button>
          </div>
        </div>

        {/* 設備列表 */}
        {devices.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-lg border border-border">
            <p className="text-foreground/70">尚無設備</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <div key={device.device_id} className="relative">
                {device.status === 'online' && scrcpySystemInfo?.installed && (
                  <input
                    type="checkbox"
                    checked={selectedDeviceIds.includes(device.device_id)}
                    onChange={() => toggleDeviceSelection(device.device_id)}
                    className="absolute top-2 left-2 w-5 h-5 z-10"
                  />
                )}
                <DeviceCard
                  device={device}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onPing={handlePing}
                  onDelete={handleDelete}
                  onEdit={(deviceId) => navigate(`/quest/devices/${deviceId}`)}
                  onMonitor={handleMonitor}
                  scrcpyInstalled={scrcpySystemInfo?.installed}
                  statusErrorType={statusErrors[device.device_id] || 'idle'}
                />
              </div>
            ))}
          </div>
        )}

        {/* Scrcpy 會話列表 */}
        {scrcpySystemInfo?.installed && scrcpySessions.length > 0 && (
          <div className="mt-8 bg-surface rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">監看會話</h2>
              <button
                onClick={handleRefreshSessions}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                刷新狀態
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      設備
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      PID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      啟動時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                  {scrcpySessions.map((session) => {
                    const device = devices.find((d) => d.device_id === session.device_id)
                    return (
                      <tr key={session.device_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {device?.name || session.device_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground/70">
                          {session.process_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/70">
                          {new Date(session.started_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              session.is_running
                                ? 'bg-success/20 text-success'
                                : 'bg-muted/50 text-foreground/70'
                            }`}
                          >
                            {session.is_running ? '運行中' : '已停止'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {session.is_running && (
                            <button
                              onClick={() => handleStopScrcpy(session.device_id)}
                              className="text-danger hover:text-danger/80"
                            >
                              停止
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
