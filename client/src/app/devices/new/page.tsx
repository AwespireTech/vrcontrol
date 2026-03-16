import { useNavigate } from "react-router-dom"
import { deviceApi } from "@/services/api"
import DeviceForm from "@/components/console/device-form"
import type { Device } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"

export default function NewDevicePage() {
  const navigate = useNavigate()

  const handleSubmit = async (device: Partial<Device>) => {
    await deviceApi.create(device)
    alert("設備已建立")
    navigate("/devices")
  }

  return (
    <PageShell
      title="建立新設備"
      subtitle="建立新設備資料"
      maxWidth="sm"
      actions={
        <button
          onClick={() => navigate("/devices")}
          className="ui-btn ui-btn-md ui-btn-muted"
        >
          返回設備列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <DeviceForm onSubmit={handleSubmit} onCancel={() => navigate("/devices")} />
      </div>
    </PageShell>
  )
}
