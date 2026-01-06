import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { roomApi } from '@/services/quest-api'
import RoomForm from '@/components/quest/room-form'
import type { QuestRoom } from '@/services/quest-types'

export default function EditRoomPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<QuestRoom | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRoom = async () => {
      if (!id) return
      
      try {
        const data = await roomApi.get(id)
        setRoom(data)
      } catch (error) {
        console.error('Failed to load room:', error)
        alert('載入房間失敗')
        navigate('/quest/rooms')
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [id, navigate])

  const handleSubmit = async (updatedRoom: Partial<QuestRoom>) => {
    if (!id) return
    
    try {
      await roomApi.update(id, updatedRoom)
      alert('房間更新成功')
      navigate('/quest/rooms')
    } catch (error) {
      console.error('Failed to update room:', error)
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

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-red-600">房間不存在</div>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">編輯房間</h1>
          <RoomForm 
            room={room} 
            onSubmit={handleSubmit} 
            onCancel={() => navigate(-1)} 
          />
        </div>
      </div>
    </div>
  )
}
