import { type QuestDevice, QUEST_DEVICE_STATUS } from '@/services/quest-types'

interface DeviceCardProps {
  device: QuestDevice
  onConnect?: (deviceId: string) => void
  onDisconnect?: (deviceId: string) => void
  onEdit?: (deviceId: string) => void
  onDelete?: (deviceId: string) => void
  onPing?: (deviceId: string) => void
  onMonitor?: (deviceId: string) => void
  scrcpyInstalled?: boolean
}

export default function DeviceCard({
  device,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onPing,
  onMonitor,
  scrcpyInstalled = false,
}: DeviceCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case QUEST_DEVICE_STATUS.ONLINE:
        return 'bg-green-500'
      case QUEST_DEVICE_STATUS.OFFLINE:
        return 'bg-gray-500'
      case QUEST_DEVICE_STATUS.CONNECTING:
        return 'bg-yellow-500'
      case QUEST_DEVICE_STATUS.ERROR:
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case QUEST_DEVICE_STATUS.ONLINE:
        return '在線'
      case QUEST_DEVICE_STATUS.OFFLINE:
        return '離線'
      case QUEST_DEVICE_STATUS.CONNECTING:
        return '連接中'
      case QUEST_DEVICE_STATUS.ERROR:
        return '錯誤'
      default:
        return '未知'
    }
  }

  const isOnline = device.status === QUEST_DEVICE_STATUS.ONLINE
  const isConnecting = device.status === QUEST_DEVICE_STATUS.CONNECTING

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 設備名稱和狀態 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
          <span className="text-sm text-gray-600">{getStatusText(device.status)}</span>
        </div>
      </div>

      {/* 設備信息 */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">IP 地址:</span>
          <span className="font-mono text-gray-900">{device.ip}</span>
        </div>
        {device.serial && (
          <div className="flex justify-between">
            <span className="text-gray-600">序列號:</span>
            <span className="font-mono text-xs text-gray-900">{device.serial}</span>
          </div>
        )}
        {device.model && (
          <div className="flex justify-between">
            <span className="text-gray-600">型號:</span>
            <span className="text-gray-900">{device.model}</span>
          </div>
        )}
        {isOnline && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">電量:</span>
              <span className="text-gray-900">{device.battery}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">溫度:</span>
              <span className="text-gray-900">{device.temperature}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">延遲:</span>
              <span className="text-gray-900">{device.ping_ms} ms</span>
            </div>
          </>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2 flex-wrap">
        {!isOnline && !isConnecting && onConnect && (
          <button
            onClick={() => onConnect(device.device_id)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            連接
          </button>
        )}
        {isOnline && onDisconnect && (
          <button
            onClick={() => onDisconnect(device.device_id)}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            斷開
          </button>
        )}
        {isOnline && onPing && (
          <button
            onClick={() => onPing(device.device_id)}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Ping
          </button>
        )}
        {isOnline && onMonitor && (
          <button
            onClick={() => onMonitor(device.device_id)}
            disabled={!scrcpyInstalled}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              scrcpyInstalled
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={scrcpyInstalled ? '啟動螢幕監看' : 'Scrcpy 未安裝'}
          >
            監看
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(device.device_id)}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            編輯
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(device.device_id)}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            刪除
          </button>
        )}
      </div>
    </div>
  )
}
