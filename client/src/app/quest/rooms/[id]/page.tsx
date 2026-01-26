import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { roomApi } from '@/services/quest-api'
import RoomForm from '@/components/quest/room-form'
import type { QuestRoom } from '@/services/quest-types'
import QuestPageShell from '@/components/quest/quest-page-shell'

export default function EditRoomPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<QuestRoom | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRoom = async () => {
      if (!id) return
      
      try {
        const data = await roomApi.get(id)
        setRoom(data)
      } catch (error) {
        console.error('Failed to load room:', error)
        alert('載入房間失敗')
        navigate('/quest/rooms')
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [id, navigate])

  const handleSubmit = async (updatedRoom: Partial<QuestRoom>) => {
    if (!id) return
    
    try {
      await roomApi.patch(id, updatedRoom)
      alert('房間更新成功')
      navigate('/quest/rooms')
    } catch (error) {
      console.error('Failed to update room:', error)
      alert('更新失敗')
      throw error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground">載入中...</div>
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

  return (
    <QuestPageShell
      title="編輯房間"
      subtitle={`房間 ID: ${id}`}
      maxWidth="sm"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/quest/rooms')}
            className="rounded-full bg-muted px-4 py-2 text-sm text-foreground transition hover:bg-muted/80"
          >
            回到房間列表
          </button>
          <button
            onClick={() => navigate(`/quest/rooms/${id}/devices`)}
            className="rounded-full bg-primary px-4 py-2 text-sm text-foreground transition hover:bg-primary/80"
          >
            管理設備
          </button>
          <button
            onClick={() => navigate(`/quest/rooms/${id}/control`)}
            className="rounded-full bg-accent px-4 py-2 text-sm text-foreground transition hover:bg-accent/80"
          >
            前往控制
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-border/70 bg-surface/60 p-6">
        <RoomForm
          room={room}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/quest/rooms')}
        />
      </div>
    </QuestPageShell>
  )
}
