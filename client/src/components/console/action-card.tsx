import { ACTION_TYPES, type Action } from "@/services/api-types"
import Button from "@/components/button"

interface ActionCardProps {
  action: Action
  onEdit?: (actionId: string) => void
  onDelete?: (actionId: string) => void
  onExecute?: (actionId: string) => void
  executeLoading?: boolean
  deleteLoading?: boolean
}

export default function ActionCard({
  action,
  onEdit,
  onDelete,
  onExecute,
  executeLoading,
  deleteLoading,
}: ActionCardProps) {
  const getActionTypeText = (type: string) => {
    switch (type) {
      case ACTION_TYPES.WAKE_UP:
        return "喚醒"
      case ACTION_TYPES.SLEEP:
        return "休眠"
      case ACTION_TYPES.LAUNCH_APP:
        return "啟動應用"
      case ACTION_TYPES.STOP_APP:
        return "停止應用"
      case ACTION_TYPES.RESTART_APP:
        return "重啟應用"
      case ACTION_TYPES.KEEP_AWAKE:
        return "保持喚醒"
      case ACTION_TYPES.SEND_KEY:
        return "發送按鍵"
      case ACTION_TYPES.INSTALL_APK:
        return "安裝 APK"
      default:
        return type
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case ACTION_TYPES.WAKE_UP:
        return "☀️"
      case ACTION_TYPES.SLEEP:
        return "🌙"
      case ACTION_TYPES.LAUNCH_APP:
        return "🚀"
      case ACTION_TYPES.STOP_APP:
        return "⏹️"
      case ACTION_TYPES.RESTART_APP:
        return "🔄"
      case ACTION_TYPES.KEEP_AWAKE:
        return "⏰"
      case ACTION_TYPES.SEND_KEY:
        return "⌨️"
      case ACTION_TYPES.INSTALL_APK:
        return "📦"
      default:
        return "⚡"
    }
  }

  const successRate =
    action.success_count + action.failure_count > 0
      ? ((action.success_count / (action.success_count + action.failure_count)) * 100).toFixed(1)
      : 0

  return (
    <div className="surface-card surface-card-hover p-5">
      {/* 動作名稱和圖標 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getActionIcon(action.action_type)}</span>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{action.name}</h3>
            <p className="text-xs text-foreground/50">{getActionTypeText(action.action_type)}</p>
          </div>
        </div>
      </div>

      {/* 動作描述 */}
      {action.description && (
        <p className="mb-3 text-sm text-foreground/70">{action.description}</p>
      )}

      {/* 執行統計 */}
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-foreground/70">成功次數:</span>
          <span className="font-semibold text-success">{action.success_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground/70">失敗次數:</span>
          <span className="font-semibold text-danger">{action.failure_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground/70">成功率:</span>
          <span className="font-semibold text-foreground">{successRate}%</span>
        </div>
        {action.last_executed_at && (
          <div className="flex justify-between">
            <span className="text-foreground/70">最後執行:</span>
            <span className="text-xs text-foreground">
              {new Date(action.last_executed_at).toLocaleString("zh-TW")}
            </span>
          </div>
        )}
      </div>

      {/* 參數預覽 */}
      {Object.keys(action.params).length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-foreground">參數:</p>
          <div className="surface-panel max-h-20 overflow-y-auto p-2 font-mono text-xs text-foreground/70">
            {JSON.stringify(action.params, null, 2)}
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-2">
        {onExecute && (
          <Button
            onClick={() => onExecute(action.action_id)}
            className="ui-btn-xs ui-btn-primary"
            loading={executeLoading}
            disabled={executeLoading}
          >
            執行
          </Button>
        )}
        {onEdit && (
          <Button onClick={() => onEdit(action.action_id)} className="ui-btn-xs ui-btn-muted">
            編輯
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={() => onDelete(action.action_id)}
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
