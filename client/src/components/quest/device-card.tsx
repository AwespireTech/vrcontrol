import { type QuestDevice, QUEST_DEVICE_STATUS } from '@/services/quest-types'
import { getDisplayName } from '@/lib/utils/device'
import Button from '@/components/button'

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
  pingTooltipText?: string
  connectLoading?: boolean
  disconnectLoading?: boolean
  pingLoading?: boolean
  monitorLoading?: boolean
  deleteLoading?: boolean
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
  pingTooltipText,
  connectLoading,
  disconnectLoading,
  pingLoading,
  monitorLoading,
  deleteLoading,
}: DeviceCardProps) {

  const getAutoReconnectDisabledReasonText = (reason?: QuestDevice['auto_reconnect_disabled_reason']) => {
    switch (reason) {
      case 'manual_disconnect':
        return '手動斷開（不自動重連）'
      case 'max_retries_exhausted':
        return '自動重連已達上限'
      case 'adb_not_found':
        return '找不到 ADB（請確認已安裝並加入 PATH）'
      case 'adb_connect_failed':
        return 'ADB 連線失敗（重試後停止）'
      case 'unknown':
        return '未知錯誤（重試後停止）'
      default:
        return ''
    }
  }
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
      case QUEST_DEVICE_STATUS.DISCONNECTED:
        return 'bg-muted'
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
      case QUEST_DEVICE_STATUS.DISCONNECTED:
        return '手動斷開'
      default:
        return '未知'
    }
  }

  const isOnline = device.status === QUEST_DEVICE_STATUS.ONLINE
  const isConnecting = device.status === QUEST_DEVICE_STATUS.CONNECTING
  const disabledReasonText = getAutoReconnectDisabledReasonText(device.auto_reconnect_disabled_reason)
  const shouldShowAutoReconnectDisabled = Boolean(device.auto_reconnect_disabled_reason)

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
    <div className="surface-card surface-card-hover p-5">
      {/* 設備名稱和狀態 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{getDisplayName(device)}</h3>
        <div className="flex items-center gap-2" title={pingTooltipText}>
          <span className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
          <span className="text-sm text-foreground/70">{getStatusText(device.status)}</span>
        </div>
      </div>

      {/* 設備信息 */}
      <div className="mb-4 space-y-2 text-sm">
        {shouldShowAutoReconnectDisabled && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
            {disabledReasonText || '自動重連已停用'}
            {device.auto_reconnect_last_error ? (
              <span
                className="ml-2 text-foreground/70"
                title={device.auto_reconnect_last_error}
              >
                （詳情）
              </span>
            ) : null}
          </div>
        )}
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
          </>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-2">
        {!isOnline && !isConnecting && onConnect && (
          <Button
            onClick={() => onConnect(device.device_id)}
            className="ui-btn-xs ui-btn-primary"
            loading={connectLoading}
            disabled={connectLoading}
          >
            連接
          </Button>
        )}
        {isOnline && onDisconnect && (
          <Button
            onClick={() => onDisconnect(device.device_id)}
            className="ui-btn-xs ui-btn-danger"
            loading={disconnectLoading}
            disabled={disconnectLoading}
          >
            斷開
          </Button>
        )}
        {isOnline && onPing && (
          <Button
            onClick={() => onPing(device.device_id)}
            className="ui-btn-xs ui-btn-success"
            loading={pingLoading}
            disabled={pingLoading}
          >
            Ping
          </Button>
        )}
        {isOnline && onMonitor && (
          <Button
            onClick={() => onMonitor(device.device_id)}
            disabled={!scrcpyInstalled || monitorLoading}
            loading={monitorLoading}
            className={`ui-btn ui-btn-xs ${
              scrcpyInstalled
                ? 'ui-btn-accent'
                : 'bg-muted/50 text-foreground/50 cursor-not-allowed'
            }`}
            title={scrcpyInstalled ? '啟動螢幕監看' : 'Scrcpy 未安裝'}
          >
            監看
          </Button>
        )}
        {onEdit && (
          <Button
            onClick={() => onEdit(device.device_id)}
            className="ui-btn-xs ui-btn-muted"
          >
            編輯
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={() => onDelete(device.device_id)}
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
