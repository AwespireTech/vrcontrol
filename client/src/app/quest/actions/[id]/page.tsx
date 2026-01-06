import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { actionApi } from '@/services/quest-api'
import ActionForm from '@/components/quest/action-form'
import type { QuestAction } from '@/services/quest-types'

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
      await actionApi.update(id, updatedAction)
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
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-600">載入中...</div>
      </div>
    )
  }

  if (!action) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-red-600">動作不存在</div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">編輯動作</h1>
          <ActionForm 
            action={action} 
            onSubmit={handleSubmit} 
            onCancel={() => navigate(-1)} 
          />
        </div>
      </div>
    </div>
  )
}
