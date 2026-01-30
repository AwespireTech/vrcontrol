import { type QuestRoom } from '@/services/quest-types'
import Button from '@/components/button'

interface RoomCardProps {
  room: QuestRoom
  deviceNames?: Map<string, string>
  onEdit?: (roomId: string) => void
  onDelete?: (roomId: string) => void
  onManageDevices?: (roomId: string) => void
  onControl?: (roomId: string) => void
  controlLoading?: boolean
  manageDevicesLoading?: boolean
  editLoading?: boolean
  deleteLoading?: boolean
}

export default function RoomCard({
  room,
  deviceNames,
  onEdit,
  onDelete,
  onManageDevices,
  onControl,
  controlLoading,
  manageDevicesLoading,
  editLoading,
  deleteLoading,
}: RoomCardProps) {
  return (
    <div className="surface-card surface-card-hover p-5">
      {/* 房間名稱和狀態 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{room.name}</h3>
      </div>

      {/* 房間描述 */}
      {room.description && (
        <p className="mb-3 text-sm text-foreground/70">{room.description}</p>
      )}

      {/* 房間信息 */}
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-foreground/70">設備數量:</span>
          <span className="font-semibold text-foreground">{room.device_ids.length}</span>
        </div>
      </div>

      {/* 設備列表 */}
      {room.device_ids.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-foreground">設備:</p>
          <div className="flex flex-wrap gap-2">
            {room.device_ids.slice(0, 3).map((deviceId) => (
              <span
                key={deviceId}
                className="ui-badge ui-badge-primary"
              >
                {deviceNames?.get(deviceId) || deviceId}
              </span>
            ))}
            {room.device_ids.length > 3 && (
              <span className="ui-badge ui-badge-muted">
                +{room.device_ids.length - 3} 更多
              </span>
            )}
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-2">
        {onControl && (
          <Button
            onClick={() => onControl(room.room_id)}
            className="ui-btn-xs ui-btn-primary"
            loading={controlLoading}
            disabled={controlLoading}
          >
            控制
          </Button>
        )}
        {onManageDevices && (
          <Button
            onClick={() => onManageDevices(room.room_id)}
            className="ui-btn-xs ui-btn-muted"
            loading={manageDevicesLoading}
            disabled={manageDevicesLoading}
          >
            管理設備
          </Button>
        )}
        {onEdit && (
          <Button
            onClick={() => onEdit(room.room_id)}
            className="ui-btn-xs ui-btn-muted"
            loading={editLoading}
            disabled={editLoading}
          >
            編輯
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={() => onDelete(room.room_id)}
            className="ui-btn-xs ui-btn-danger"
            loading={deleteLoading}
            disabled={deleteLoading}
          >
            刪除
          </Button>
        )}
      </div>
    </div>
  )
}
