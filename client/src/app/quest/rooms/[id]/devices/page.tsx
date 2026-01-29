import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { roomApi, deviceApi } from '@/services/quest-api'
import type { QuestRoom, QuestDevice } from '@/services/quest-types'
import { getDisplayName } from '@/lib/utils/device'
import QuestPageShell from '@/components/quest/quest-page-shell'

const getStatusText = (status: QuestDevice['status']) => {
  switch (status) {
    case 'online':
      return '在線'
    case 'offline':
      return '離線'
    case 'connecting':
      return '連接中'
    case 'error':
      return '錯誤'
    case 'disconnected':
      return '手動斷開'
    default:
      return '未知'
  }
}

const getAdbStatusBadgeClass = (status: QuestDevice['status']) => {
  switch (status) {
    case 'online':
      return 'ui-badge-success'
    case 'connecting':
      return 'ui-badge-warning'
    case 'error':
      return 'ui-badge-danger'
    case 'offline':
    case 'disconnected':
    default:
      return 'ui-badge-muted'
  }
}

const getWsStatusText = (status?: QuestDevice['ws_status']) => {
  if (status === 'connected') return '已連線'
  if (status === 'disconnected') return '未連線'
  return '未知'
}

const getWsStatusBadgeClass = (status?: QuestDevice['ws_status']) => {
  if (status === 'connected') return 'ui-badge-success'
  if (status === 'disconnected') return 'ui-badge-muted'
  return 'ui-badge-muted'
}

export default function RoomDevicesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<QuestRoom | null>(null)
  const [allDevices, setAllDevices] = useState<QuestDevice[]>([])
  const [roomNameMap, setRoomNameMap] = useState<Map<string, string>>(new Map())
  const [roomDevices, setRoomDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!id) return

    try {
      const [roomData, devicesData, roomsData] = await Promise.all([
        roomApi.get(id),
        deviceApi.getAll(),
        roomApi.getAll(),
      ])
      
      setRoom(roomData)
      setAllDevices(devicesData)
      setRoomNameMap(new Map(roomsData.map((r) => [r.room_id, r.name])))
      
      // 過濾出屬於此房間的設備
      const roomDeviceIds = roomData?.device_ids || []
      const devices = devicesData.filter(d => roomDeviceIds.includes(d.device_id))
      setRoomDevices(devices)
    } catch (error) {
      console.error('Failed to load data:', error)
      alert('載入數據失敗')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddDevice = async (device: QuestDevice) => {
    if (!id) return

    if (device.room_id && device.room_id !== id) {
      const currentRoomName = roomNameMap.get(device.room_id) || device.room_id
      const confirmed = window.confirm(
        `此設備目前在「${currentRoomName}」，確定要移入本房間嗎？`,
      )
      if (!confirmed) return
    }

    try {
      if (device.room_id) {
        await roomApi.removeDevice(device.room_id, device.device_id)
      }
      await roomApi.addDevice(id, device.device_id)
      await loadData()
      alert(device.room_id ? '設備已移入房間' : '設備添加成功')
    } catch (error) {
      console.error('Failed to add device:', error)
      alert('添加設備失敗')
    }
  }

  const handleRemoveDevice = async (deviceId: string) => {
    if (!id) return

    try {
      await roomApi.removeDevice(id, deviceId)
      await loadData()
      alert('設備移除成功')
    } catch (error) {
      console.error('Failed to remove device:', error)
      alert('移除設備失敗')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground/70">載入中...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-danger">房間不存在</div>
      </div>
    )
  }

  // 可以添加的設備（不在房間中的設備）
  const availableDevices = allDevices.filter(
    d => !room.device_ids?.includes(d.device_id)
  )

  return (
    <QuestPageShell
      title="管理房間設備"
      subtitle={`房間: ${room.name}`}
      maxWidth="lg"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/quest/rooms')}
            className="ui-btn ui-btn-md ui-btn-muted"
          >
            回到房間列表
          </button>
          <button
            onClick={() => navigate(`/quest/rooms/${id}/control`)}
            className="ui-btn ui-btn-md ui-btn-accent"
          >
            前往控制
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 房間中的設備 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              房間中的設備 ({roomDevices.length})
            </h2>
            
            {roomDevices.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                此房間還沒有設備
              </div>
            ) : (
              <div className="space-y-3">
                {roomDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className="surface-panel surface-card-hover flex items-center justify-between p-4"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{getDisplayName(device)}</div>
                      <div className="text-sm text-foreground/50">
                        {device.ip}:{device.port}
                      </div>
                    </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-9 text-[11px] uppercase tracking-wide text-foreground/50">ADB</span>
                          <span className={`ui-badge ${getAdbStatusBadgeClass(device.status)}`}>
                            {getStatusText(device.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-9 text-[11px] uppercase tracking-wide text-foreground/50">WS</span>
                          <span className={`ui-badge ${getWsStatusBadgeClass(device.ws_status)}`}>
                            {getWsStatusText(device.ws_status)}
                          </span>
                        </div>
                      </div>
                    <button
                      onClick={() => handleRemoveDevice(device.device_id)}
                      className="ui-btn ui-btn-md ui-btn-danger"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 可添加的設備 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              可添加的設備 ({availableDevices.length})
            </h2>
            
            {availableDevices.length === 0 ? (
              <div className="text-center py-8 text-foreground/50">
                沒有可添加的設備
              </div>
            ) : (
              <div className="space-y-3">
                {availableDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className="surface-panel surface-card-hover flex items-center justify-between p-4"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{getDisplayName(device)}</div>
                      <div className="text-sm text-foreground/50">
                        {device.ip}:{device.port}
                      </div>
                    </div>
                      {device.room_id && device.room_id !== room.room_id && (
                        <div className="mt-1 text-xs text-warning">
                          目前房間：{roomNameMap.get(device.room_id) || device.room_id}
                        </div>
                      )}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-9 text-[11px] uppercase tracking-wide text-foreground/50">ADB</span>
                          <span className={`ui-badge ${getAdbStatusBadgeClass(device.status)}`}>
                            {getStatusText(device.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-9 text-[11px] uppercase tracking-wide text-foreground/50">WS</span>
                          <span className={`ui-badge ${getWsStatusBadgeClass(device.ws_status)}`}>
                            {getWsStatusText(device.ws_status)}
                          </span>
                        </div>
                      </div>
                    <button
                      onClick={() => handleAddDevice(device)}
                      className={`ui-btn ui-btn-md ${
                        device.room_id && device.room_id !== room.room_id
                          ? 'ui-btn-accent'
                          : 'ui-btn-success'
                      }`}
                    >
                      {device.room_id && device.room_id !== room.room_id ? '移入' : '添加'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </QuestPageShell>
  )
}
