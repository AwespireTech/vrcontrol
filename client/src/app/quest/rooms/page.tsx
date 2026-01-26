import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomApi, deviceApi } from '@/services/quest-api'
import type { QuestRoom } from '@/services/quest-types'
import RoomCard from '@/components/quest/room-card'
import { getDisplayName } from '@/lib/utils/device'
import QuestPageShell from '@/components/quest/quest-page-shell'

export default function RoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<QuestRoom[]>([])
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
    <QuestPageShell
      title="房間管理"
      subtitle={`下次更新: ${countdown} 秒`}
      actions={
        <button
          onClick={() => navigate('/quest/rooms/new')}
          className="rounded-full bg-primary px-4 py-2 text-sm text-foreground transition hover:bg-primary/80"
        >
          + 創建房間
        </button>
      }
    >
      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-surface/50 p-10 text-center">
          <div className="text-5xl">🏠</div>
          <div className="mt-4 text-lg font-semibold text-foreground">還沒有房間</div>
          <div className="mt-2 text-sm text-foreground/70">點擊上方按鈕創建您的第一個房間</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.room_id}
              room={room}
              deviceNames={deviceNameMap}
              onDelete={handleDelete}
              onEdit={(roomId) => navigate(`/quest/rooms/${roomId}`)}
              onManageDevices={(roomId) => navigate(`/quest/rooms/${roomId}/devices`)}
              onControl={(roomId) => navigate(`/quest/rooms/${roomId}/control`)}
            />
          ))}
        </div>
      )}
    </QuestPageShell>
  )
}
