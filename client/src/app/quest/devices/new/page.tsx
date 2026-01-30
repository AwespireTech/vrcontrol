import { useNavigate } from "react-router-dom"
import { deviceApi } from "@/services/quest-api"
import DeviceForm from "@/components/quest/device-form"
import type { QuestDevice } from "@/services/quest-types"
import QuestPageShell from "@/components/quest/quest-page-shell"

export default function NewDevicePage() {
  const navigate = useNavigate()

  const handleSubmit = async (device: Partial<QuestDevice>) => {
    await deviceApi.create(device)
    alert("設備已建立")
    navigate("/quest/devices")
  }

  return (
    <QuestPageShell
      title="建立新設備"
      subtitle="建立新 Quest 設備資料"
      maxWidth="sm"
      actions={
        <button
          onClick={() => navigate("/quest/devices")}
          className="ui-btn ui-btn-md ui-btn-muted"
        >
          返回設備列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <DeviceForm onSubmit={handleSubmit} onCancel={() => navigate("/quest/devices")} />
      </div>
    </QuestPageShell>
  )
}
