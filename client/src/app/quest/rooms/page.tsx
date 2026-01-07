import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomApi, deviceApi } from '@/services/quest-api'
import type { QuestRoom, QuestDevice } from '@/services/quest-types'
import RoomCard from '@/components/quest/room-card'
import { getDisplayName } from '@/lib/utils/device'

export default function RoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<QuestRoom[]>([])
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [deviceNameMap, setDeviceNameMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)

  const loadData = async () => {
    try {
      const [roomsData, devicesData] = await Promise.all([
        roomApi.getAll(),
        deviceApi.getAll(),
      ])
      setRooms(roomsData)
      setDevices(devicesData)

      // 建立設備 ID 到名稱的映射
      const nameMap = new Map<string, string>()
      devicesData.forEach((device) => {
        nameMap.set(device.device_id, getDisplayName(device))
      })
      setDeviceNameMap(nameMap)
    } catch (error) {
      console.error('Failed to load rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          loadData()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  const handleStartSocket = async (roomId: string) => {
    try {
      const port = await roomApi.startSocket(roomId)
      alert(`Socket Server 已啟動，端口: ${port}`)
      await loadData()
    } catch (error) {
      console.error('Failed to start socket:', error)
      alert('啟動 Socket Server 失敗')
    }
  }

  const handleStopSocket = async (roomId: string) => {
    try {
      await roomApi.stopSocket(roomId)
      alert('Socket Server 已停止')
      await loadData()
    } catch (error) {
      console.error('Failed to stop socket:', error)
      alert('停止 Socket Server 失敗')
    }
  }

  const handleDelete = async (roomId: string) => {
    if (!confirm('確定要刪除這個房間嗎？')) return

    try {
      await roomApi.delete(roomId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete room:', error)
      alert('刪除失敗')
    }
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
            <h1 className="text-3xl font-bold text-foreground">房間管理</h1>
            <p className="text-foreground/70 mt-2">下次更新: {countdown} 秒</p>
          </div>
          <button
            onClick={() => navigate('/quest/rooms/new')}
            className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/80 transition-colors"
          >
            + 創建房間
          </button>
        </div>

        {/* 房間列表 */}
        {rooms.length === 0 ? (
          <div className="bg-surface rounded-lg p-12 text-center border border-border">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">還沒有房間</h3>
            <p className="text-foreground/70 mb-4">點擊上方按鈕創建您的第一個房間</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard
                key={room.room_id}
                room={room}
                deviceNames={deviceNameMap}
                onStartSocket={handleStartSocket}
                onStopSocket={handleStopSocket}
                onDelete={handleDelete}
                onEdit={(roomId) => navigate(`/quest/rooms/${roomId}`)}
                onManageDevices={(roomId) => navigate(`/quest/rooms/${roomId}/devices`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
