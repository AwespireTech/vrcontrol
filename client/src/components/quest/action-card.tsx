import { type QuestAction, QUEST_ACTION_TYPES } from '@/services/quest-types'

interface ActionCardProps {
  action: QuestAction
  onEdit?: (actionId: string) => void
  onDelete?: (actionId: string) => void
  onExecute?: (actionId: string) => void
}

export default function ActionCard({ action, onEdit, onDelete, onExecute }: ActionCardProps) {
  const getActionTypeText = (type: string) => {
    switch (type) {
      case QUEST_ACTION_TYPES.WAKE_UP:
        return '喚醒'
      case QUEST_ACTION_TYPES.SLEEP:
        return '休眠'
      case QUEST_ACTION_TYPES.LAUNCH_APP:
        return '啟動應用'
      case QUEST_ACTION_TYPES.STOP_APP:
        return '停止應用'
      case QUEST_ACTION_TYPES.RESTART_APP:
        return '重啟應用'
      case QUEST_ACTION_TYPES.KEEP_AWAKE:
        return '保持喚醒'
      case QUEST_ACTION_TYPES.SEND_KEY:
        return '發送按鍵'
      case QUEST_ACTION_TYPES.INSTALL_APK:
        return '安裝 APK'
      default:
        return type
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case QUEST_ACTION_TYPES.WAKE_UP:
        return '☀️'
      case QUEST_ACTION_TYPES.SLEEP:
        return '🌙'
      case QUEST_ACTION_TYPES.LAUNCH_APP:
        return '🚀'
      case QUEST_ACTION_TYPES.STOP_APP:
        return '⏹️'
      case QUEST_ACTION_TYPES.RESTART_APP:
        return '🔄'
      case QUEST_ACTION_TYPES.KEEP_AWAKE:
        return '⏰'
      case QUEST_ACTION_TYPES.SEND_KEY:
        return '⌨️'
      case QUEST_ACTION_TYPES.INSTALL_APK:
        return '📦'
      default:
        return '⚡'
    }
  }

  const successRate =
    action.success_count + action.failed_count > 0
      ? ((action.success_count / (action.success_count + action.failed_count)) * 100).toFixed(1)
      : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 動作名稱和圖標 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getActionIcon(action.action_type)}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{action.name}</h3>
            <p className="text-xs text-gray-500">{getActionTypeText(action.action_type)}</p>
          </div>
        </div>
      </div>

      {/* 動作描述 */}
      {action.description && (
        <p className="text-sm text-gray-600 mb-3">{action.description}</p>
      )}

      {/* 執行統計 */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">成功次數:</span>
          <span className="font-semibold text-green-600">{action.success_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">失敗次數:</span>
          <span className="font-semibold text-red-600">{action.failed_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">成功率:</span>
          <span className="font-semibold text-gray-900">{successRate}%</span>
        </div>
        {action.last_executed_at && (
          <div className="flex justify-between">
            <span className="text-gray-600">最後執行:</span>
            <span className="text-xs text-gray-900">
              {new Date(action.last_executed_at).toLocaleString('zh-TW')}
            </span>
          </div>
        )}
      </div>

      {/* 參數預覽 */}
      {Object.keys(action.parameters).length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">參數:</p>
          <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-700 max-h-20 overflow-y-auto">
            {JSON.stringify(action.parameters, null, 2)}
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex gap-2 flex-wrap">
        {onExecute && (
          <button
            onClick={() => onExecute(action.action_id)}
            className="px-3 py-1 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
          >
            執行
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(action.action_id)}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            編輯
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(action.action_id)}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            刪除
          </button>
        )}
      </div>
    </div>
  )
}
