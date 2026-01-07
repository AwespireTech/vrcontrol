import { useNavigate } from 'react-router-dom'
import { actionApi } from '@/services/quest-api'
import ActionForm from '@/components/quest/action-form'
import type { QuestAction } from '@/services/quest-types'

export default function NewActionPage() {
  const navigate = useNavigate()

  const handleSubmit = async (action: Partial<QuestAction>) => {
    await actionApi.create(action)
    alert('動作創建成功')
    navigate('/quest/actions')
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/quest/actions')}
          className="text-primary hover:text-primary/80 mb-4"
        >
          ← 返回
        </button>

        <div className="bg-surface rounded-lg  border border-border p-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">創建新動作</h1>
          <ActionForm onSubmit={handleSubmit} onCancel={() => navigate('/quest/actions')} />
        </div>
      </div>
    </div>
  )
}
