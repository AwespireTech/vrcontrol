import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deviceApi } from '@/services/quest-api'
import DeviceForm from '@/components/quest/device-form'
import type { QuestDevice } from '@/services/quest-types'

export default function EditDevicePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [device, setDevice] = useState<QuestDevice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDevice = async () => {
      if (!id) return
      
      try {
        const data = await deviceApi.get(id)
        setDevice(data)
      } catch (error) {
        console.error('Failed to load device:', error)
        alert('載入設備失敗')
        navigate('/quest/devices')
      } finally {
        setLoading(false)
      }
    }

    loadDevice()
  }, [id, navigate])

  const handleSubmit = async (updatedDevice: Partial<QuestDevice>) => {
    if (!id) return
    
    try {
      await deviceApi.update(id, updatedDevice)
      alert('設備更新成功')
      navigate('/quest/devices')
    } catch (error) {
      console.error('Failed to update device:', error)
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

  if (!device) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-danger">設備不存在</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-primary hover:text-primary/80 mb-4"
        >
          ← 返回
        </button>

        <div className="bg-surface rounded-lg border border-border p-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">編輯設備</h1>
          <DeviceForm 
            device={device} 
            onSubmit={handleSubmit} 
            onCancel={() => navigate(-1)} 
          />
        </div>
      </div>
    </div>
  )
}
