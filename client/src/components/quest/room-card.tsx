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
    <div className="rounded-lg border border-border bg-surface p-4 hover:border-primary transition-colors">
      {/* 房間名稱和狀態 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">{room.name}</h3>
      </div>

      {/* 房間描述 */}
      {room.description && (
        <p className="text-sm text-foreground/70 mb-3">{room.description}</p>
      )}

      {/* 房間信息 */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-foreground/70">設備數量:</span>
          <span className="font-semibold text-foreground">{room.device_ids.length}</span>
        </div>
      </div>

      {/* 設備列表 */}
      {room.device_ids.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground mb-2">設備:</p>
          <div className="flex flex-wrap gap-2">
            {room.device_ids.slice(0, 3).map((deviceId) => (
              <span
                key={deviceId}
                className="px-2 py-1 text-xs bg-primary/20 text-primary rounded"
              >
                {deviceNames?.get(deviceId) || deviceId}
              </span>
            ))}
            {room.device_ids.length > 3 && (
              <span className="px-2 py-1 text-xs bg-muted/50 text-foreground/70 rounded">
                +{room.device_ids.length - 3} 更多
              </span>
            )}
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex gap-2 flex-wrap">
        {onControl && (
          <button
            onClick={() => onControl(room.room_id)}
            className="px-3 py-1 text-sm bg-primary text-foreground rounded hover:bg-primary/80 transition-colors"
          >
            控制
          </button>
        )}
        {onManageDevices && (
          <button
            onClick={() => onManageDevices(room.room_id)}
            className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
          >
            管理設備
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(room.room_id)}
            className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
          >
            編輯
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(room.room_id)}
            className="px-3 py-1 text-sm bg-danger text-foreground rounded hover:bg-danger/80 transition-colors"
          >
            刪除
          </button>
        )}
      </div>
    </div>
  )
}
