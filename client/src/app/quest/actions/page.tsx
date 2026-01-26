import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { actionApi, deviceApi } from '@/services/quest-api'
import { QUEST_ACTION_TYPES, type QuestAction, QuestDevice } from '@/services/quest-types'
import { getDisplayName } from '@/lib/utils/device'
import QuestPageShell from '@/components/quest/quest-page-shell'

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

export default function ActionsPage() {
  const navigate = useNavigate()
  const [actions, setActions] = useState<QuestAction[]>([])
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const [showExecuteModal, setShowExecuteModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState<QuestAction | null>(null)
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])

  const loadData = async () => {
    try {
      const [actionsData, devicesData] = await Promise.all([
        actionApi.getAll(),
        deviceApi.getAll(),
      ])
      setActions(actionsData)
      setDevices(devicesData)
    } catch (error) {
      console.error('Failed to load actions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          loadData()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  const handleExecute = (actionId: string) => {
    const action = actions.find((a) => a.action_id === actionId)
    if (action) {
      setSelectedAction(action)
      setShowExecuteModal(true)
    }
  }

  const handleConfirmExecute = async () => {
    if (!selectedAction || selectedDevices.length === 0) return

    try {
      const result = await actionApi.executeBatch({
        action_id: selectedAction.action_id,
        device_ids: selectedDevices,
        max_workers: 5,
      })

      alert(
        `批量執行完成\n成功: ${result.success_count}\n失敗: ${result.failed_count}`,
      )

      setShowExecuteModal(false)
      setSelectedAction(null)
      setSelectedDevices([])
      await loadData()
    } catch (error) {
      console.error('Failed to execute action:', error)
      alert('執行失敗')
    }
  }

  const handleDelete = async (actionId: string) => {
    if (!confirm('確定要刪除這個動作嗎？')) return

    try {
      await actionApi.delete(actionId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete action:', error)
      alert('刪除失敗')
    }
  }

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId],
    )
  }

  const selectAllDevices = () => {
    const onlineDevices = devices.filter((d) => d.status === 'online')
    setSelectedDevices(onlineDevices.map((d) => d.device_id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground">加載中...</div>
      </div>
    )
  }

  return (
    <QuestPageShell
      title="動作管理"
      subtitle={`下次更新: ${countdown} 秒`}
      actions={
        <button
          onClick={() => navigate('/quest/actions/new')}
          className="ui-btn ui-btn-md ui-btn-primary"
        >
          + 創建動作
        </button>
      }
    >
      {actions.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <div className="text-5xl">⚡</div>
          <div className="mt-4 text-lg font-semibold text-foreground">還沒有動作</div>
          <div className="mt-2 text-sm text-foreground/70">點擊上方按鈕創建您的第一個動作</div>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
            <div className="col-span-5">動作</div>
            <div className="col-span-3">統計</div>
            <div className="col-span-2">最後執行</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
          {actions.map((action) => {
            const total = action.success_count + action.failure_count
            const successRate = total > 0 ? ((action.success_count / total) * 100).toFixed(1) : '0'

            return (
              <div
                key={action.action_id}
                className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface/40 last:border-b-0"
              >
                <div className="col-span-5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getActionIcon(action.action_type)}</span>
                    <div>
                      <div className="font-semibold text-foreground">{action.name}</div>
                      <div className="text-xs text-foreground/50">
                        {getActionTypeText(action.action_type)}
                      </div>
                    </div>
                  </div>
                  {action.description ? (
                    <div className="mt-1 text-xs text-foreground/70">{action.description}</div>
                  ) : null}
                </div>
                <div className="col-span-3 text-xs text-foreground/70">
                  <div className="flex flex-wrap gap-2">
                    <span className="ui-badge ui-badge-success">成功 {action.success_count}</span>
                    <span className="ui-badge ui-badge-danger">失敗 {action.failure_count}</span>
                    <span className="ui-badge ui-badge-muted">成功率 {successRate}%</span>
                  </div>
                </div>
                <div className="col-span-2 text-xs text-foreground/60">
                  {action.last_executed_at
                    ? new Date(action.last_executed_at).toLocaleString('zh-TW')
                    : '—'}
                </div>
                <div className="col-span-2 flex flex-wrap items-start justify-end gap-2">
                  <button
                    onClick={() => handleExecute(action.action_id)}
                    className="ui-btn ui-btn-xs ui-btn-primary"
                  >
                    執行
                  </button>
                  <button
                    onClick={() => navigate(`/quest/actions/${action.action_id}`)}
                    className="ui-btn ui-btn-xs ui-btn-muted"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(action.action_id)}
                    className="ui-btn ui-btn-xs ui-btn-danger"
                  >
                    刪除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 執行動作模態框 */}
      {showExecuteModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="surface-card w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 mx-4">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              執行動作: {selectedAction.name}
            </h2>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">
                  選擇要執行的設備 ({selectedDevices.length} 個已選)
                </p>
                <button
                  onClick={selectAllDevices}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  全選在線設備
                </button>
              </div>

              <div className="surface-panel space-y-2 max-h-60 overflow-y-auto p-2">
                {devices.map((device) => (
                  <label
                    key={device.device_id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-surface ${
                      device.status !== 'online' ? 'opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDevices.includes(device.device_id)}
                      onChange={() => toggleDeviceSelection(device.device_id)}
                      disabled={device.status !== 'online'}
                      className="w-4 h-4"
                    />
                    <span className="flex-1 text-sm text-foreground">
                      {getDisplayName(device)} ({device.ip})
                    </span>
                    <span
                      className={`ui-badge ${
                        device.status === 'online' ? 'ui-badge-success' : 'ui-badge-muted'
                      }`}
                    >
                      {device.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExecuteModal(false)
                  setSelectedAction(null)
                  setSelectedDevices([])
                }}
                className="ui-btn ui-btn-md ui-btn-muted"
              >
                取消
              </button>
              <button
                onClick={handleConfirmExecute}
                disabled={selectedDevices.length === 0}
                className="ui-btn ui-btn-md ui-btn-primary"
              >
                執行 ({selectedDevices.length} 個設備)
              </button>
            </div>
          </div>
        </div>
      )}
    </QuestPageShell>
  )
}
