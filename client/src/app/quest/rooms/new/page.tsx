import { useNavigate } from 'react-router-dom'
import { roomApi } from '@/services/quest-api'
import RoomForm from '@/components/quest/room-form'
import type { QuestRoom } from '@/services/quest-types'

export default function NewRoomPage() {
  const navigate = useNavigate()

  const handleSubmit = async (room: Partial<QuestRoom>) => {
    await roomApi.create(room)
    alert('房間創建成功')
    navigate('/quest/rooms')
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-primary hover:text-primary/80 mb-4"
        >
          ← 返回
        </button>

        <div className="bg-surface rounded-lg  border border-border p-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">創建新房間</h1>
          <RoomForm onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
        </div>
      </div>
    </div>
  )
}
