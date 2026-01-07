import { type QuestDevice, QUEST_DEVICE_STATUS } from '@/services/quest-types'
import { getDisplayName } from '@/lib/utils/device'

export type StatusErrorType = 'idle' | 'ok' | 'timeout' | 'adb-error'

interface DeviceCardProps {
  device: QuestDevice
  onConnect?: (deviceId: string) => void
  onDisconnect?: (deviceId: string) => void
  onEdit?: (deviceId: string) => void
  onDelete?: (deviceId: string) => void
  onPing?: (deviceId: string) => void
  onMonitor?: (deviceId: string) => void
  scrcpyInstalled?: boolean
  statusErrorType?: StatusErrorType
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
  statusErrorType = 'idle',
}: DeviceCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case QUEST_DEVICE_STATUS.ONLINE:
        return 'bg-success'
      case QUEST_DEVICE_STATUS.OFFLINE:
        return 'bg-muted'
      case QUEST_DEVICE_STATUS.CONNECTING:
        return 'bg-warning'
      case QUEST_DEVICE_STATUS.ERROR:
        return 'bg-danger'
      default:
        return 'bg-muted'
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

  const renderStatusValue = (value: number | string, unit: string) => {
    if (statusErrorType === 'idle') {
      return <span className="text-foreground/50">-</span>
    }
    if (statusErrorType === 'timeout') {
      return <span className="text-foreground/50" title="狀態查詢逾時">?</span>
    }
    if (statusErrorType === 'adb-error') {
      return <span className="text-foreground/50" title="ADB 查詢失敗">X</span>
    }
    return <span className="text-foreground">{value}{unit}</span>
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 hover:border-primary transition-colors">
      {/* 設備名稱和狀態 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">{getDisplayName(device)}</h3>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
          <span className="text-sm text-foreground/70">{getStatusText(device.status)}</span>
        </div>
      </div>

      {/* 設備信息 */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-foreground/70">IP 地址:</span>
          <span className="font-mono text-foreground">{device.ip}</span>
        </div>
        {device.serial && (
          <div className="flex justify-between">
            <span className="text-foreground/70">序列號:</span>
            <span className="font-mono text-xs text-foreground">{device.serial}</span>
          </div>
        )}
        {device.model && (
          <div className="flex justify-between">
            <span className="text-foreground/70">型號:</span>
            <span className="text-foreground">{device.model}</span>
          </div>
        )}
        {isOnline && (
          <>
            <div className="flex justify-between">
              <span className="text-foreground/70">電量:</span>
              {renderStatusValue(device.battery, '%')}
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/70">溫度:</span>
              {renderStatusValue(device.temperature, '°C')}
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/70">延遲:</span>
              <span className="text-foreground">{device.ping_ms} ms</span>
            </div>
          </>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2 flex-wrap">
        {!isOnline && !isConnecting && onConnect && (
          <button
            onClick={() => onConnect(device.device_id)}
            className="px-3 py-1 text-sm bg-primary text-foreground rounded hover:bg-primary/80 transition-colors"
          >
            連接
          </button>
        )}
        {isOnline && onDisconnect && (
          <button
            onClick={() => onDisconnect(device.device_id)}
            className="px-3 py-1 text-sm bg-danger text-foreground rounded hover:bg-danger/80 transition-colors"
          >
            斷開
          </button>
        )}
        {isOnline && onPing && (
          <button
            onClick={() => onPing(device.device_id)}
            className="px-3 py-1 text-sm bg-success text-foreground rounded hover:bg-success/80 transition-colors"
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
                ? 'bg-accent text-foreground hover:bg-accent/80'
                : 'bg-muted/50 text-foreground/50 cursor-not-allowed'
            }`}
            title={scrcpyInstalled ? '啟動螢幕監看' : 'Scrcpy 未安裝'}
          >
            監看
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(device.device_id)}
            className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
          >
            編輯
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(device.device_id)}
            className="px-3 py-1 text-sm bg-danger text-foreground rounded hover:bg-danger/80 transition-colors"
          >
            刪除
          </button>
        )}
      </div>
    </div>
  )
}
