import { useNavigate } from 'react-router-dom'
import { actionApi } from '@/services/quest-api'
import ActionForm from '@/components/quest/action-form'
import type { QuestAction } from '@/services/quest-types'
import QuestPageShell from '@/components/quest/quest-page-shell'

export default function NewActionPage() {
  const navigate = useNavigate()

  const handleSubmit = async (action: Partial<QuestAction>) => {
    await actionApi.create(action)
    alert('動作創建成功')
    navigate('/quest/actions')
  }

  return (
    <QuestPageShell
      title="創建新動作"
      subtitle="建立新的動作範本"
      maxWidth="sm"
      actions={
        <button
          onClick={() => navigate('/quest/actions')}
          className="ui-btn ui-btn-md ui-btn-muted"
        >
          回到動作列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <ActionForm onSubmit={handleSubmit} onCancel={() => navigate('/quest/actions')} />
      </div>
    </QuestPageShell>
  )
}
