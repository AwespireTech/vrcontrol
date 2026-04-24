import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { roomApi } from "@/services/api"
import RoomForm from "@/components/console/room-form"
import type { Room } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"

export default function EditRoomPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRoom = async () => {
      if (!id) return

      try {
        const data = await roomApi.get(id)
        setRoom(data)
      } catch (error) {
        console.error("Failed to load room:", error)
        alert("載入房間失敗，請稍後再試")
        navigate("/rooms")
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [id, navigate])

  const handleSubmit = async (updatedRoom: Partial<Room>) => {
    if (!id) return

    try {
      await roomApi.patch(id, updatedRoom)
      alert("房間已更新")
      navigate("/rooms")
    } catch (error) {
      console.error("Failed to update room:", error)
      alert("更新失敗，請稍後再試")
      throw error
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-foreground">載入中…</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-danger">房間不存在</div>
      </div>
    )
  }

  return (
    <PageShell
      title="編輯房間"
      subtitle={`房間 ID: ${id}`}
      maxWidth="sm"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/rooms")}
            className="ui-btn ui-btn-md ui-btn-muted"
          >
            返回房間列表
          </button>
          <button
            onClick={() => navigate(`/rooms/${id}/devices`)}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            管理設備
          </button>
          <button
            onClick={() => navigate(`/rooms/${id}/control`)}
            className="ui-btn ui-btn-md ui-btn-accent"
          >
            前往控制
          </button>
        </div>
      }
    >
      <div className="surface-card p-6">
        <RoomForm room={room} onSubmit={handleSubmit} onCancel={() => navigate("/rooms")} />
      </div>
    </PageShell>
  )
}
