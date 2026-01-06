import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deviceApi } from '@/services/quest-api'
import type { QuestDevice } from '@/services/quest-types'
import DeviceCard from '@/components/quest/device-card'

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)

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

  useEffect(() => {
    loadDevices()

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">加載中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 頁面標題和操作 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-blue-500 hover:text-blue-600 mb-2"
            >
              ← 返回
            </button>
            <h1 className="text-3xl font-bold text-gray-900">設備管理</h1>
            <p className="text-gray-600 mt-2">下次更新: {countdown} 秒</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConnectAll}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              批量連接
            </button>
            <button
              onClick={handlePingAll}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              批量 Ping
            </button>
            <button
              onClick={() => navigate('/quest/devices/new')}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              + 添加設備
            </button>
          </div>
        </div>

        {/* 設備列表 */}
        {devices.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">還沒有設備</h3>
            <p className="text-gray-600 mb-4">點擊上方按鈕添加您的第一個 Quest 設備</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onPing={handlePing}
                onDelete={handleDelete}
                onEdit={(deviceId) => navigate(`/quest/devices/${deviceId}/edit`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
