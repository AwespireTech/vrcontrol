import { useNavigate } from "react-router-dom"
import { roomApi } from "@/services/api"
import RoomForm from "@/components/console/room-form"
import type { Room } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"

export default function NewRoomPage() {
  const navigate = useNavigate()

  const handleSubmit = async (room: Partial<Room>) => {
    await roomApi.create(room)
    alert("房間已建立")
    navigate("/rooms")
  }

  return (
    <PageShell
      title="建立新房間"
      subtitle="建立新房間與設備配置"
      maxWidth="sm"
      actions={
        <button onClick={() => navigate("/rooms")} className="ui-btn ui-btn-md ui-btn-muted">
          返回房間列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <RoomForm onSubmit={handleSubmit} onCancel={() => navigate("/rooms")} />
      </div>
    </PageShell>
  )
}
