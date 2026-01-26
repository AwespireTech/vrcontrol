import { type QuestRoom } from '@/services/quest-types'

interface RoomCardProps {
  room: QuestRoom
  deviceNames?: Map<string, string>
  onEdit?: (roomId: string) => void
  onDelete?: (roomId: string) => void
  onManageDevices?: (roomId: string) => void
  onControl?: (roomId: string) => void
}

export default function RoomCard({
  room,
  deviceNames,
  onEdit,
  onDelete,
  onManageDevices,
  onControl,
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
          <button
            onClick={() => onControl(room.room_id)}
            className="ui-btn ui-btn-xs ui-btn-primary"
          >
            控制
          </button>
        )}
        {onManageDevices && (
          <button
            onClick={() => onManageDevices(room.room_id)}
            className="ui-btn ui-btn-xs ui-btn-muted"
          >
            管理設備
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(room.room_id)}
            className="ui-btn ui-btn-xs ui-btn-muted"
          >
            編輯
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(room.room_id)}
            className="ui-btn ui-btn-xs ui-btn-danger"
          >
            刪除
          </button>
        )}
      </div>
    </div>
  )
}
