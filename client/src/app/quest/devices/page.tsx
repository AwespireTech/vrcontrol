import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deviceApi, scrcpyApi } from '@/services/quest-api'
import type { QuestDevice, ScrcpySession, ScrcpySystemInfo } from '@/services/quest-types'
import DeviceCard from '@/components/quest/device-card'

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  
  // Scrcpy 相關狀態
  const [scrcpySystemInfo, setScrcpySystemInfo] = useState<ScrcpySystemInfo | null>(null)
  const [scrcpySessions, setScrcpySessions] = useState<ScrcpySession[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])

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
    loadDevices()
    loadScrcpyInfo()

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          loadDevices()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  const handleConnect = async (deviceId: string) => {
    try {
      await deviceApi.connect(deviceId)
      await loadDevices()
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
    } catch (error: any) {
      console.error('Failed to start scrcpy:', error)
      alert(error.message || '啟動監看失敗')
    }
  }

  const handleMonitorBatch = async () => {
    if (!scrcpySystemInfo?.installed) {
      alert('Scrcpy 未安裝，請先安裝 scrcpy')
      return
    }

    const onlineDevices = devices.filter((d) => d.status === 'online')
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
              onClick={() => navigate(-1)}
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
