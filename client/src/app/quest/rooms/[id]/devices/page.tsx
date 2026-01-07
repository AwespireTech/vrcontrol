import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { roomApi, deviceApi } from '@/services/quest-api'
import type { QuestRoom, QuestDevice } from '@/services/quest-types'

export default function RoomDevicesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<QuestRoom | null>(null)
  const [allDevices, setAllDevices] = useState<QuestDevice[]>([])
  const [roomDevices, setRoomDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!id) return

    try {
      const [roomData, devicesData] = await Promise.all([
        roomApi.get(id),
        deviceApi.getAll()
      ])
      
      setRoom(roomData)
      setAllDevices(devicesData)
      
      // 過濾出屬於此房間的設備
      const roomDeviceIds = roomData?.device_ids || []
      const devices = devicesData.filter(d => roomDeviceIds.includes(d.device_id))
      setRoomDevices(devices)
    } catch (error) {
      console.error('Failed to load data:', error)
      alert('載入數據失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleAddDevice = async (deviceId: string) => {
    if (!id) return

    try {
      await roomApi.addDevice(id, deviceId)
      await loadData()
      alert('設備添加成功')
    } catch (error) {
      console.error('Failed to add device:', error)
      alert('添加設備失敗')
    }
  }

  const handleRemoveDevice = async (deviceId: string) => {
    if (!id) return

    try {
      await roomApi.removeDevice(id, deviceId)
      await loadData()
      alert('設備移除成功')
    } catch (error) {
      console.error('Failed to remove device:', error)
      alert('移除設備失敗')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground/70">載入中...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-danger">房間不存在</div>
      </div>
    )
  }

  // 可以添加的設備（不在房間中的設備）
  const availableDevices = allDevices.filter(
    d => !room.device_ids?.includes(d.device_id)
  )

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(`/quest/rooms/${id}`)}
          className="text-primary hover:text-primary/80 mb-4"
        >
          ← 返回
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">管理房間設備</h1>
          <p className="text-foreground/70 mt-2">房間: {room.name}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 房間中的設備 */}
          <div className="bg-surface rounded-lg  border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              房間中的設備 ({roomDevices.length})
            </h2>
            
            {roomDevices.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                此房間還沒有設備
              </div>
            ) : (
              <div className="space-y-3">
                {roomDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{device.name}</div>
                      <div className="text-sm text-foreground/50">
                        {device.ip}:{device.port}
                      </div>
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          device.status === 'online' 
                            ? 'bg-green-100 text-success'
                            : 'bg-surface text-foreground'
                        }`}>
                          {device.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDevice(device.device_id)}
                      className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 可添加的設備 */}
          <div className="bg-surface rounded-lg  border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              可添加的設備 ({availableDevices.length})
            </h2>
            
            {availableDevices.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                沒有可添加的設備
              </div>
            ) : (
              <div className="space-y-3">
                {availableDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-green-300 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{device.name}</div>
                      <div className="text-sm text-foreground/50">
                        {device.ip}:{device.port}
                      </div>
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          device.status === 'online' 
                            ? 'bg-green-100 text-success'
                            : 'bg-surface text-foreground'
                        }`}>
                          {device.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddDevice(device.device_id)}
                      className="px-4 py-2 bg-success/100 text-white rounded-lg hover:bg-success/80 transition-colors"
                    >
                      添加
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
