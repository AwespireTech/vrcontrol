import { useNavigate } from "react-router-dom"
import { roomApi } from "@/services/quest-api"
import RoomForm from "@/components/quest/room-form"
import type { QuestRoom } from "@/services/quest-types"
import QuestPageShell from "@/components/quest/quest-page-shell"

export default function NewRoomPage() {
  const navigate = useNavigate()

  const handleSubmit = async (room: Partial<QuestRoom>) => {
    await roomApi.create(room)
    alert("房間已建立")
    navigate("/quest/rooms")
  }

  return (
    <QuestPageShell
      title="建立新房間"
      subtitle="建立新房間與設備配置"
      maxWidth="sm"
      actions={
        <button onClick={() => navigate("/quest/rooms")} className="ui-btn ui-btn-md ui-btn-muted">
          返回房間列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <RoomForm onSubmit={handleSubmit} onCancel={() => navigate("/quest/rooms")} />
      </div>
    </QuestPageShell>
  )
}
