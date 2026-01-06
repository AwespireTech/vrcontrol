import { type QuestRoom } from '@/services/quest-types'

interface RoomCardProps {
  room: QuestRoom
  deviceNames?: Map<string, string>
  onEdit?: (roomId: string) => void
  onDelete?: (roomId: string) => void
  onStartSocket?: (roomId: string) => void
  onStopSocket?: (roomId: string) => void
  onManageDevices?: (roomId: string) => void
}

export default function RoomCard({
  room,
  deviceNames,
  onEdit,
  onDelete,
  onStartSocket,
  onStopSocket,
  onManageDevices,
}: RoomCardProps) {
  const isSocketRunning = room.socket_port > 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 房間名稱和狀態 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
        <div className="flex items-center gap-2">
          {isSocketRunning ? (
            <>
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">運行中</span>
            </>
          ) : (
            <>
              <span className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-sm text-gray-600">已停止</span>
            </>
          )}
        </div>
      </div>

      {/* 房間描述 */}
      {room.description && (
        <p className="text-sm text-gray-600 mb-3">{room.description}</p>
      )}

      {/* 房間信息 */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">設備數量:</span>
          <span className="font-semibold text-gray-900">{room.device_ids.length}</span>
        </div>
        {isSocketRunning && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Socket 端口:</span>
              <span className="font-mono text-gray-900">{room.socket_port}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Socket IP:</span>
              <span className="font-mono text-xs text-gray-900">{room.socket_ip}</span>
            </div>
          </>
        )}
      </div>

      {/* 設備列表 */}
      {room.device_ids.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">設備:</p>
          <div className="flex flex-wrap gap-2">
            {room.device_ids.slice(0, 3).map((deviceId) => (
              <span
                key={deviceId}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {deviceNames?.get(deviceId) || deviceId}
              </span>
            ))}
            {room.device_ids.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                +{room.device_ids.length - 3} 更多
              </span>
            )}
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex gap-2 flex-wrap">
        {!isSocketRunning && onStartSocket && (
          <button
            onClick={() => onStartSocket(room.room_id)}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            啟動 Socket
          </button>
        )}
        {isSocketRunning && onStopSocket && (
          <button
            onClick={() => onStopSocket(room.room_id)}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            停止 Socket
          </button>
        )}
        {onManageDevices && (
          <button
            onClick={() => onManageDevices(room.room_id)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            管理設備
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(room.room_id)}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            編輯
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(room.room_id)}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            刪除
          </button>
        )}
      </div>
    </div>
  )
}
