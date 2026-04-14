import { useEffect, useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { getDisplayName } from "@/lib/utils/device"
import { actionApi, deviceApi, roomApi, scrcpyApi, preferenceApi } from "@/services/api"
import {
  ACTION_TYPES,
  DEVICE_STATUS,
  type Action,
  type Device,
  type IsolationDevice,
  type USBDevice,
  ScrcpySession,
  ScrcpySystemInfo,
  UserPreference,
} from "@/services/api-types"
import PageShell from "@/components/console/page-shell"
import LiveStreamPlayer from "@/components/console/live-stream-player"
import Button from "@/components/button"
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
  LIVE_VIEW_MAX_STREAMS,
} from "@/environment"

type StatusErrorType = "idle" | "ok" | "timeout" | "adb-error"

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [rooms, setRooms] = useState<Array<{ room_id: string; name: string }>>([])
  const [roomNameMap, setRoomNameMap] = useState<Map<string, string>>(new Map())
  const [actions, setActions] = useState<Action[]>([])
  const [selectedActionIds, setSelectedActionIds] = useState<Record<string, string>>({})
  const [actionRunningIds, setActionRunningIds] = useState<Record<string, boolean>>({})
  const [isolationDevices, setIsolationDevices] = useState<IsolationDevice[]>([])
  const [usbDevices, setUSBDevices] = useState<USBDevice[]>([])
  const [isolationDrafts, setIsolationDrafts] = useState<Record<string, { alias: string }>>({})
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)
  const [roomUpdatingIds, setRoomUpdatingIds] = useState<Record<string, boolean>>({})
  const [deviceActionPending, setDeviceActionPending] = useState<
    Record<string, "connect" | "disconnect" | "monitor" | "delete" | "execute">
  >({})
  const [isolationPending, setIsolationPending] = useState<Record<string, "create" | "update">>({})
  const [usbActionPending, setUSBActionPending] = useState<Record<string, boolean>>({})
  const [scrcpyStopPending, setScrcpyStopPending] = useState<Record<string, boolean>>({})
  const [refreshScrcpyPending, setRefreshScrcpyPending] = useState(false)
  const [liveWallDeviceIds, setLiveWallDeviceIds] = useState<string[]>([])

  // Scrcpy 相關狀態
  const [scrcpySystemInfo, setScrcpySystemInfo] = useState<ScrcpySystemInfo | null>(null)
  const [scrcpySessions, setScrcpySessions] = useState<ScrcpySession[]>([])

  // 使用者偏好與狀態錯誤追蹤
  const [preference, setPreference] = useState<UserPreference | null>(null)
  const [statusErrors, setStatusErrors] = useState<Record<string, StatusErrorType>>({})

  // 輪詢控制
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const livePanelRef = useRef<HTMLDivElement | null>(null)

  // 避免 useCallback 依賴 devices 導致輪詢 interval 反覆重設
  const devicesRef = useRef<Device[]>([])
  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  useEffect(() => {
    if (liveWallDeviceIds.length !== 1 || !livePanelRef.current) return
    livePanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [liveWallDeviceIds])

  const loadDevices = useCallback(async () => {
    try {
      const [devicesData, roomsData, isolationData] = await Promise.all([
        deviceApi.getAll(),
        roomApi.getAll(),
        deviceApi.getIsolation(),
      ])

      try {
        const usbData = await deviceApi.getUSBDevices()
        setUSBDevices(usbData)
      } catch (error) {
        console.error("Failed to load USB devices:", error)
        setUSBDevices([])
      }

      setDevices(devicesData)
      setRooms(roomsData.map((room) => ({ room_id: room.room_id, name: room.name })))
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
      console.error("Failed to load devices:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshOnlineStatuses = useCallback(async () => {
    if (!preference) return

    const onlineDeviceIds = devicesRef.current
      .filter((d) => d.status === "online")
      .map((d) => d.device_id)

    if (onlineDeviceIds.length === 0) return

    const batchSize =
      typeof preference.batch_size === "number" && preference.batch_size > 0
        ? preference.batch_size
        : DEFAULT_BATCH_SIZE

    const maxWorkers =
      typeof preference.max_concurrency === "number" && preference.max_concurrency > 0
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
                (d) => d.device_id === statusResult.device_id,
              )
              if (deviceIndex >= 0) {
                if (statusResult.error) {
                  // 分類錯誤：含 timeout 為超時，其他為 ADB 錯誤
                  const errorType = statusResult.error.toLowerCase().includes("timeout")
                    ? "timeout"
                    : "adb-error"
                  setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: errorType }))
                } else {
                  // 成功獲取狀態
                  newDevices[deviceIndex] = {
                    ...newDevices[deviceIndex],
                    battery: statusResult.battery,
                    temperature: statusResult.temperature,
                    is_charging: statusResult.is_charging,
                  }
                  setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: "ok" }))
                }
              }
            })
            return newDevices
          })
        }
      } catch (error) {
        console.error("Failed to refresh status batch:", error)
      }
    }
  }, [preference])

  const loadScrcpyInfo = useCallback(async () => {
    try {
      const info = await scrcpyApi.getSystemInfo()
      setScrcpySystemInfo(info)

      if (info.installed) {
        const sessions = await scrcpyApi.getSessions()
        setScrcpySessions(sessions)
      }
    } catch (error) {
      console.error("Failed to load scrcpy info:", error)
    }
  }, [])

  const refreshPageData = useCallback(async () => {
    await Promise.all([loadDevices(), loadScrcpyInfo()])
  }, [loadDevices, loadScrcpyInfo])

  useEffect(() => {
    const init = async () => {
      // 載入偏好設定
      try {
        const pref = await preferenceApi.get()
        setPreference(pref)
      } catch (error) {
        console.error("Failed to load preference:", error)
        // 使用預設值
        setPreference({
          poll_interval_sec: DEFAULT_POLL_INTERVAL_SECONDS,
          batch_size: DEFAULT_BATCH_SIZE,
          max_concurrency: DEFAULT_MAX_CONCURRENCY,
          reconnect_cooldown_sec: 30,
          reconnect_max_retries: 5,
          updated_at: "",
        })
      }

      // 載入設備列表
      await loadDevices()
      await loadActions()
      await loadScrcpyInfo()
    }

    init()
  }, [loadDevices, loadScrcpyInfo])

  const loadActions = async () => {
    try {
      const actionsData = await actionApi.getAll()
      setActions(actionsData)
    } catch (error) {
      console.error("Failed to load actions:", error)
    }
  }

  // 當設備列表或偏好設定更新時，執行一次狀態更新
  useEffect(() => {
    if (devices.length > 0 && preference) {
      refreshOnlineStatuses()
    }
  }, [devices.length, preference, refreshOnlineStatuses])

  // 設定輪詢和可見性監聽
  useEffect(() => {
    if (!preference) return

    const pollIntervalSeconds =
      typeof preference.poll_interval_sec === "number" && preference.poll_interval_sec > 0
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
        refreshPageData()
        setCountdown(pollIntervalSeconds)
      }
    }, pollIntervalSeconds * 1000)

    const handleVisibilityChange = () => {
      if (document.hidden) return
      refreshPageData()
      setCountdown(pollIntervalSeconds)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // 倒數計時器（UI 顯示用）
    const countdownInterval = setInterval(() => {
      if (document.hidden) return
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
      clearInterval(countdownInterval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [preference, refreshOnlineStatuses, refreshPageData])

  const getStatusText = (status: Device["status"]) => {
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

  const getAdbStatusBadgeClass = (status: Device["status"]) => {
    switch (status) {
      case DEVICE_STATUS.ONLINE:
        return "ui-badge-success"
      case DEVICE_STATUS.CONNECTING:
        return "ui-badge-warning"
      case DEVICE_STATUS.ERROR:
        return "ui-badge-danger"
      case DEVICE_STATUS.OFFLINE:
      case DEVICE_STATUS.DISCONNECTED:
      default:
        return "ui-badge-muted"
    }
  }

  const getWsStatusText = (status?: Device["ws_status"]) => {
    if (status === "connected") return "已連線"
    if (status === "disconnected") return "未連線"
    return "未知"
  }

  const getWsStatusBadgeClass = (status?: Device["ws_status"]) => {
    if (status === "connected") return "ui-badge-success"
    if (status === "disconnected") return "ui-badge-muted"
    return "ui-badge-muted"
  }

  const getUSBTcpipStatusText = (device: USBDevice) => {
    if (!device.tcpip_enabled) return "未啟用"
    return device.tcpip_port ? `已啟用 (${device.tcpip_port})` : "已啟用"
  }

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

  const isValidClientId = (clientId: string) => /^[0-9A-Za-z]{8}$/.test(clientId)

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
    if (isolationPending[entry.client_id]) return
    const draft = isolationDrafts[entry.client_id]
    setIsolationPending((prev) => ({ ...prev, [entry.client_id]: "create" }))
    try {
      await deviceApi.create({
        device_id: entry.client_id,
        alias: draft?.alias || entry.client_id,
        ip: entry.ip,
      })
      await loadDevices()
      alert("設備建立成功")
    } catch (error) {
      console.error("Failed to create device from isolation:", error)
      alert("建立設備失敗，請稍後再試")
    } finally {
      setIsolationPending((prev) => {
        const next = { ...prev }
        delete next[entry.client_id]
        return next
      })
    }
  }

  const handleUpdateFromIsolation = async (entry: IsolationDevice) => {
    if (!entry.valid || !isValidClientId(entry.client_id)) return
    if (isolationPending[entry.client_id]) return
    const deviceId = getDeviceIdFromClient(entry.client_id)
    setIsolationPending((prev) => ({ ...prev, [entry.client_id]: "update" }))
    try {
      await deviceApi.patch(deviceId, {
        ip: entry.ip,
      })
      await loadDevices()
      alert("設備資訊更新成功")
    } catch (error) {
      console.error("Failed to update device from isolation:", error)
      alert("更新設備失敗，請稍後再試")
    } finally {
      setIsolationPending((prev) => {
        const next = { ...prev }
        delete next[entry.client_id]
        return next
      })
    }
  }

  const handleEnableUSBTCPIP = async (serial: string) => {
    if (usbActionPending[serial]) return

    setUSBActionPending((prev) => ({ ...prev, [serial]: true }))
    try {
      await deviceApi.enableUSBTCPIP(serial)
      await loadDevices()
      alert(`已啟用 ${serial} 的 TCPIP 模式`)
    } catch (error) {
      console.error("Failed to enable tcpip mode:", error)
      alert("啟用 TCPIP 模式失敗，請稍後再試")
    } finally {
      setUSBActionPending((prev) => {
        const next = { ...prev }
        delete next[serial]
        return next
      })
    }
  }

  const getAutoReconnectDisabledReasonText = (
    reason?: Device["auto_reconnect_disabled_reason"],
  ) => {
    switch (reason) {
      case "manual_disconnect":
        return "手動斷開（不自動重連）"
      case "max_retries_exhausted":
        return "自動重連已達上限"
      case "adb_not_found":
        return "找不到 ADB（請確認已安裝並加入 PATH）"
      case "adb_connect_failed":
        return "ADB 連線失敗（重試後停止）"
      case "unknown":
        return "未知錯誤（重試後停止）"
      default:
        return ""
    }
  }

  const renderStatusValue = (status: StatusErrorType, value?: number | string, unit?: string) => {
    if (status === "idle") return <span className="text-foreground/50">-</span>
    if (status === "timeout") {
      return (
        <span className="text-foreground/50" title="狀態查詢逾時">
          ?
        </span>
      )
    }
    if (status === "adb-error") {
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
        {unit ?? ""}
      </span>
    )
  }

  const handleConnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "connect" }))
    try {
      await deviceApi.connect(deviceId)
      await loadDevices()

      // 連線成功後立即查詢狀態
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
              : d,
          ),
        )
        setStatusErrors((prev) => ({ ...prev, [deviceId]: "ok" }))
      } catch (statusError: unknown) {
        console.error("Failed to get device status after connect:", statusError)
        const message = statusError instanceof Error ? statusError.message : String(statusError)
        // 分類錯誤
        const errorType = message.toLowerCase().includes("timeout") ? "timeout" : "adb-error"
        setStatusErrors((prev) => ({ ...prev, [deviceId]: errorType }))
      }
    } catch (error) {
      console.error("Failed to connect device:", error)
      alert("連線失敗，請稍後再試")
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleDisconnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "disconnect" }))
    try {
      await deviceApi.disconnect(deviceId)
      await loadDevices()
    } catch (error) {
      console.error("Failed to disconnect device:", error)
      alert("斷開失敗，請稍後再試")
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleAssignRoom = async (device: Device, nextRoomId: string) => {
    const currentRoomId = device.room_id || ""
    if (nextRoomId === currentRoomId) return

    setRoomUpdatingIds((prev) => ({ ...prev, [device.device_id]: true }))
    try {
      if (nextRoomId === "") {
        if (currentRoomId) {
          await roomApi.removeDevice(currentRoomId, device.device_id)
        }
      } else {
        if (currentRoomId && currentRoomId !== nextRoomId) {
          await roomApi.removeDevice(currentRoomId, device.device_id)
        }
        await roomApi.addDevice(nextRoomId, device.device_id)
      }
      await loadDevices()
    } catch (error) {
      console.error("Failed to assign room:", error)
      alert("房間指派失敗，請稍後再試")
    } finally {
      setRoomUpdatingIds((prev) => ({ ...prev, [device.device_id]: false }))
    }
  }

  const handleExecuteAction = async (deviceId: string) => {
    const actionId = selectedActionIds[deviceId]
    if (!actionId) return
    if (deviceActionPending[deviceId]) return

    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "execute" }))
    setActionRunningIds((prev) => ({ ...prev, [deviceId]: true }))
    try {
      const result = await actionApi.executeBatch({
        action_id: actionId,
        device_ids: [deviceId],
        max_workers: 1,
      })
      alert(`執行完成：成功 ${result.success_count}、失敗 ${result.failed_count}`)
    } catch (error) {
      console.error("Failed to execute action:", error)
      alert("執行動作失敗，請稍後再試")
    } finally {
      setActionRunningIds((prev) => ({ ...prev, [deviceId]: false }))
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleDelete = async (deviceId: string) => {
    if (!confirm("確定要刪除這個設備嗎？")) return
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "delete" }))
    try {
      await deviceApi.delete(deviceId)
      await loadDevices()
    } catch (error) {
      console.error("Failed to delete device:", error)
      alert("刪除失敗，請稍後再試")
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleMonitor = async (deviceId: string) => {
    if (!scrcpySystemInfo?.installed) {
      alert("Scrcpy 尚未安裝，請先安裝 Scrcpy")
      return
    }

    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "monitor" }))

    try {
      await scrcpyApi.start(deviceId)
      alert("已啟動監看視窗")
      await loadScrcpyInfo()
    } catch (error: unknown) {
      console.error("Failed to start scrcpy:", error)
      const message = error instanceof Error ? error.message : ""
      alert(message || "啟動監看失敗，請稍後再試")
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleOpenLiveStream = (deviceId: string) => {
    const device = devices.find((entry) => entry.device_id === deviceId)
    if (!device) {
      alert("找不到設備資料，請重新整理後再試")
      return
    }

    if (device.status !== DEVICE_STATUS.ONLINE) {
      alert("設備需處於在線狀態才能開啟即時畫面")
      return
    }

    let reachedLimit = false
    setLiveWallDeviceIds((prev) => {
      if (prev.includes(deviceId)) return prev
      if (prev.length >= LIVE_VIEW_MAX_STREAMS) {
        reachedLimit = true
        return prev
      }
      return [...prev, deviceId]
    })

    if (reachedLimit) {
      alert(`即時畫面初版最多同時開啟 ${LIVE_VIEW_MAX_STREAMS} 台設備`)
    }
  }

  const handleCloseLiveStream = (deviceId: string) => {
    setLiveWallDeviceIds((prev) => prev.filter((id) => id !== deviceId))
  }

  const handleStopScrcpy = async (deviceId: string) => {
    if (scrcpyStopPending[deviceId]) return
    setScrcpyStopPending((prev) => ({ ...prev, [deviceId]: true }))
    try {
      await scrcpyApi.stop(deviceId)
      alert("已停止監看")
      await loadScrcpyInfo()
    } catch (error) {
      console.error("Failed to stop scrcpy:", error)
      alert("停止監看失敗，請稍後再試")
    } finally {
      setScrcpyStopPending((prev) => ({ ...prev, [deviceId]: false }))
    }
  }

  const handleRefreshSessions = async () => {
    if (refreshScrcpyPending) return
    setRefreshScrcpyPending(true)
    try {
      const sessions = await scrcpyApi.refreshSessions()
      setScrcpySessions(sessions)
    } catch (error) {
      console.error("Failed to refresh sessions:", error)
    } finally {
      setRefreshScrcpyPending(false)
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
    <PageShell
      title="設備管理"
      subtitle={`下次更新 ${countdown} 秒`}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/devices/new")}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            + 建立設備
          </button>
        </div>
      }
    >
      {devices.length === 0 ? (
        <div className="surface-card p-10 text-center text-foreground/70">尚無設備</div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
            <div className="col-span-2">設備</div>
            <div className="col-span-2">連線</div>
            <div className="col-span-1">電量 / 溫度</div>
            <div className="col-span-2">房間</div>
            <div className="col-span-2">動作</div>
            <div className="col-span-3 text-right">操作</div>
          </div>
          {devices.map((device) => {
            const isOnline = device.status === DEVICE_STATUS.ONLINE
            const isConnecting = device.status === DEVICE_STATUS.CONNECTING
            const statusErrorType = statusErrors[device.device_id] || "idle"
            const disabledReasonText = getAutoReconnectDisabledReasonText(
              device.auto_reconnect_disabled_reason,
            )
            const isActionReady = isOnline && !actionRunningIds[device.device_id]
            const pendingAction = deviceActionPending[device.device_id]
            const isDevicePending = !!pendingAction

            return (
              <div
                key={device.device_id}
                className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface/40"
              >
                <div className="col-span-2">
                  <div className="font-semibold text-foreground">{getDisplayName(device)}</div>
                  <div className="font-mono text-xs text-foreground/60">
                    {device.ip}:{device.port}
                  </div>
                  <div className="font-mono text-xs text-foreground/50">{device.device_id}</div>
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
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-9 text-[11px] uppercase tracking-wide text-foreground/50">
                        ADB
                      </span>
                      <span className={`ui-badge ${getAdbStatusBadgeClass(device.status)}`}>
                        {getStatusText(device.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-9 text-[11px] uppercase tracking-wide text-foreground/50">
                        WS
                      </span>
                      <span className={`ui-badge ${getWsStatusBadgeClass(device.ws_status)}`}>
                        {getWsStatusText(device.ws_status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="col-span-1 text-xs text-foreground/70">
                  <div>電量：{renderStatusValue(statusErrorType, device.battery, "%")}</div>
                  <div>溫度：{renderStatusValue(statusErrorType, device.temperature, "°C")}</div>
                </div>
                <div className="col-span-2 text-xs text-foreground/70">
                  {device.room_id ? (
                    <button
                      onClick={() => navigate(`/rooms/${device.room_id}/control`)}
                      className="group cursor-pointer text-left"
                    >
                      <div className="font-semibold text-foreground group-hover:underline">
                        {roomNameMap.get(device.room_id) || device.room_id}
                      </div>
                      <div className="font-mono text-[11px] text-foreground/50 group-hover:text-foreground/70">
                        {device.room_id}
                      </div>
                    </button>
                  ) : (
                    <div className="font-semibold text-foreground/60">未指派</div>
                  )}
                  <select
                    value={device.room_id || ""}
                    onChange={(e) => handleAssignRoom(device, e.target.value)}
                    disabled={roomUpdatingIds[device.device_id]}
                    className="ui-select mt-2 w-11/12 px-2 py-1 text-[11px]"
                  >
                    <option value="">未指派</option>
                    {rooms
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                          {room.name} · {room.room_id}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={selectedActionIds[device.device_id] || ""}
                      onChange={(e) =>
                        setSelectedActionIds((prev) => ({
                          ...prev,
                          [device.device_id]: e.target.value,
                        }))
                      }
                      disabled={!isOnline}
                      className="ui-select w-2/3 px-2 py-1 text-[11px]"
                    >
                      <option value="">選擇動作</option>
                      {actions
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((action) => (
                          <option key={action.action_id} value={action.action_id}>
                            {action.name} · {getActionTypeText(action.action_type)}
                          </option>
                        ))}
                    </select>
                    <Button
                      onClick={() => handleExecuteAction(device.device_id)}
                      disabled={
                        !isActionReady || !selectedActionIds[device.device_id] || isDevicePending
                      }
                      loading={pendingAction === "execute"}
                      className="ui-btn-xs ui-btn-primary"
                    >
                      執行
                    </Button>
                  </div>
                </div>
                <div className="col-span-3 flex flex-wrap items-start justify-end gap-2">
                  {!isOnline && !isConnecting && (
                    <Button
                      onClick={() => handleConnect(device.device_id)}
                      className="ui-btn-xs ui-btn-primary"
                      loading={pendingAction === "connect"}
                      disabled={isDevicePending}
                    >
                      連線
                    </Button>
                  )}
                  {isOnline && (
                    <>
                      <Button
                        onClick={() => handleDisconnect(device.device_id)}
                        className="ui-btn-xs ui-btn-danger"
                        loading={pendingAction === "disconnect"}
                        disabled={isDevicePending}
                      >
                        斷開
                      </Button>
                    </>
                  )}
                  {isOnline && (
                    <Button
                      onClick={() => handleMonitor(device.device_id)}
                      disabled={!scrcpySystemInfo?.installed || isDevicePending}
                      loading={pendingAction === "monitor"}
                      className={`ui-btn-xs ${
                        scrcpySystemInfo?.installed
                          ? "ui-btn-accent"
                          : "cursor-not-allowed bg-muted/50 text-foreground/50"
                      }`}
                      title={scrcpySystemInfo?.installed ? "啟動螢幕監看" : "Scrcpy 未安裝"}
                    >
                      監看
                    </Button>
                  )}
                  {isOnline && (
                    <Button
                      onClick={() => handleOpenLiveStream(device.device_id)}
                      disabled={isDevicePending}
                      className="ui-btn-xs ui-btn-outline"
                      title="在頁面中開啟即時畫面"
                    >
                      即時畫面
                    </Button>
                  )}
                  <button
                    onClick={() => navigate(`/devices/${device.device_id}`)}
                    className="ui-btn ui-btn-xs ui-btn-muted"
                  >
                    編輯
                  </button>
                  <Button
                    onClick={() => handleDelete(device.device_id)}
                    className="ui-btn-xs ui-btn-danger"
                    loading={pendingAction === "delete"}
                    disabled={isDevicePending}
                  >
                    刪除
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {liveWallDeviceIds.length > 0 ? (
        <div ref={livePanelRef} className="surface-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">即時畫面牆</h2>
              <p className="text-sm text-foreground/60">
                初版最多同時開啟 {LIVE_VIEW_MAX_STREAMS} 台，與既有 Scrcpy 監看並存。
              </p>
            </div>
            <span className="ui-badge ui-badge-primary">
              {liveWallDeviceIds.length} / {LIVE_VIEW_MAX_STREAMS}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {liveWallDeviceIds.map((deviceId) => {
              const device = devices.find((entry) => entry.device_id === deviceId)
              return (
                <LiveStreamPlayer
                  key={deviceId}
                  deviceId={deviceId}
                  title={device ? getDisplayName(device) : deviceId}
                  subtitle={device ? `${device.ip}:${device.port}` : deviceId}
                  compact
                  onClose={() => handleCloseLiveStream(deviceId)}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      {usbDevices.length > 0 && (
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">USB 連線裝置</h2>
            <span className="text-xs text-foreground/60">{usbDevices.length} 台</span>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
              <div className="col-span-5">裝置序列號</div>
              <div className="col-span-3">型號 / IP</div>
              <div className="col-span-2">TCPIP 模式</div>
              <div className="col-span-2 text-right">操作</div>
            </div>
            {usbDevices.map((device) => (
              <div
                key={device.serial}
                className="grid grid-cols-12 items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface/40"
              >
                <div className="col-span-5">
                  <div className="font-mono text-sm text-foreground">{device.serial}</div>
                  <div className="text-xs text-foreground/50">{device.connection_type.toUpperCase()}</div>
                </div>
                <div className="col-span-3 text-sm text-foreground/70">
                  <div>{device.model || "—"}</div>
                  <div className="font-mono text-xs text-foreground/50">IP: {device.ip || "—"}</div>
                </div>
                <div className="col-span-2">
                  <span
                    className={`ui-badge ${device.tcpip_enabled ? "ui-badge-success" : "ui-badge-muted"}`}
                  >
                    {getUSBTcpipStatusText(device)}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    onClick={() => handleEnableUSBTCPIP(device.serial)}
                    className="ui-btn-xs ui-btn-primary"
                    loading={!!usbActionPending[device.serial]}
                    disabled={device.tcpip_enabled || !!usbActionPending[device.serial]}
                  >
                    啟用 TCPIP
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
              const deviceId = valid ? getDeviceIdFromClient(entry.client_id) : ""
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
                      <div className="mt-1 text-xs text-foreground/50">IP: {entry.ip || "—"}</div>
                      {entry.device_id && (
                        <div className="text-xs text-foreground/50">
                          對應設備: {entry.device_id}
                        </div>
                      )}
                      <div className="text-xs text-foreground/50">
                        最近連線:{" "}
                        {entry.last_seen ? new Date(entry.last_seen).toLocaleString() : "—"}
                      </div>
                      {!valid && (
                        <div className="mt-2 text-xs text-danger">
                          格式錯誤：需為 8 位英數（A-Z, 0-9）
                        </div>
                      )}
                      {valid && entry.id_matched && !entry.ip_matched && (
                        <div className="mt-2 text-xs text-warning">
                          ID 相符但 IP 不一致，可更新現有設備
                        </div>
                      )}
                      {valid && !entry.id_matched && (
                        <div className="mt-2 text-xs text-foreground/60">
                          尚未建立設備，可直接建立
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:col-span-5">
                      <div>
                        <div className="text-xs text-foreground/60">顯示名稱</div>
                        <input
                          value={draft.alias}
                          onChange={(e) =>
                            handleIsolationDraftChange(entry.client_id, e.target.value)
                          }
                          className="ui-input w-full px-2 py-1"
                          placeholder="顯示名稱"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-3">
                      {matched ? (
                        <>
                          <div className="text-xs text-foreground/60">已匹配: {deviceId}</div>
                          <Button
                            onClick={() => handleUpdateFromIsolation(entry)}
                            className="ui-btn-sm ui-btn-accent"
                            disabled={!valid || !!isolationPending[entry.client_id]}
                            loading={isolationPending[entry.client_id] === "update"}
                          >
                            更新設備
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleCreateFromIsolation(entry)}
                          className="ui-btn-sm ui-btn-primary"
                          disabled={
                            !valid || entry.id_matched || !!isolationPending[entry.client_id]
                          }
                          loading={isolationPending[entry.client_id] === "create"}
                        >
                          建立設備
                        </Button>
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
            <Button
              onClick={handleRefreshSessions}
              className="ui-btn-md ui-btn-muted"
              loading={refreshScrcpyPending}
            >
              重新整理狀態
            </Button>
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
                  className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface/40"
                >
                  <div className="col-span-4 text-sm text-foreground">
                    {device ? getDisplayName(device) : session.device_id}
                  </div>
                  <div className="col-span-2 font-mono text-sm text-foreground/70">
                    {session.process_id}
                  </div>
                  <div className="col-span-3 text-sm text-foreground/70">
                    {new Date(session.started_at).toLocaleString()}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`ui-badge inline-flex font-semibold leading-5 ${
                        session.is_running ? "ui-badge-success" : "ui-badge-muted"
                      }`}
                    >
                      {session.is_running ? "運行中" : "已停止"}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {session.is_running && (
                      <Button
                        onClick={() => handleStopScrcpy(session.device_id)}
                        className="ui-btn-xs ui-btn-danger"
                        loading={!!scrcpyStopPending[session.device_id]}
                        disabled={!!scrcpyStopPending[session.device_id]}
                      >
                        停止
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageShell>
  )
}
