import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deviceApi, roomApi } from '@/services/quest-api'
import DeviceForm from '@/components/quest/device-form'
import type { QuestDevice } from '@/services/quest-types'
import QuestPageShell from '@/components/quest/quest-page-shell'

export default function EditDevicePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [device, setDevice] = useState<QuestDevice | null>(null)
  const [roomName, setRoomName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDevice = async () => {
      if (!id) return

      try {
        const data = await deviceApi.get(id)
        setDevice(data)
        if (data?.room_id) {
          const room = await roomApi.get(data.room_id)
          setRoomName(room?.name || data.room_id)
        } else {
          setRoomName('')
        }
      } catch (error) {
        console.error('Failed to load device:', error)
        alert('載入設備失敗，請稍後再試')
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
      await deviceApi.patch(id, updatedDevice)
      alert('設備已更新')
      navigate('/quest/devices')
    } catch (error) {
      console.error('Failed to update device:', error)
      alert('更新失敗，請稍後再試')
      throw error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground">載入中…</div>
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
    <QuestPageShell
      title="編輯設備"
      subtitle="更新設備資訊與連線狀態"
      maxWidth="sm"
      actions={
        <button
          onClick={() => navigate('/quest/devices')}
          className="ui-btn ui-btn-md ui-btn-muted"
        >
          返回設備列表
        </button>
      }
    >
      <div className="surface-card p-6">
        <div className="surface-panel mb-6 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/70">Ping 狀態:</span>
            <span className="text-foreground">
              {device.ping_status || 'unknown'} ({device.ping_ms ?? 0} ms)
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-foreground/70">所屬房間:</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground">
                {roomName || '未指派'}
              </span>
              {device.room_id && (
                <button
                  onClick={() => navigate(`/quest/rooms/${device.room_id}/devices`)}
                  className="ui-btn ui-btn-xs ui-btn-muted"
                >
                  管理房間
                </button>
              )}
            </div>
          </div>
        </div>
        <DeviceForm
          device={device}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/quest/devices')}
        />
      </div>
    </QuestPageShell>
  )
}
