import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { actionApi } from "@/services/api"
import ActionForm from "@/components/console/action-form"
import type { Action } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"

export default function EditActionPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [action, setAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAction = async () => {
      if (!id) return

      try {
        const data = await actionApi.get(id)
        setAction(data)
      } catch (error) {
        console.error("Failed to load action:", error)
        alert("載入動作失敗，請稍後再試")
        navigate("/actions")
      } finally {
        setLoading(false)
      }
    }

    loadAction()
  }, [id, navigate])

  const handleSubmit = async (updatedAction: Partial<Action>) => {
    if (!id) return

    try {
      await actionApi.patch(id, updatedAction)
      alert("動作已更新")
      navigate("/actions")
    } catch (error) {
      console.error("Failed to update action:", error)
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

  if (!action) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-danger">動作不存在</div>
      </div>
    )
  }

  return (
    <PageShell
      title="編輯動作"
      subtitle="更新動作設定與參數"
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
        <ActionForm
          action={action}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/actions")}
        />
      </div>
    </PageShell>
  )
}
