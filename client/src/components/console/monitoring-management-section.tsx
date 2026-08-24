import { useEffect, useMemo, useState } from "react"
import Button from "@/components/button"
import { useMonitoringStatus } from "@/hooks/useMonitoringStatus"
import { useDeviceConnectionStatuses } from "@/hooks/useDeviceConnectionStatuses"
import { getDisplayName, mergeDeviceConnectionStatus } from "@/lib/utils/device"
import { deviceApi, monitoringApi } from "@/services/api"
import { DEVICE_STATUS, type Device } from "@/services/api-types"

type StatusFilter = "all" | Device["status"]
type AutoReconnectFilter = "all" | "enabled" | "disabled"

type BatchResult = {
  title: string
  total: number
  success_count: number
  failed_count: number
  failed: Record<string, string>
}

function getStatusText(status: string) {
  switch (status) {
    case DEVICE_STATUS.ONLINE:
      return "在線"
    case DEVICE_STATUS.OFFLINE:
      return "離線"
    case DEVICE_STATUS.CONNECTING:
      return "連線中"
    case DEVICE_STATUS.ERROR:
      return "錯誤"
    case DEVICE_STATUS.DISCONNECTED:
      return "手動斷開"
    default:
      return "未知"
  }
}

function getReasonText(reason?: Device["auto_reconnect_disabled_reason"]) {
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

function getWsStatusText(status?: Device["ws_status"]) {
  if (status === "connected") return "已連線"
  if (status === "disconnected") return "未連線"
  return "未知"
}

function getWsStatusBadge(status?: Device["ws_status"]) {
  if (status === "connected") return "ui-badge-success"
  if (status === "disconnected") return "ui-badge-muted"
  return "ui-badge-muted"
}

export default function MonitoringManagementSection() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const monitoring = useMonitoringStatus()
  const connectionStatuses = useDeviceConnectionStatuses()

  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [autoReconnectFilter, setAutoReconnectFilter] = useState<AutoReconnectFilter>("all")
  const [batchPending, setBatchPending] = useState<
    null | "enable" | "disable" | "reset" | "refresh"
  >(null)
  const [rowPending, setRowPending] = useState<Record<string, "toggle" | "reset">>({})
  const [monitoringPending, setMonitoringPending] = useState<null | "runOnce">(null)

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
    void load()
  }, [])

  const currentDevices = useMemo(
    () =>
      devices.map((device) =>
        mergeDeviceConnectionStatus(device, connectionStatuses.statuses[device.device_id]),
      ),
    [connectionStatuses.statuses, devices],
  )

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase()
    return currentDevices.filter((device) => {
      if (statusFilter !== "all" && device.status !== statusFilter) return false
      if (autoReconnectFilter === "enabled" && !device.auto_reconnect_enabled) return false
      if (autoReconnectFilter === "disabled" && device.auto_reconnect_enabled) return false

      if (!query) return true

      const haystack =
        `${getDisplayName(device)} ${device.alias ?? ""} ${device.name ?? ""} ${device.ip ?? ""} ${device.device_id}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [currentDevices, search, statusFilter, autoReconnectFilter])

  const filteredIds = useMemo(
    () => filteredDevices.map((device) => device.device_id),
    [filteredDevices],
  )

  const runOnce = async () => {
    if (monitoringPending) return
    setMonitoringPending("runOnce")
    try {
      await monitoringApi.runOnce()
      await Promise.all([load(), connectionStatuses.refresh(), monitoring.refresh()])
    } catch (error) {
      console.error("Failed to run monitoring once:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setMonitoringPending(null)
    }
  }

  const setAutoReconnectBatch = async (enabled: boolean) => {
    if (filteredIds.length === 0 || batchPending) return

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
    if (filteredIds.length === 0 || batchPending) return

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

  return (
    <section className="surface-card p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-foreground text-xl font-bold">Monitoring</h2>
          <p className="text-foreground/70 mt-2 text-sm">
            ADB 連線觀測固定常駐；可篩選設備並批次調整自動重連狀態。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runOnce}
            className="ui-btn-md ui-btn-accent"
            loading={monitoringPending === "runOnce"}
          >
            手動執行一次
          </Button>
          <span
            className={`ui-badge ${monitoring.running ? "ui-badge-success" : "ui-badge-danger"}`}
          >
            {monitoring.known
              ? monitoring.running
                ? `常駐中 · ${monitoring.intervalSeconds || 5} 秒`
                : "服務異常"
              : "狀態未知"}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="surface-panel p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜尋：名稱 / IP / ID"
              className="ui-input w-full px-4 py-2"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="ui-select w-full px-4 py-2"
            >
              <option value="all">狀態：全部</option>
              <option value={DEVICE_STATUS.ONLINE}>狀態：在線</option>
              <option value={DEVICE_STATUS.OFFLINE}>狀態：離線</option>
              <option value={DEVICE_STATUS.ERROR}>狀態：錯誤</option>
              <option value={DEVICE_STATUS.DISCONNECTED}>狀態：手動斷開</option>
              <option value={DEVICE_STATUS.CONNECTING}>狀態：連線中</option>
            </select>

            <select
              value={autoReconnectFilter}
              onChange={(event) =>
                setAutoReconnectFilter(event.target.value as AutoReconnectFilter)
              }
              className="ui-select w-full px-4 py-2"
            >
              <option value="all">自動重連：全部</option>
              <option value="enabled">自動重連：已啟用</option>
              <option value="disabled">自動重連：已停用</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="text-foreground/70 text-sm">
              將套用於目前篩選的{" "}
              <span className="text-foreground font-semibold">{filteredIds.length}</span> 台
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
          <div className="surface-panel p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-foreground font-semibold">{batchResult.title}</div>
                <div className="text-foreground/70 text-sm">
                  total: {batchResult.total} / success: {batchResult.success_count} / failed:{" "}
                  {batchResult.failed_count}
                </div>
              </div>
              <button
                onClick={() => setBatchResult(null)}
                className="ui-btn ui-btn-xs ui-btn-muted"
              >
                清除
              </button>
            </div>
            {batchResult.failed_count > 0 ? (
              <details className="mt-3">
                <summary className="text-warning cursor-pointer text-sm">
                  查看失敗清單（{batchResult.failed_count}）
                </summary>
                <div className="border-warning/30 bg-warning/10 mt-2 rounded-[18px] border p-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {Object.entries(batchResult.failed).map(([id, reason]) => (
                      <div key={id} className="text-foreground/80 text-xs">
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

        <div className="surface-panel overflow-hidden">
          {loading ? (
            <div className="text-foreground/70 p-6">載入中…</div>
          ) : (
            <>
              <div className="border-border bg-surface/50 text-foreground/60 grid grid-cols-12 gap-3 border-b px-4 py-3 text-xs">
                <div className="col-span-3">設備</div>
                <div className="col-span-2">ADB</div>
                <div className="col-span-2">WS</div>
                <div className="col-span-2">自動重連</div>
                <div className="col-span-2">原因 / 詳情</div>
                <div className="col-span-1 text-right">操作</div>
              </div>

              {filteredDevices.length === 0 ? (
                <div className="text-foreground/70 p-6">沒有符合條件的設備</div>
              ) : (
                filteredDevices.map((device) => {
                  const reason = getReasonText(device.auto_reconnect_disabled_reason)
                  const lastError = device.auto_reconnect_last_error || ""
                  return (
                    <div
                      key={device.device_id}
                      className="border-border hover:bg-surface/40 grid grid-cols-12 items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0"
                    >
                      <div className="col-span-3">
                        <div className="text-foreground font-semibold">
                          {getDisplayName(device)}
                        </div>
                        <div className="text-foreground/60 font-mono text-xs">
                          {device.ip}:{device.port}
                        </div>
                        <div className="text-foreground/50 font-mono text-xs">
                          {device.device_id}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span
                          className={`ui-badge ${
                            device.status === DEVICE_STATUS.ONLINE
                              ? "ui-badge-success"
                              : device.status === DEVICE_STATUS.ERROR
                                ? "ui-badge-danger"
                                : device.status === DEVICE_STATUS.CONNECTING
                                  ? "ui-badge-warning"
                                  : "ui-badge-muted"
                          }`}
                        >
                          {getStatusText(device.status)}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <span className={`ui-badge ${getWsStatusBadge(device.ws_status)}`}>
                          {getWsStatusText(device.ws_status)}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <label className="text-foreground/80 inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(device.auto_reconnect_enabled)}
                            onChange={(event) =>
                              setAutoReconnectOne(device.device_id, event.target.checked)
                            }
                            disabled={!!rowPending[device.device_id]}
                          />
                          {device.auto_reconnect_enabled ? "啟用" : "停用"}
                        </label>
                      </div>

                      <div className="text-foreground/70 col-span-2 text-xs">
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
                          onClick={() => resetOne(device.device_id)}
                          className="ui-btn-xs ui-btn-accent"
                          title="依規則重置自動重連狀態"
                          loading={rowPending[device.device_id] === "reset"}
                          disabled={!!rowPending[device.device_id]}
                        >
                          重置
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
