import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { actionApi, deviceApi } from "@/services/api"
import { ACTION_TYPES, type Action, Device } from "@/services/api-types"
import { getDisplayName } from "@/lib/utils/device"
import PageShell from "@/components/console/page-shell"
import Button from "@/components/button"
import DeviceSelectionModal from "@/components/console/device-selection-modal"

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

export default function ActionsPage() {
  const navigate = useNavigate()
  const [actions, setActions] = useState<Action[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const [showExecuteModal, setShowExecuteModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])
  const [actionPending, setActionPending] = useState<Record<string, "delete">>({})
  const [executePending, setExecutePending] = useState(false)

  const loadData = async () => {
    try {
      const [actionsData, devicesData] = await Promise.all([actionApi.getAll(), deviceApi.getAll()])
      setActions(actionsData)
      setDevices(devicesData)
    } catch (error) {
      console.error("Failed to load actions:", error)
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
    if (executePending) return
    setExecutePending(true)
    try {
      const result = await actionApi.executeBatch({
        action_id: selectedAction.action_id,
        device_ids: selectedDevices,
        max_workers: 5,
      })

      alert(`批次執行完成\n成功: ${result.success_count}\n失敗: ${result.failed_count}`)

      setShowExecuteModal(false)
      setSelectedAction(null)
      setSelectedDevices([])
      await loadData()
    } catch (error) {
      console.error("Failed to execute action:", error)
      alert("執行失敗，請稍後再試")
    } finally {
      setExecutePending(false)
    }
  }

  const handleDelete = async (actionId: string) => {
    if (!confirm("確定要刪除這個動作嗎？")) return
    if (actionPending[actionId]) return
    setActionPending((prev) => ({ ...prev, [actionId]: "delete" }))
    try {
      await actionApi.delete(actionId)
      await loadData()
    } catch (error) {
      console.error("Failed to delete action:", error)
      alert("刪除失敗，請稍後再試")
    } finally {
      setActionPending((prev) => {
        const next = { ...prev }
        delete next[actionId]
        return next
      })
    }
  }

  const executeTargets = devices.map((device) => ({
    id: device.device_id,
    label: `${getDisplayName(device)}`,
    ip: device.ip,
    status: device.status,
    isOnline: device.status === "online",
  }))

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-xl text-foreground">載入中…</div>
      </div>
    )
  }

  return (
    <PageShell
      title="動作管理"
      subtitle={`下次更新 ${countdown} 秒`}
      actions={
        <button
          onClick={() => navigate("/actions/new")}
          className="ui-btn ui-btn-md ui-btn-primary"
        >
          + 建立動作
        </button>
      }
    >
      {actions.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <div className="text-5xl">⚡</div>
          <div className="mt-4 text-lg font-semibold text-foreground">尚無動作</div>
          <div className="mt-2 text-sm text-foreground/70">點擊上方按鈕建立第一個動作</div>
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
            const successRate = total > 0 ? ((action.success_count / total) * 100).toFixed(1) : "0"

            return (
              <div
                key={action.action_id}
                className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface/40"
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
                    ? new Date(action.last_executed_at).toLocaleString("zh-TW")
                    : "—"}
                </div>
                <div className="col-span-2 flex flex-wrap items-start justify-end gap-2">
                  <Button
                    onClick={() => handleExecute(action.action_id)}
                    className="ui-btn-xs ui-btn-primary"
                  >
                    執行
                  </Button>
                  <button
                    onClick={() => navigate(`/actions/${action.action_id}`)}
                    className="ui-btn ui-btn-xs ui-btn-muted"
                  >
                    編輯
                  </button>
                  <Button
                    onClick={() => handleDelete(action.action_id)}
                    className="ui-btn-xs ui-btn-danger"
                    loading={actionPending[action.action_id] === "delete"}
                    disabled={!!actionPending[action.action_id]}
                  >
                    刪除
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DeviceSelectionModal
        open={showExecuteModal && !!selectedAction}
        title={`執行動作: ${selectedAction?.name || ""}`}
        confirmText="執行"
        targets={executeTargets}
        selectedIds={selectedDevices}
        onSelectedIdsChange={setSelectedDevices}
        confirmPending={executePending}
        onConfirm={handleConfirmExecute}
        onClose={() => {
          setShowExecuteModal(false)
          setSelectedAction(null)
          setSelectedDevices([])
        }}
      />
    </PageShell>
  )
}
