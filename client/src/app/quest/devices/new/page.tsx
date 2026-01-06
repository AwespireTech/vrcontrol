import { useNavigate } from 'react-router-dom'
import { deviceApi } from '@/services/quest-api'
import DeviceForm from '@/components/quest/device-form'
import type { QuestDevice } from '@/services/quest-types'

export default function NewDevicePage() {
  const navigate = useNavigate()

  const handleSubmit = async (device: Partial<QuestDevice>) => {
    await deviceApi.create(device)
    alert('設備創建成功')
    navigate('/quest/devices')
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

        <div className="bg-surface rounded-lg  border border-border p-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">添加新設備</h1>
          <DeviceForm onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
        </div>
      </div>
    </div>
  )
}
