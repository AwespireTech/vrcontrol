import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDisplayName } from '@/lib/utils/device'
import { deviceApi, roomApi, scrcpyApi, preferenceApi } from '@/services/quest-api'
import { QUEST_DEVICE_STATUS, type QuestDevice, type IsolationDevice, ScrcpySession, ScrcpySystemInfo, UserPreference } from '@/services/quest-types'
import QuestPageShell from '@/components/quest/quest-page-shell'
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from '@/environment'

type StatusErrorType = 'idle' | 'ok' | 'timeout' | 'adb-error'

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [roomNameMap, setRoomNameMap] = useState<Map<string, string>>(new Map())
  const [isolationDevices, setIsolationDevices] = useState<IsolationDevice[]>([])
  const [isolationDrafts, setIsolationDrafts] = useState<Record<string, { alias: string }>>({})
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)
  
  // Scrcpy 相關狀態
  const [scrcpySystemInfo, setScrcpySystemInfo] = useState<ScrcpySystemInfo | null>(null)
  const [scrcpySessions, setScrcpySessions] = useState<ScrcpySession[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])

  // 使用者偏好與狀態錯誤追蹤
  const [preference, setPreference] = useState<UserPreference | null>(null)
  const [statusErrors, setStatusErrors] = useState<Record<string, StatusErrorType>>({})
  
  // 輪詢控制
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 避免 useCallback 依賴 devices 導致輪詢 interval 反覆重設
  const devicesRef = useRef<QuestDevice[]>([])
  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  const loadDevices = async () => {
    try {
      const [devicesData, roomsData, isolationData] = await Promise.all([
        deviceApi.getAll(),
        roomApi.getAll(),
        deviceApi.getIsolation(),
      ])
      setDevices(devicesData)
      setRoomNameMap(new Map(roomsData.map((room) => [room.room_id, room.name])))
      setIsolationDevices(isolationData)
      setIsolationDrafts((prev) => {
        const next = { ...prev }
        isolationData.forEach((entry) => {
          if (!next[entry.client_id]) {
            next[entry.client_id] = {
              alias: entry.client_id,
            }
          }
        })
        return next
      })
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshOnlineStatuses = useCallback(async () => {
    if (!preference) return

    const onlineDeviceIds = devicesRef.current
      .filter((d) => d.status === 'online')
      .map((d) => d.device_id)

    if (onlineDeviceIds.length === 0) return

    const batchSize =
      typeof preference.batch_size === 'number' && preference.batch_size > 0
        ? preference.batch_size
        : DEFAULT_BATCH_SIZE

    const maxWorkers =
      typeof preference.max_concurrency === 'number' && preference.max_concurrency > 0
        ? preference.max_concurrency
        : DEFAULT_MAX_CONCURRENCY

    for (let i = 0; i < onlineDeviceIds.length; i += batchSize) {
      const batchIds = onlineDeviceIds.slice(i, i + batchSize)

      try {
        const result = await deviceApi.getStatusBatch(batchIds, maxWorkers)

        if (result.success && result.results) {
          setDevices((prevDevices) => {
            const newDevices = [...prevDevices]
            result.results.forEach((statusResult) => {
              const deviceIndex = newDevices.findIndex(
                (d) => d.device_id === statusResult.device_id
              )
              if (deviceIndex >= 0) {
                if (statusResult.error) {
                  // 分類錯誤：含 timeout 為超時，其他為 ADB 錯誤
                  const errorType = statusResult.error.toLowerCase().includes('timeout')
                    ? 'timeout'
                    : 'adb-error'
                  setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: errorType }))
                } else {
                  // 成功獲取狀態
                  newDevices[deviceIndex] = {
                    ...newDevices[deviceIndex],
                    battery: statusResult.battery,
                    temperature: statusResult.temperature,
                    is_charging: statusResult.is_charging,
                  }
                  setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: 'ok' }))
                }
              }
            })
            return newDevices
          })
        }
      } catch (error) {
        console.error('Failed to refresh status batch:', error)
      }
    }
  }, [preference])

  const loadScrcpyInfo = async () => {
    try {
      const info = await scrcpyApi.getSystemInfo()
      setScrcpySystemInfo(info)
      
      if (info.installed) {
        const sessions = await scrcpyApi.getSessions()
        setScrcpySessions(sessions)
      }
    } catch (error) {
      console.error('Failed to load scrcpy info:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      // 載入偏好設定
      try {
        const pref = await preferenceApi.get()
        setPreference(pref)
      } catch (error) {
        console.error('Failed to load preference:', error)
        // 使用預設值
        setPreference({
          poll_interval_sec: DEFAULT_POLL_INTERVAL_SECONDS,
          batch_size: DEFAULT_BATCH_SIZE,
          max_concurrency: DEFAULT_MAX_CONCURRENCY,
          reconnect_cooldown_sec: 30,
          reconnect_max_retries: 5,
          updated_at: '',
        })
      }

      // 載入設備列表
      await loadDevices()
      await loadScrcpyInfo()
    }

    init()
  }, [])

  // 當設備列表或偏好設定更新時，執行一次狀態刷新
  useEffect(() => {
    if (devices.length > 0 && preference) {
      refreshOnlineStatuses()
    }
  }, [devices.length, preference, refreshOnlineStatuses])

  // 設定輪詢和可見性監聽
  useEffect(() => {
    if (!preference) return

    const pollIntervalSeconds =
      typeof preference.poll_interval_sec === 'number' && preference.poll_interval_sec > 0
        ? preference.poll_interval_sec
        : DEFAULT_POLL_INTERVAL_SECONDS

    // Option B：每次進入頁面（mount）就重置倒數
    setCountdown(pollIntervalSeconds)

    // 設定狀態輪詢（使用偏好設定的間隔）
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
    }
    statusIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        refreshOnlineStatuses()
        loadDevices()
        setCountdown(pollIntervalSeconds)
      }
    }, pollIntervalSeconds * 1000)

    // 倒數計時器（UI 顯示用）
    const countdownInterval = setInterval(() => {
      if (document.hidden) return
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
      clearInterval(countdownInterval)
    }
  }, [preference, refreshOnlineStatuses])

  const getStatusText = (status: QuestDevice['status']) => {
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

  const getWsStatusText = (status?: QuestDevice['ws_status']) => {
    if (status === 'connected') return 'WS 已連線'
    return 'WS 未連線'
  }

  const isValidClientId = (clientId: string) => /^[0-9a-fA-F]{8}$/.test(clientId)

  const getDeviceIdFromClient = (clientId: string) => `DEV-${clientId.toUpperCase()}`

  const handleIsolationDraftChange = (clientId: string, value: string) => {
    setIsolationDrafts((prev) => ({
      ...prev,
      [clientId]: {
        alias: value,
      },
    }))
  }

  const handleCreateFromIsolation = async (entry: IsolationDevice) => {
    if (!entry.valid || !isValidClientId(entry.client_id)) return
    const draft = isolationDrafts[entry.client_id]
    try {
      await deviceApi.create({
        device_id: entry.client_id,
        alias: draft?.alias || entry.client_id,
        ip: entry.ip,
      })
      await loadDevices()
      alert('設備建立成功')
    } catch (error) {
      console.error('Failed to create device from isolation:', error)
      alert('建立設備失敗')
    }
  }

  const handleUpdateFromIsolation = async (entry: IsolationDevice) => {
    if (!entry.valid || !isValidClientId(entry.client_id)) return
    const deviceId = getDeviceIdFromClient(entry.client_id)
    try {
      await deviceApi.patch(deviceId, {
        ip: entry.ip,
      })
      await loadDevices()
      alert('設備資訊更新成功')
    } catch (error) {
      console.error('Failed to update device from isolation:', error)
      alert('更新設備失敗')
    }
  }

  const getStatusColor = (status: QuestDevice['status']) => {
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

  const getAutoReconnectDisabledReasonText = (
    reason?: QuestDevice['auto_reconnect_disabled_reason'],
  ) => {
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

  const renderStatusValue = (
    status: StatusErrorType,
    value?: number | string,
    unit?: string,
  ) => {
    if (status === 'idle') return <span className="text-foreground/50">-</span>
    if (status === 'timeout') {
      return (
        <span className="text-foreground/50" title="狀態查詢逾時">
          ?
        </span>
      )
    }
    if (status === 'adb-error') {
      return (
        <span className="text-foreground/50" title="ADB 查詢失敗">
          X
        </span>
      )
    }
    if (value === undefined || value === null) return <span className="text-foreground/50">-</span>
    return (
      <span className="text-foreground">
        {value}
        {unit ?? ''}
      </span>
    )
  }

  const handleConnect = async (deviceId: string) => {
    try {
      await deviceApi.connect(deviceId)
      await loadDevices()
      
      // 連接成功後立即查詢狀態
      try {
        const status = await deviceApi.getStatus(deviceId)
        setDevices((prevDevices) =>
          prevDevices.map((d) =>
            d.device_id === deviceId
              ? {
                  ...d,
                  battery: status.battery,
                  temperature: status.temperature,
                  is_charging: status.is_charging,
                }
              : d
          )
        )
        setStatusErrors((prev) => ({ ...prev, [deviceId]: 'ok' }))
      } catch (statusError: unknown) {
        console.error('Failed to get device status after connect:', statusError)
        const message = statusError instanceof Error ? statusError.message : String(statusError)
        // 分類錯誤
        const errorType = message.toLowerCase().includes('timeout') ? 'timeout' : 'adb-error'
        setStatusErrors((prev) => ({ ...prev, [deviceId]: errorType }))
      }
    } catch (error) {
      console.error('Failed to connect device:', error)
      alert('連接失敗')
    }
  }

  const handleDisconnect = async (deviceId: string) => {
    try {
      await deviceApi.disconnect(deviceId)
      await loadDevices()
    } catch (error) {
      console.error('Failed to disconnect device:', error)
      alert('斷開失敗')
    }
  }

  const handleDelete = async (deviceId: string) => {
    if (!confirm('確定要刪除這個設備嗎？')) return

    try {
      await deviceApi.delete(deviceId)
      await loadDevices()
    } catch (error) {
      console.error('Failed to delete device:', error)
      alert('刪除失敗')
    }
  }

  const handleConnectAll = async () => {
    const offlineDevices = devices.filter((d) => d.status === 'offline')
    if (offlineDevices.length === 0) {
      alert('沒有離線設備')
      return
    }

    try {
      const result = await deviceApi.connectBatch(
        offlineDevices.map((d) => d.device_id),
        5,
      )
      alert(`批量連接完成：成功 ${result.success_count}，失敗 ${result.failed_count}`)
      await loadDevices()
    } catch (error) {
      console.error('Failed to connect all devices:', error)
      alert('批量連接失敗')
    }
  }

  const handlePingAll = async () => {
    const onlineDevices = devices.filter((d) => d.status === 'online')
    if (onlineDevices.length === 0) {
      alert('沒有在線設備')
      return
    }

    try {
      await deviceApi.pingBatch(
        onlineDevices.map((d) => d.device_id),
        10,
      )
      await loadDevices()
    } catch (error) {
      console.error('Failed to ping all devices:', error)
      alert('批量 Ping 失敗')
    }
  }

  const handleMonitor = async (deviceId: string) => {
    if (!scrcpySystemInfo?.installed) {
      alert('Scrcpy 未安裝，請先安裝 scrcpy')
      return
    }

    try {
      await scrcpyApi.start(deviceId)
      alert('已啟動監看視窗')
      await loadScrcpyInfo()
    } catch (error: unknown) {
      console.error('Failed to start scrcpy:', error)
      const message = error instanceof Error ? error.message : ''
      alert(message || '啟動監看失敗')
    }
  }

  const handleMonitorBatch = async () => {
    if (!scrcpySystemInfo?.installed) {
      alert('Scrcpy 未安裝，請先安裝 scrcpy')
      return
    }

    if (selectedDeviceIds.length === 0) {
      alert('請先選擇要監看的設備')
      return
    }

    try {
      const result = await scrcpyApi.startBatch({ device_ids: selectedDeviceIds })
      alert(`批量監看啟動完成：成功 ${result.success_count}，失敗 ${result.failed_count}`)
      await loadScrcpyInfo()
      setSelectedDeviceIds([])
    } catch (error) {
      console.error('Failed to start batch scrcpy:', error)
      alert('批量監看啟動失敗')
    }
  }

  const handleStopScrcpy = async (deviceId: string) => {
    try {
      await scrcpyApi.stop(deviceId)
      alert('已停止監看')
      await loadScrcpyInfo()
    } catch (error) {
      console.error('Failed to stop scrcpy:', error)
      alert('停止監看失敗')
    }
  }

  const handleRefreshSessions = async () => {
    try {
      const sessions = await scrcpyApi.refreshSessions()
      setScrcpySessions(sessions)
    } catch (error) {
      console.error('Failed to refresh sessions:', error)
    }
  }

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    )
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
      title="設備管理"
      subtitle={`下次更新: ${countdown} 秒`}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleConnectAll}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            批量連接
          </button>
          <button
            onClick={handlePingAll}
            className="ui-btn ui-btn-md ui-btn-success"
          >
            批量 Ping
          </button>
          {scrcpySystemInfo?.installed && selectedDeviceIds.length > 0 && (
            <button
              onClick={handleMonitorBatch}
              className="ui-btn ui-btn-md ui-btn-accent"
            >
              批量監看 ({selectedDeviceIds.length})
            </button>
          )}
          <button
            onClick={() => navigate('/quest/devices/new')}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            + 添加設備
          </button>
        </div>
      }
    >
      {devices.length === 0 ? (
        <div className="surface-card p-10 text-center text-foreground/70">尚無設備</div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
            <div className="col-span-1">選取</div>
            <div className="col-span-3">設備</div>
            <div className="col-span-2">狀態</div>
            <div className="col-span-2">房間</div>
            <div className="col-span-2">電量 / 溫度</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
          {devices.map((device) => {
            const isOnline = device.status === QUEST_DEVICE_STATUS.ONLINE
            const isConnecting = device.status === QUEST_DEVICE_STATUS.CONNECTING
            const statusErrorType = statusErrors[device.device_id] || 'idle'
            const disabledReasonText = getAutoReconnectDisabledReasonText(
              device.auto_reconnect_disabled_reason,
            )
            const canSelect = Boolean(scrcpySystemInfo?.installed) && isOnline

            return (
              <div
                key={device.device_id}
                className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface/40 last:border-b-0"
              >
                <div className="col-span-1 flex items-start pt-1">
                  <input
                    type="checkbox"
                    checked={selectedDeviceIds.includes(device.device_id)}
                    onChange={() => toggleDeviceSelection(device.device_id)}
                    disabled={!canSelect}
                    className="h-4 w-4"
                  />
                </div>
                <div className="col-span-3">
                  <div className="font-semibold text-foreground">
                    {getDisplayName(device)}
                  </div>
                  <div className="text-xs text-foreground/60 font-mono">
                    {device.ip}:{device.port}
                  </div>
                  <div className="text-xs text-foreground/50 font-mono">
                    {device.device_id}
                  </div>
                  {disabledReasonText ? (
                    <div className="mt-1 text-xs text-warning">
                      {disabledReasonText}
                      {device.auto_reconnect_last_error ? (
                        <span
                          className="ml-2 text-foreground/60"
                          title={device.auto_reconnect_last_error}
                        >
                          （詳情）
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(device.status)}`} />
                    <span className="text-sm text-foreground/80">
                      {getStatusText(device.status)}
                    </span>
                  </div>
                  {device.alias ? (
                    <div className="text-xs text-foreground/50">{device.alias}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-foreground/50">
                    {getWsStatusText(device.ws_status)}
                  </div>
                </div>
                <div className="col-span-2 text-xs text-foreground/70">
                  {device.room_id ? (
                    <button
                      onClick={() => navigate(`/quest/rooms/${device.room_id}/devices`)}
                      className="text-left cursor-pointer group"
                    >
                      <div className="font-semibold text-foreground group-hover:underline">
                        {roomNameMap.get(device.room_id) || device.room_id}
                      </div>
                      <div className="text-[11px] text-foreground/50 font-mono group-hover:text-foreground/70">
                        {device.room_id}
                      </div>
                    </button>
                  ) : (
                    <div className="font-semibold text-foreground/60">未指派</div>
                  )}
                </div>
                <div className="col-span-2 text-xs text-foreground/70">
                  <div>
                    電量：{renderStatusValue(statusErrorType, device.battery, '%')}
                  </div>
                  <div>
                    溫度：{renderStatusValue(statusErrorType, device.temperature, '°C')}
                  </div>
                </div>
                <div className="col-span-2 flex flex-wrap items-start justify-end gap-2">
                  {!isOnline && !isConnecting && (
                    <button
                      onClick={() => handleConnect(device.device_id)}
                      className="ui-btn ui-btn-xs ui-btn-primary"
                    >
                      連接
                    </button>
                  )}
                  {isOnline && (
                    <>
                      <button
                        onClick={() => handleDisconnect(device.device_id)}
                        className="ui-btn ui-btn-xs ui-btn-danger"
                      >
                        斷開
                      </button>
                    </>
                  )}
                  {isOnline && (
                    <button
                      onClick={() => handleMonitor(device.device_id)}
                      disabled={!scrcpySystemInfo?.installed}
                      className={`ui-btn ui-btn-xs ${
                        scrcpySystemInfo?.installed
                          ? 'ui-btn-accent'
                          : 'bg-muted/50 text-foreground/50 cursor-not-allowed'
                      }`}
                      title={scrcpySystemInfo?.installed ? '啟動螢幕監看' : 'Scrcpy 未安裝'}
                    >
                      監看
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/quest/devices/${device.device_id}`)}
                    className="ui-btn ui-btn-xs ui-btn-muted"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(device.device_id)}
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

      <div className="surface-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">隔離區連線</h2>
          <span className="text-xs text-foreground/60">{isolationDevices.length} 筆</span>
        </div>
        {isolationDevices.length === 0 ? (
          <div className="text-center text-foreground/60">目前沒有隔離中的連線</div>
        ) : (
          <div className="space-y-3">
            {isolationDevices.map((entry) => {
              const valid = entry.valid && isValidClientId(entry.client_id)
              const deviceId = valid ? getDeviceIdFromClient(entry.client_id) : ''
              const matched = entry.id_matched && !entry.ip_matched && valid
              const draft = isolationDrafts[entry.client_id] || {
                alias: entry.client_id,
              }
              return (
                <div key={entry.client_id} className="surface-panel p-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                      <div className="text-sm text-foreground/60">Client ID</div>
                      <div className="font-mono text-foreground">{entry.client_id}</div>
                      <div className="mt-1 text-xs text-foreground/50">
                        IP: {entry.ip || '—'}
                      </div>
                      {entry.device_id && (
                        <div className="text-xs text-foreground/50">
                          對應設備: {entry.device_id}
                        </div>
                      )}
                      <div className="text-xs text-foreground/50">
                        最近連線: {entry.last_seen ? new Date(entry.last_seen).toLocaleString() : '—'}
                      </div>
                      {!valid && (
                        <div className="mt-2 text-xs text-danger">
                          格式錯誤：需為 8 位 16 進位
                        </div>
                      )}
                      {valid && entry.id_matched && !entry.ip_matched && (
                        <div className="mt-2 text-xs text-warning">
                          ID 相符但 IP 不一致，可更新現有設備
                        </div>
                      )}
                      {valid && !entry.id_matched && (
                        <div className="mt-2 text-xs text-foreground/60">
                          未建立設備，可直接建立
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-5 grid grid-cols-1 gap-3">
                      <div>
                        <div className="text-xs text-foreground/60">Alias</div>
                        <input
                          value={draft.alias}
                          onChange={(e) => handleIsolationDraftChange(entry.client_id, e.target.value)}
                          className="ui-input w-full px-2 py-1"
                          placeholder="顯示名稱"
                        />
                      </div>
                    </div>
                    <div className="lg:col-span-3 flex flex-wrap items-center justify-end gap-2">
                      {matched ? (
                        <>
                          <div className="text-xs text-foreground/60">已匹配: {deviceId}</div>
                          <button
                            onClick={() => handleUpdateFromIsolation(entry)}
                            className="ui-btn ui-btn-sm ui-btn-accent"
                            disabled={!valid}
                          >
                            更新設備
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleCreateFromIsolation(entry)}
                          className="ui-btn ui-btn-sm ui-btn-primary"
                          disabled={!valid || entry.id_matched}
                        >
                          建立設備
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {scrcpySystemInfo?.installed && scrcpySessions.length > 0 && (
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">監看會話</h2>
            <button
              onClick={handleRefreshSessions}
              className="ui-btn ui-btn-md ui-btn-muted"
            >
              刷新狀態
            </button>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
              <div className="col-span-4">設備</div>
              <div className="col-span-2">PID</div>
              <div className="col-span-3">啟動時間</div>
              <div className="col-span-2">狀態</div>
              <div className="col-span-1 text-right">操作</div>
            </div>
            {scrcpySessions.map((session) => {
              const device = devices.find((d) => d.device_id === session.device_id)
              return (
                <div
                  key={session.device_id}
                  className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface/40 last:border-b-0"
                >
                  <div className="col-span-4 text-sm text-foreground">
                    {device ? getDisplayName(device) : session.device_id}
                  </div>
                  <div className="col-span-2 text-sm font-mono text-foreground/70">
                    {session.process_id}
                  </div>
                  <div className="col-span-3 text-sm text-foreground/70">
                    {new Date(session.started_at).toLocaleString()}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`ui-badge inline-flex leading-5 font-semibold ${
                        session.is_running ? 'ui-badge-success' : 'ui-badge-muted'
                      }`}
                    >
                      {session.is_running ? '運行中' : '已停止'}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {session.is_running && (
                      <button
                        onClick={() => handleStopScrcpy(session.device_id)}
                        className="ui-btn ui-btn-xs ui-btn-danger"
                      >
                        停止
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </QuestPageShell>
  )
}
