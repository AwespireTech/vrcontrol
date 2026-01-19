import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deviceApi, monitoringApi } from '@/services/quest-api'
import { QUEST_DEVICE_STATUS, type QuestDevice } from '@/services/quest-types'
import { getDisplayName } from '@/lib/utils/device'

type StatusFilter = 'all' | QuestDevice['status']
type AutoReconnectFilter = 'all' | 'enabled' | 'disabled'

function getStatusText(status: string) {
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

function getReasonText(reason?: QuestDevice['auto_reconnect_disabled_reason']) {
  switch (reason) {
    case 'manual_disconnect':
      return '手動斷開'
    case 'max_retries_exhausted':
      return '重試達上限'
    case 'adb_not_found':
      return '找不到 ADB'
    case 'adb_connect_failed':
      return 'ADB 連線失敗'
    case 'unknown':
      return '未知原因'
    default:
      return ''
  }
}

export default function QuestMonitoringPage() {
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [monitoringRunning, setMonitoringRunning] = useState(false)

  const [batchResult, setBatchResult] = useState<{
    title: string
    total: number
    success_count: number
    failed_count: number
    failed: Record<string, string>
  } | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [autoReconnectFilter, setAutoReconnectFilter] = useState<AutoReconnectFilter>('all')

  const load = async () => {
    try {
      const [devicesData, status] = await Promise.all([deviceApi.getAll(), monitoringApi.getStatus()])
      setDevices(devicesData)
      setMonitoringRunning(status.running)
    } catch (error) {
      console.error('Failed to load monitoring data:', error)
      alert('載入監控資料失敗')
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
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (autoReconnectFilter === 'enabled' && !d.auto_reconnect_enabled) return false
      if (autoReconnectFilter === 'disabled' && d.auto_reconnect_enabled) return false

      if (!q) return true
      const hay = `${getDisplayName(d)} ${d.alias ?? ''} ${d.name ?? ''} ${d.ip ?? ''} ${d.device_id}`.toLowerCase()
      return hay.includes(q)
    })
  }, [devices, search, statusFilter, autoReconnectFilter])

  const filteredIds = useMemo(() => filteredDevices.map((d) => d.device_id), [filteredDevices])

  const toggleMonitoring = async () => {
    try {
      if (monitoringRunning) {
        await monitoringApi.stop()
      } else {
        await monitoringApi.start()
      }
      const next = !monitoringRunning
      setMonitoringRunning(next)
    } catch (error) {
      console.error('Failed to toggle monitoring:', error)
      alert('操作失敗')
    }
  }

  const runOnce = async () => {
    try {
      await monitoringApi.runOnce()
      await load()
    } catch (error) {
      console.error('Failed to run monitoring once:', error)
      alert('操作失敗')
    }
  }

  const setAutoReconnectBatch = async (enabled: boolean) => {
    if (filteredIds.length === 0) return
    try {
      const result = await deviceApi.setAutoReconnectEnabledBatch(filteredIds, enabled)
      setBatchResult({
        title: enabled ? '批次啟用自動重連' : '批次停用自動重連',
        ...result,
      })
      await load()
    } catch (error) {
      console.error('Failed to set auto reconnect batch:', error)
      alert('批次操作失敗')
    }
  }

  const resetBatch = async () => {
    if (filteredIds.length === 0) return
    try {
      const result = await deviceApi.resetAutoReconnectBatch(filteredIds)
      setBatchResult({
        title: '批次重置自動重連狀態',
        ...result,
      })
      await load()
    } catch (error) {
      console.error('Failed to reset auto reconnect batch:', error)
      alert('批次重置失敗')
    }
  }

  const setAutoReconnectOne = async (deviceId: string, enabled: boolean) => {
    try {
      await deviceApi.patch(deviceId, { auto_reconnect_enabled: enabled })
      await load()
    } catch (error) {
      console.error('Failed to set auto reconnect:', error)
      alert('更新失敗')
    }
  }

  const resetOne = async (deviceId: string) => {
    try {
      await deviceApi.resetAutoReconnect(deviceId)
      await load()
    } catch (error) {
      console.error('Failed to reset auto reconnect:', error)
      alert('重置失敗')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground">加載中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            to="/quest"
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            ← 返回
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">監控中心</h1>
            <p className="text-foreground/70 mt-2">篩選設備並批次設定自動重連／重置狀態</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runOnce}
              className="px-4 py-2 bg-accent text-foreground rounded-lg hover:bg-accent/80 transition-colors font-semibold"
            >
              手動執行一次
            </button>
            <button
              onClick={toggleMonitoring}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                monitoringRunning
                  ? 'bg-danger hover:bg-danger/80 text-foreground'
                  : 'bg-success hover:bg-success/80 text-foreground'
              }`}
            >
              {monitoringRunning ? '停止監控' : '啟動監控'}
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋：名稱 / IP / ID"
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            >
              <option value="all">狀態：全部</option>
              <option value={QUEST_DEVICE_STATUS.ONLINE}>狀態：在線</option>
              <option value={QUEST_DEVICE_STATUS.OFFLINE}>狀態：離線</option>
              <option value={QUEST_DEVICE_STATUS.ERROR}>狀態：錯誤</option>
              <option value={QUEST_DEVICE_STATUS.DISCONNECTED}>狀態：手動斷開</option>
              <option value={QUEST_DEVICE_STATUS.CONNECTING}>狀態：連接中</option>
            </select>

            <select
              value={autoReconnectFilter}
              onChange={(e) => setAutoReconnectFilter(e.target.value as AutoReconnectFilter)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            >
              <option value="all">自動重連：全部</option>
              <option value="enabled">自動重連：已啟用</option>
              <option value="disabled">自動重連：已停用</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="text-sm text-foreground/70">
              將套用於目前篩選的 <span className="font-semibold text-foreground">{filteredIds.length}</span> 台
            </div>
            <button
              onClick={() => setAutoReconnectBatch(true)}
              disabled={filteredIds.length === 0}
              className="px-4 py-2 bg-success text-foreground rounded-lg hover:bg-success/80 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              全選（啟用重連）
            </button>
            <button
              onClick={() => setAutoReconnectBatch(false)}
              disabled={filteredIds.length === 0}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              不選（停用重連）
            </button>
            <button
              onClick={resetBatch}
              disabled={filteredIds.length === 0}
              className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/80 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              批次重置
            </button>
            <button
              onClick={load}
              className="ml-auto px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-semibold"
            >
              重新整理
            </button>
          </div>
        </div>

        {batchResult ? (
          <div className="bg-surface rounded-lg border border-border p-4 mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-foreground">{batchResult.title}</div>
                <div className="text-sm text-foreground/70">
                  total: {batchResult.total} / success: {batchResult.success_count} / failed: {batchResult.failed_count}
                </div>
              </div>
              <button
                onClick={() => setBatchResult(null)}
                className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
              >
                清除
              </button>
            </div>

            {batchResult.failed_count > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-warning">
                  查看失敗清單（{batchResult.failed_count}）
                </summary>
                <div className="mt-2 rounded border border-warning/30 bg-warning/10 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border text-xs text-foreground/60">
            <div className="col-span-4">設備</div>
            <div className="col-span-2">狀態</div>
            <div className="col-span-2">自動重連</div>
            <div className="col-span-3">原因 / 詳情</div>
            <div className="col-span-1 text-right">操作</div>
          </div>

          {filteredDevices.length === 0 ? (
            <div className="p-6 text-foreground/70">沒有符合條件的設備</div>
          ) : (
            filteredDevices.map((d) => {
              const reason = getReasonText(d.auto_reconnect_disabled_reason)
              const lastError = d.auto_reconnect_last_error || ''
              return (
                <div key={d.device_id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border last:border-b-0">
                  <div className="col-span-4">
                    <div className="font-semibold text-foreground">{getDisplayName(d)}</div>
                    <div className="text-xs text-foreground/60 font-mono">{d.ip}:{d.port}</div>
                    <div className="text-xs text-foreground/50 font-mono">{d.device_id}</div>
                  </div>

                  <div className="col-span-2 text-sm text-foreground/80">
                    {getStatusText(d.status)}
                  </div>

                  <div className="col-span-2">
                    <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
                      <input
                        type="checkbox"
                        checked={Boolean(d.auto_reconnect_enabled)}
                        onChange={(e) => setAutoReconnectOne(d.device_id, e.target.checked)}
                      />
                      {d.auto_reconnect_enabled ? '啟用' : '停用'}
                    </label>
                  </div>

                  <div className="col-span-3 text-xs text-foreground/70">
                    {reason ? <div className="text-warning">{reason}</div> : <div className="text-foreground/40">-</div>}
                    {lastError ? (
                      <div className="truncate" title={lastError}>
                        {lastError}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => resetOne(d.device_id)}
                      className="px-3 py-1 text-sm bg-accent text-foreground rounded hover:bg-accent/80 transition-colors"
                      title="依規則重置自動重連狀態"
                    >
                      重置
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
