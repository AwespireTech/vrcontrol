import { useNavigate } from "react-router-dom"
import { actionApi } from "@/services/api"
import ActionForm from "@/components/console/action-form"
import type { Action } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"

export default function NewActionPage() {
  const navigate = useNavigate()

  const handleSubmit = async (action: Partial<Action>) => {
    await actionApi.create(action)
    alert("動作已建立")
    navigate("/actions")
  }

  return (
    <PageShell
      title="建立新動作"
      subtitle="建立新動作範本"
      maxWidth="sm"
      actions={
        <button
          onClick={() => navigate("/actions")}
          className="ui-btn ui-btn-md ui-btn-muted"
        >
          返回動作列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <ActionForm onSubmit={handleSubmit} onCancel={() => navigate("/actions")} />
      </div>
    </PageShell>
  )
}
