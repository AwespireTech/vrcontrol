import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  LuCircleAlert,
  LuPencilLine,
  LuTrash2,
  LuUsb,
} from "react-icons/lu"
import { getDisplayName } from "@/lib/utils/device"
import { deviceApi, preferenceApi, roomApi } from "@/services/api"
import {
  DEVICE_STATUS,
  type Device,
  type IsolationDevice,
  type USBDevice,
  type UserPreference,
} from "@/services/api-types"
import PageShell from "@/components/console/page-shell"
import ListShell from "@/components/console/list-shell"
import ConsoleField from "@/components/console/console-field"
import ConsoleListRow from "@/components/console/console-list-row"
import IconActionButton from "@/components/console/icon-action-button"
import Button from "@/components/button"
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from "@/environment"

type StatusErrorType = "idle" | "ok" | "timeout" | "adb-error"
type IsolationDraft = { alias: string; roomId: string }

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [rooms, setRooms] = useState<Array<{ room_id: string; name: string }>>([])
  const [roomNameMap, setRoomNameMap] = useState<Map<string, string>>(new Map())
  const [isolationDevices, setIsolationDevices] = useState<IsolationDevice[]>([])
  const [usbDevices, setUSBDevices] = useState<USBDevice[]>([])
  const [isolationDrafts, setIsolationDrafts] = useState<Record<string, IsolationDraft>>({})
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)
  const [roomUpdatingIds, setRoomUpdatingIds] = useState<Record<string, boolean>>({})
  const [deviceActionPending, setDeviceActionPending] = useState<
    Record<string, "connect" | "disconnect" | "delete">
  >({})
  const [isolationPending, setIsolationPending] = useState<Record<string, "create" | "update">>({})
  const [usbActionPending, setUSBActionPending] = useState<Record<string, boolean>>({})
  const [preference, setPreference] = useState<UserPreference | null>(null)
  const [statusErrors, setStatusErrors] = useState<Record<string, StatusErrorType>>({})

  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const devicesRef = useRef<Device[]>([])

  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

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
          const matchedDevice = devicesData.find(
            (device) => device.device_id === getDeviceIdFromClient(entry.client_id),
          )
          if (!next[entry.client_id]) {
            next[entry.client_id] = {
              alias: matchedDevice ? getDisplayName(matchedDevice) : entry.client_id,
              roomId: matchedDevice?.room_id || "",
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
      .filter((device) => device.status === DEVICE_STATUS.ONLINE)
      .map((device) => device.device_id)

    if (onlineDeviceIds.length === 0) return

    const batchSize =
      typeof preference.batch_size === "number" && preference.batch_size > 0
        ? preference.batch_size
        : DEFAULT_BATCH_SIZE

    const maxWorkers =
      typeof preference.max_concurrency === "number" && preference.max_concurrency > 0
        ? preference.max_concurrency
        : DEFAULT_MAX_CONCURRENCY

    for (let index = 0; index < onlineDeviceIds.length; index += batchSize) {
      const batchIds = onlineDeviceIds.slice(index, index + batchSize)

      try {
        const result = await deviceApi.getStatusBatch(batchIds, maxWorkers)

        if (result.success && result.results) {
          setDevices((prevDevices) => {
            const nextDevices = [...prevDevices]
            result.results.forEach((statusResult) => {
              const deviceIndex = nextDevices.findIndex(
                (device) => device.device_id === statusResult.device_id,
              )
              if (deviceIndex < 0) return

              if (statusResult.error) {
                const errorType = statusResult.error.toLowerCase().includes("timeout")
                  ? "timeout"
                  : "adb-error"
                setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: errorType }))
                return
              }

              nextDevices[deviceIndex] = {
                ...nextDevices[deviceIndex],
                battery: statusResult.battery,
                temperature: statusResult.temperature,
                is_charging: statusResult.is_charging,
              }
              setStatusErrors((prev) => ({ ...prev, [statusResult.device_id]: "ok" }))
            })

            return nextDevices
          })
        }
      } catch (error) {
        console.error("Failed to refresh status batch:", error)
      }
    }
  }, [preference])

  useEffect(() => {
    const init = async () => {
      try {
        const pref = await preferenceApi.get()
        setPreference(pref)
      } catch (error) {
        console.error("Failed to load preference:", error)
        setPreference({
          poll_interval_sec: DEFAULT_POLL_INTERVAL_SECONDS,
          batch_size: DEFAULT_BATCH_SIZE,
          max_concurrency: DEFAULT_MAX_CONCURRENCY,
          reconnect_cooldown_sec: 30,
          reconnect_max_retries: 5,
          updated_at: "",
        })
      }

      await loadDevices()
    }

    init()
  }, [loadDevices])

  useEffect(() => {
    if (devices.length > 0 && preference) {
      refreshOnlineStatuses()
    }
  }, [devices.length, preference, refreshOnlineStatuses])

  useEffect(() => {
    if (!preference) return

    const pollIntervalSeconds =
      typeof preference.poll_interval_sec === "number" && preference.poll_interval_sec > 0
        ? preference.poll_interval_sec
        : DEFAULT_POLL_INTERVAL_SECONDS

    setCountdown(pollIntervalSeconds)

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
    }

    statusIntervalRef.current = setInterval(() => {
      if (document.hidden) return
      refreshOnlineStatuses()
      loadDevices()
      setCountdown(pollIntervalSeconds)
    }, pollIntervalSeconds * 1000)

    const handleVisibilityChange = () => {
      if (document.hidden) return
      loadDevices()
      setCountdown(pollIntervalSeconds)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    const countdownInterval = setInterval(() => {
      if (document.hidden) return
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
      clearInterval(countdownInterval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadDevices, preference, refreshOnlineStatuses])

  const sortedRooms = useMemo(
    () => rooms.slice().sort((left, right) => left.name.localeCompare(right.name)),
    [rooms],
  )

  const getStatusText = (status: Device["status"]) => {
    switch (status) {
      case DEVICE_STATUS.ONLINE:
        return "已連線"
      case DEVICE_STATUS.OFFLINE:
        return "未連線"
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
    return "ui-badge-muted"
  }

  const getUSBTcpipStatusText = (device: USBDevice) => {
    if (!device.tcpip_enabled) return "未啟用"
    return device.tcpip_port ? `已啟用 (${device.tcpip_port})` : "已啟用"
  }

  const isValidClientId = (clientId: string) => /^[0-9A-Za-z]{8}$/.test(clientId)

  const getDeviceIdFromClient = (clientId: string) => `DEV-${clientId.toUpperCase()}`

  const handleIsolationDraftChange = (
    clientId: string,
    field: keyof IsolationDraft,
    value: string,
  ) => {
    setIsolationDrafts((prev) => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || { alias: clientId, roomId: "" }),
        [field]: value,
      },
    }))
  }

  const syncDeviceRoomAssignment = useCallback(
    async (deviceId: string, currentRoomId: string, nextRoomId: string) => {
      if (nextRoomId === currentRoomId) return

      if (nextRoomId === "") {
        if (currentRoomId) {
          await roomApi.removeDevice(currentRoomId, deviceId)
        }
        return
      }

      if (currentRoomId && currentRoomId !== nextRoomId) {
        await roomApi.removeDevice(currentRoomId, deviceId)
      }
      await roomApi.addDevice(nextRoomId, deviceId)
    },
    [],
  )

  const handleCreateFromIsolation = async (entry: IsolationDevice) => {
    if (!entry.valid || !isValidClientId(entry.client_id)) return
    if (isolationPending[entry.client_id]) return

    const draft = isolationDrafts[entry.client_id]
    setIsolationPending((prev) => ({ ...prev, [entry.client_id]: "create" }))
    try {
      const createdDevice = await deviceApi.create({
        device_id: entry.client_id,
        alias: draft?.alias || entry.client_id,
        ip: entry.ip,
      })

      if (draft?.roomId) {
        await syncDeviceRoomAssignment(createdDevice.device_id, "", draft.roomId)
      }

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
    const draft = isolationDrafts[entry.client_id]
    setIsolationPending((prev) => ({ ...prev, [entry.client_id]: "update" }))
    try {
      await deviceApi.patch(deviceId, { ip: entry.ip })

      const matchedDevice = devicesRef.current.find((device) => device.device_id === deviceId)
      if (matchedDevice) {
        await syncDeviceRoomAssignment(deviceId, matchedDevice.room_id || "", draft?.roomId || "")
      }

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
        return "找不到 ADB"
      case "adb_connect_failed":
        return "ADB 連線失敗"
      case "unknown":
        return "未知錯誤"
      default:
        return ""
    }
  }

  const handleConnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return

    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "connect" }))
    try {
      await deviceApi.connect(deviceId)
      await loadDevices()
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
      alert("中斷失敗，請稍後再試")
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
      await syncDeviceRoomAssignment(device.device_id, currentRoomId, nextRoomId)
      await loadDevices()
    } catch (error) {
      console.error("Failed to assign room:", error)
      alert("房間指派失敗，請稍後再試")
    } finally {
      setRoomUpdatingIds((prev) => ({ ...prev, [device.device_id]: false }))
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-xl text-foreground">載入中…</div>
      </div>
    )
  }

  return (
    <PageShell
      title="Devices 裝置"
      subtitle={`下次更新 ${countdown} 秒`}
      eyebrow=""
      maxWidth="lg"
      headerVariant="plain"
      titleVariant="compact"
    >
      {isolationDevices.length > 0 ? (
        <section className="devices-alert-shell">
          <div className="devices-alert-heading">
            <LuCircleAlert className="h-4 w-4" />
            <div className="text-[13px]">偵測到新裝置</div>
          </div>

          <div className="space-y-3">
            {isolationDevices.map((entry) => {
              const valid = entry.valid && isValidClientId(entry.client_id)
              const matched = entry.id_matched && !entry.ip_matched && valid
              const draft = isolationDrafts[entry.client_id] || {
                alias: entry.client_id,
                roomId: "",
              }

              return (
                <div key={entry.client_id} className="devices-alert-grid">
                  <div>
                    <div className="console-field__label">
                      Info 資訊
                    </div>
                    <div className="text-sm font-semibold text-text-primary">{entry.ip || "—"}</div>
                    <div className="console-meta">{valid ? `DEV-${entry.client_id.toUpperCase()}` : entry.client_id}</div>
                    {matched ? (
                      <div className="mt-2 text-[11px] text-msg-warning">已匹配現有設備，可更新 IP</div>
                    ) : null}
                    {!valid ? (
                      <div className="mt-2 text-[11px] text-msg-danger">Client ID 格式錯誤，需為 8 位英數</div>
                    ) : null}
                    {valid && !entry.id_matched ? (
                      <div className="mt-2 text-[11px] text-text-secondary">可建立為新設備</div>
                    ) : null}
                  </div>

                  <ConsoleField label="Name 名稱">
                    <input
                      value={draft.alias}
                      onChange={(event) =>
                        handleIsolationDraftChange(entry.client_id, "alias", event.target.value)
                      }
                      className="console-control--compact"
                      placeholder="輸入設備顯示名稱"
                    />
                  </ConsoleField>

                  <ConsoleField label="Group 群組">
                    <select
                      value={draft.roomId}
                      onChange={(event) =>
                        handleIsolationDraftChange(entry.client_id, "roomId", event.target.value)
                      }
                      className="console-control--compact console-control--select"
                    >
                      <option value="">未指派</option>
                      {sortedRooms.map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </ConsoleField>

                  <div className="flex items-end justify-end md:pb-px">
                    {matched ? (
                      <Button
                        onClick={() => handleUpdateFromIsolation(entry)}
                        className="ui-btn-sm ui-btn-accent min-w-[128px]"
                        disabled={!valid || !!isolationPending[entry.client_id]}
                        loading={isolationPending[entry.client_id] === "update"}
                      >
                        更新設備
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleCreateFromIsolation(entry)}
                        className="ui-btn-sm ui-btn-primary min-w-[128px]"
                        disabled={!valid || entry.id_matched || !!isolationPending[entry.client_id]}
                        loading={isolationPending[entry.client_id] === "create"}
                      >
                        Add Device 新增裝置
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <ListShell
        title="裝置列表"
        className="gap-2"
        variant="compact"
        headerVariant="compact"
        headingVariant="compact"
        columns={
          devices.length > 0 ? (
            <>
              <div className="col-span-4">Name 名稱</div>
              <div className="col-span-2">Status 狀態</div>
              <div className="col-span-2">Group 群組</div>
              <div className="col-span-4">Active 動作</div>
            </>
          ) : undefined
        }
        emptyState={
          <div className="console-empty-state">
            <div className="console-empty-state__title">尚無裝置</div>
            <p className="console-empty-state__description">目前沒有已建立的設備，待偵測到新裝置後即可加入列表。</p>
          </div>
        }
      >
        {devices.length > 0
          ? devices.map((device) => {
          const pendingAction = deviceActionPending[device.device_id]
          const isConnecting = device.status === DEVICE_STATUS.CONNECTING
          const isOnline = device.status === DEVICE_STATUS.ONLINE
          const disabledReasonText = getAutoReconnectDisabledReasonText(
            device.auto_reconnect_disabled_reason,
          )
          const statusErrorType = statusErrors[device.device_id] || "idle"
          const statusFootnote =
            statusErrorType === "timeout"
              ? "ADB 狀態查詢逾時"
              : statusErrorType === "adb-error"
                ? "ADB 狀態查詢失敗"
                : disabledReasonText

          return (
            <ConsoleListRow key={device.device_id} variant="compact" className="grid-cols-12 items-center">
              <div className="col-span-4">
                <div className="console-table-title">{getDisplayName(device)}</div>
                <div className="console-meta mt-1">{device.ip}:{device.port}</div>
                <div className="console-meta">{device.device_id}</div>
                {statusFootnote ? (
                  <div className="mt-1.5 text-[11px] text-msg-warning">{statusFootnote}</div>
                ) : null}
              </div>

              <div className="col-span-2">
                <div className="console-status-stack">
                  <div className="console-status-line">
                    <span className="console-status-label">
                      WS
                    </span>
                    <span className={`ui-badge console-status-badge ${getWsStatusBadgeClass(device.ws_status)}`}>
                      {getWsStatusText(device.ws_status)}
                    </span>
                  </div>
                  <div className="console-status-line">
                    <span className="console-status-label">
                      ADB
                    </span>
                    <span className={`ui-badge console-status-badge ${getAdbStatusBadgeClass(device.status)}`}>
                      {getStatusText(device.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                {device.room_id ? (
                  <button
                    onClick={() => navigate(`/rooms/${device.room_id}/control`)}
                    className="console-link-muted"
                  >
                    <div className="text-sm font-semibold text-text-primary">
                      {roomNameMap.get(device.room_id) || device.room_id}
                    </div>
                    <div className="console-meta mt-1">{device.room_id}</div>
                  </button>
                ) : (
                  <div className="text-sm font-semibold text-text-secondary">-</div>
                )}
              </div>

              <div className="col-span-4 console-action-stack">
                <div className="console-action-stack__controls">
                  <select
                    value={device.room_id || ""}
                    onChange={(event) => handleAssignRoom(device, event.target.value)}
                    disabled={roomUpdatingIds[device.device_id]}
                    className="console-control--compact console-control--select text-sm"
                  >
                    <option value="">未指派</option>
                    {sortedRooms.map((room) => (
                      <option key={room.room_id} value={room.room_id}>
                        {room.name}
                      </option>
                    ))}
                  </select>

                  {!isOnline && !isConnecting ? (
                    <Button
                      onClick={() => handleConnect(device.device_id)}
                      className="console-button-pill ui-btn-sm ui-btn-primary"
                      loading={pendingAction === "connect"}
                      disabled={!!pendingAction}
                    >
                      ADB 連線
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleDisconnect(device.device_id)}
                      className="console-button-pill ui-btn-sm ui-btn-muted"
                      loading={pendingAction === "disconnect"}
                      disabled={!!pendingAction && pendingAction !== "disconnect"}
                    >
                      {isConnecting ? "ADB 連線中" : "中斷 ADB"}
                    </Button>
                  )}
                </div>

                <div className="console-action-stack__icons">
                  <IconActionButton
                    onClick={() => navigate(`/devices/${device.device_id}`)}
                    disabled={!!pendingAction}
                    aria-label={`編輯 ${getDisplayName(device)}`}
                    title="編輯"
                  >
                    <LuPencilLine className="h-4 w-4" />
                  </IconActionButton>
                  <IconActionButton
                    onClick={() => handleDelete(device.device_id)}
                    danger
                    loading={pendingAction === "delete"}
                    disabled={!!pendingAction && pendingAction !== "delete"}
                    aria-label={`刪除 ${getDisplayName(device)}`}
                    title="刪除"
                  >
                    <LuTrash2 className="h-4 w-4" />
                  </IconActionButton>
                </div>
              </div>
            </ConsoleListRow>
          )
        })
          : null}
      </ListShell>

      {usbDevices.length > 0 ? (
        <ListShell
          title="USB 連線"
          className="gap-2"
          variant="compact"
          headerVariant="compact"
          headingVariant="compact"
          columns={
            <>
              <div className="col-span-4">Serial 序列號</div>
              <div className="col-span-3">Model 型號</div>
              <div className="col-span-3">TCPIP 狀態</div>
              <div className="col-span-2">動作</div>
            </>
          }
        >
          {usbDevices.map((device) => (
            <ConsoleListRow key={device.serial} variant="compact" className="grid-cols-12 items-center">
              <div className="col-span-4">
                <div className="console-table-title font-mono">{device.serial}</div>
                <div className="console-meta mt-1">{device.connection_type.toUpperCase()}</div>
              </div>

              <div className="col-span-3">
                <div className="text-sm font-semibold text-text-primary">{device.model || "—"}</div>
                <div className="console-meta mt-1">IP: {device.ip || "—"}</div>
              </div>

              <div className="col-span-3 console-inline-status">
                <span className={`ui-badge console-status-badge ${device.tcpip_enabled ? "ui-badge-success" : "ui-badge-muted"}`}>
                  {getUSBTcpipStatusText(device)}
                </span>
                <LuUsb className="h-4 w-4 text-text-muted" />
              </div>

              <div className="col-span-2 flex justify-end">
                <Button
                  onClick={() => handleEnableUSBTCPIP(device.serial)}
                  className="console-button-pill ui-btn-sm ui-btn-primary"
                  loading={!!usbActionPending[device.serial]}
                  disabled={device.tcpip_enabled || !!usbActionPending[device.serial]}
                >
                  啟用 TCPIP
                </Button>
              </div>
            </ConsoleListRow>
          ))}
        </ListShell>
      ) : null}
    </PageShell>
  )
}
