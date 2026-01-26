import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { actionApi } from '@/services/quest-api'
import ActionForm from '@/components/quest/action-form'
import type { QuestAction } from '@/services/quest-types'
import QuestPageShell from '@/components/quest/quest-page-shell'

export default function EditActionPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [action, setAction] = useState<QuestAction | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAction = async () => {
      if (!id) return
      
      try {
        const data = await actionApi.get(id)
        setAction(data)
      } catch (error) {
        console.error('Failed to load action:', error)
        alert('載入動作失敗')
        navigate('/quest/actions')
      } finally {
        setLoading(false)
      }
    }

    loadAction()
  }, [id, navigate])

  const handleSubmit = async (updatedAction: Partial<QuestAction>) => {
    if (!id) return
    
    try {
      await actionApi.patch(id, updatedAction)
      alert('動作更新成功')
      navigate('/quest/actions')
    } catch (error) {
      console.error('Failed to update action:', error)
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

  if (!action) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-danger">動作不存在</div>
      </div>
    )
  }

  return (
    <QuestPageShell
      title="編輯動作"
      subtitle="更新動作設定與參數"
      maxWidth="sm"
      actions={
        <button
          onClick={() => navigate('/quest/actions')}
          className="rounded-full bg-muted px-4 py-2 text-sm text-foreground transition hover:bg-muted/80"
        >
          回到動作列表
        </button>
      }
    >
      <div className="rounded-2xl border border-border/70 bg-surface/60 p-6">
        <ActionForm
          action={action}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/quest/actions')}
        />
      </div>
    </QuestPageShell>
  )
}
