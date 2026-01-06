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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:text-blue-600 mb-4"
        >
          ← 返回
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">創建新動作</h1>
          <ActionForm onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
        </div>
      </div>
    </div>
  )
}
