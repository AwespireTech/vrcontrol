import { useEffect, useMemo, useState } from "react"
import { deviceApi, monitoringApi } from "@/services/quest-api"
import { QUEST_DEVICE_STATUS, type QuestDevice } from "@/services/quest-types"
import { getDisplayName } from "@/lib/utils/device"
import { useMonitoringStatus } from "@/hooks/useMonitoringStatus"
import QuestPageShell from "@/components/quest/quest-page-shell"
import Button from "@/components/button"

type StatusFilter = "all" | QuestDevice["status"]
type AutoReconnectFilter = "all" | "enabled" | "disabled"

function getStatusText(status: string) {
  switch (status) {
    case QUEST_DEVICE_STATUS.ONLINE:
      return "在線"
    case QUEST_DEVICE_STATUS.OFFLINE:
      return "離線"
    case QUEST_DEVICE_STATUS.CONNECTING:
      return "連線中"
    case QUEST_DEVICE_STATUS.ERROR:
      return "錯誤"
    case QUEST_DEVICE_STATUS.DISCONNECTED:
      return "手動斷開"
    default:
      return "未知"
  }
}

function getReasonText(reason?: QuestDevice["auto_reconnect_disabled_reason"]) {
  switch (reason) {
    case "manual_disconnect":
      return "手動斷開"
    case "max_retries_exhausted":
      return "重試達上限"
    case "adb_not_found":
      return "找不到 ADB"
    case "adb_connect_failed":
      return "ADB 連線失敗"
    case "unknown":
      return "未知原因"
    default:
      return ""
  }
}

function getWsStatusText(status?: QuestDevice["ws_status"]) {
  if (status === "connected") return "已連線"
  if (status === "disconnected") return "未連線"
  return "未知"
}

function getWsStatusBadge(status?: QuestDevice["ws_status"]) {
  if (status === "connected") return "ui-badge-success"
  if (status === "disconnected") return "ui-badge-muted"
  return "ui-badge-muted"
}

export default function QuestMonitoringPage() {
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const monitoring = useMonitoringStatus()

  const [batchResult, setBatchResult] = useState<{
    title: string
    total: number
    success_count: number
    failed_count: number
    failed: Record<string, string>
  } | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [autoReconnectFilter, setAutoReconnectFilter] = useState<AutoReconnectFilter>("all")
  const [batchPending, setBatchPending] = useState<
    null | "enable" | "disable" | "reset" | "refresh"
  >(null)
  const [rowPending, setRowPending] = useState<Record<string, "toggle" | "reset">>({})
  const [monitoringPending, setMonitoringPending] = useState<null | "runOnce" | "toggle">(null)

  const load = async () => {
    try {
      const [devicesData] = await Promise.all([deviceApi.getAll()])
      setDevices(devicesData)
    } catch (error) {
      console.error("Failed to load monitoring data:", error)
      alert("載入監控資料失敗，請稍後再試")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return devices.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false
      if (autoReconnectFilter === "enabled" && !d.auto_reconnect_enabled) return false
      if (autoReconnectFilter === "disabled" && d.auto_reconnect_enabled) return false

      if (!q) return true
      const hay =
        `${getDisplayName(d)} ${d.alias ?? ""} ${d.name ?? ""} ${d.ip ?? ""} ${d.device_id}`.toLowerCase()
      return hay.includes(q)
    })
  }, [devices, search, statusFilter, autoReconnectFilter])

  const filteredIds = useMemo(() => filteredDevices.map((d) => d.device_id), [filteredDevices])

  const toggleMonitoring = async () => {
    if (monitoringPending) return
    setMonitoringPending("toggle")
    try {
      if (!monitoring.known) {
        await monitoring.refresh()
        return
      }

      if (monitoring.running) {
        await monitoringApi.stop()
      } else {
        await monitoringApi.start()
      }
      await monitoring.refresh()
    } catch (error) {
      console.error("Failed to toggle monitoring:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setMonitoringPending(null)
    }
  }

  const runOnce = async () => {
    if (monitoringPending) return
    setMonitoringPending("runOnce")
    try {
      await monitoringApi.runOnce()
      await load()
    } catch (error) {
      console.error("Failed to run monitoring once:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setMonitoringPending(null)
    }
  }

  const setAutoReconnectBatch = async (enabled: boolean) => {
    if (filteredIds.length === 0) return
    if (batchPending) return
    setBatchPending(enabled ? "enable" : "disable")
    try {
      const result = await deviceApi.setAutoReconnectEnabledBatch(filteredIds, enabled)
      setBatchResult({
        title: enabled ? "批次啟用自動重連" : "批次停用自動重連",
        ...result,
      })
      await load()
    } catch (error) {
      console.error("Failed to set auto reconnect batch:", error)
      alert("批次操作失敗，請稍後再試")
    } finally {
      setBatchPending(null)
    }
  }

  const resetBatch = async () => {
    if (filteredIds.length === 0) return
    if (batchPending) return
    setBatchPending("reset")
    try {
      const result = await deviceApi.resetAutoReconnectBatch(filteredIds)
      setBatchResult({
        title: "批次重置自動重連狀態",
        ...result,
      })
      await load()
    } catch (error) {
      console.error("Failed to reset auto reconnect batch:", error)
      alert("批次重置失敗，請稍後再試")
    } finally {
      setBatchPending(null)
    }
  }

  const setAutoReconnectOne = async (deviceId: string, enabled: boolean) => {
    if (rowPending[deviceId]) return
    setRowPending((prev) => ({ ...prev, [deviceId]: "toggle" }))
    try {
      await deviceApi.patch(deviceId, { auto_reconnect_enabled: enabled })
      await load()
    } catch (error) {
      console.error("Failed to set auto reconnect:", error)
      alert("更新失敗，請稍後再試")
    } finally {
      setRowPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const resetOne = async (deviceId: string) => {
    if (rowPending[deviceId]) return
    setRowPending((prev) => ({ ...prev, [deviceId]: "reset" }))
    try {
      await deviceApi.resetAutoReconnect(deviceId)
      await load()
    } catch (error) {
      console.error("Failed to reset auto reconnect:", error)
      alert("重置失敗，請稍後再試")
    } finally {
      setRowPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleRefresh = async () => {
    if (batchPending) return
    setBatchPending("refresh")
    try {
      await load()
    } finally {
      setBatchPending(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-xl text-foreground">載入中…</div>
      </div>
    )
  }

  return (
    <QuestPageShell
      title="監控中心"
      subtitle="篩選設備，批次設定自動重連與重置狀態"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runOnce}
            className="ui-btn-md ui-btn-accent"
            loading={monitoringPending === "runOnce"}
          >
            手動執行一次
          </Button>
          <Button
            onClick={toggleMonitoring}
            disabled={!monitoring.known || monitoring.loading}
            loading={monitoringPending === "toggle"}
            className={`ui-btn-md transition-colors ${
              !monitoring.known
                ? "ui-btn-muted"
                : monitoring.running
                  ? "ui-btn-danger"
                  : "ui-btn-success"
            }`}
          >
            {!monitoring.known ? "狀態未知" : monitoring.running ? "停止監控" : "啟動監控"}
          </Button>
        </div>
      }
    >
      <div className="surface-card mb-6 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋：名稱 / IP / ID"
            className="ui-input w-full px-4 py-2"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="ui-select w-full px-4 py-2"
          >
            <option value="all">狀態：全部</option>
            <option value={QUEST_DEVICE_STATUS.ONLINE}>狀態：在線</option>
            <option value={QUEST_DEVICE_STATUS.OFFLINE}>狀態：離線</option>
            <option value={QUEST_DEVICE_STATUS.ERROR}>狀態：錯誤</option>
            <option value={QUEST_DEVICE_STATUS.DISCONNECTED}>狀態：手動斷開</option>
            <option value={QUEST_DEVICE_STATUS.CONNECTING}>狀態：連線中</option>
          </select>

          <select
            value={autoReconnectFilter}
            onChange={(e) => setAutoReconnectFilter(e.target.value as AutoReconnectFilter)}
            className="ui-select w-full px-4 py-2"
          >
            <option value="all">自動重連：全部</option>
            <option value="enabled">自動重連：已啟用</option>
            <option value="disabled">自動重連：已停用</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="text-sm text-foreground/70">
            將套用於目前篩選的{" "}
            <span className="font-semibold text-foreground">{filteredIds.length}</span> 台
          </div>
          <Button
            onClick={() => setAutoReconnectBatch(true)}
            disabled={filteredIds.length === 0 || batchPending !== null}
            loading={batchPending === "enable"}
            className="ui-btn-md ui-btn-success"
          >
            全選（啟用重連）
          </Button>
          <Button
            onClick={() => setAutoReconnectBatch(false)}
            disabled={filteredIds.length === 0 || batchPending !== null}
            loading={batchPending === "disable"}
            className="ui-btn-md ui-btn-muted"
          >
            不選（停用重連）
          </Button>
          <Button
            onClick={resetBatch}
            disabled={filteredIds.length === 0 || batchPending !== null}
            loading={batchPending === "reset"}
            className="ui-btn-md ui-btn-primary"
          >
            批次重置
          </Button>
          <Button
            onClick={handleRefresh}
            className="ui-btn-md ui-btn-muted ml-auto"
            loading={batchPending === "refresh"}
          >
            重新整理
          </Button>
        </div>
      </div>

      {batchResult ? (
        <div className="surface-card mb-6 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-foreground">{batchResult.title}</div>
              <div className="text-sm text-foreground/70">
                total: {batchResult.total} / success: {batchResult.success_count} / failed:{" "}
                {batchResult.failed_count}
              </div>
            </div>
            <button onClick={() => setBatchResult(null)} className="ui-btn ui-btn-xs ui-btn-muted">
              清除
            </button>
          </div>
          {batchResult.failed_count > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-warning">
                查看失敗清單（{batchResult.failed_count}）
              </summary>
              <div className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Object.entries(batchResult.failed).map(([id, reason]) => (
                    <div key={id} className="text-xs text-foreground/80">
                      <span className="font-mono">{id}</span>
                      <span className="text-foreground/60">: </span>
                      <span title={reason}>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="surface-card overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
          <div className="col-span-3">設備</div>
          <div className="col-span-2">ADB</div>
          <div className="col-span-2">WS</div>
          <div className="col-span-2">自動重連</div>
          <div className="col-span-2">原因 / 詳情</div>
          <div className="col-span-1 text-right">操作</div>
        </div>

        {filteredDevices.length === 0 ? (
          <div className="p-6 text-foreground/70">沒有符合條件的設備</div>
        ) : (
          filteredDevices.map((d) => {
            const reason = getReasonText(d.auto_reconnect_disabled_reason)
            const lastError = d.auto_reconnect_last_error || ""
            return (
              <div
                key={d.device_id}
                className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface/40"
              >
                <div className="col-span-3">
                  <div className="font-semibold text-foreground">{getDisplayName(d)}</div>
                  <div className="font-mono text-xs text-foreground/60">
                    {d.ip}:{d.port}
                  </div>
                  <div className="font-mono text-xs text-foreground/50">{d.device_id}</div>
                </div>

                <div className="col-span-2">
                  <span
                    className={`ui-badge ${
                      d.status === QUEST_DEVICE_STATUS.ONLINE
                        ? "ui-badge-success"
                        : d.status === QUEST_DEVICE_STATUS.ERROR
                          ? "ui-badge-danger"
                          : d.status === QUEST_DEVICE_STATUS.CONNECTING
                            ? "ui-badge-warning"
                            : "ui-badge-muted"
                    }`}
                  >
                    {getStatusText(d.status)}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className={`ui-badge ${getWsStatusBadge(d.ws_status)}`}>
                    {getWsStatusText(d.ws_status)}
                  </span>
                </div>

                <div className="col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      checked={Boolean(d.auto_reconnect_enabled)}
                      onChange={(e) => setAutoReconnectOne(d.device_id, e.target.checked)}
                      disabled={!!rowPending[d.device_id]}
                    />
                    {d.auto_reconnect_enabled ? "啟用" : "停用"}
                  </label>
                </div>

                <div className="col-span-2 text-xs text-foreground/70">
                  {reason ? (
                    <div className="text-warning">{reason}</div>
                  ) : (
                    <div className="text-foreground/40">-</div>
                  )}
                  {lastError ? (
                    <div className="truncate" title={lastError}>
                      {lastError}
                    </div>
                  ) : null}
                </div>

                <div className="col-span-1 flex justify-end">
                  <Button
                    onClick={() => resetOne(d.device_id)}
                    className="ui-btn-xs ui-btn-accent"
                    title="依規則重置自動重連狀態"
                    loading={rowPending[d.device_id] === "reset"}
                    disabled={!!rowPending[d.device_id]}
                  >
                    重置
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </QuestPageShell>
  )
}
