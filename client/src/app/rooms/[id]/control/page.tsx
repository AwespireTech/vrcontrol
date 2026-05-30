import { useCallback, useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
import { useParams } from "react-router-dom"
import { LuX } from "react-icons/lu"
import {
  ACTION_TYPES,
  DEVICE_STATUS,
  type Action,
  type ActivityContext,
  type ActivityStatus,
  type Device,
  type Room,
  type RoomOperationProfile,
} from "@/services/api-types"
import {
  actionApi,
  activityApi,
  controlApi,
  deviceApi,
  roomApi,
  simpleApi,
} from "@/services/api"
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  LIVE_VIEW_MAX_STREAMS,
  SERVER,
} from "@/environment"
import Button from "@/components/button"
import LiveStreamStage from "@/components/console/live-stream-stage"
import RoomMinimap from "@/components/console/room-minimap"
import type { LiveStreamLayout } from "@/components/console/live-stream-stage"
import PageShell from "@/components/console/page-shell"
import DeviceSelectionModal from "@/components/console/device-selection-modal"
import OverlayCard from "@/components/console/overlay-card"
import { useRoomMinimapConfig } from "@/hooks/useRoomMinimapConfig"
import { buildRoomMinimapDisplayMarkers } from "@/lib/room-minimap/display"
import { buildRoomMinimapMarkers } from "@/lib/room-minimap/mappers"
import { getDisplayName } from "@/lib/utils/device"
import type { PlayerData, RoomInfoData } from "@/interfaces/room.interface"
import {
  MONITORING_WINDOW_BLOCKED_MESSAGE,
  openRoomMonitoringWindow,
} from "@/lib/utils/monitoring-window"
import {
  closeLiveStreamWindow,
  openOrFocusLiveStreamWindow,
  type LiveStreamWindowState,
} from "@/lib/utils/live-stream-windows"

const TOTAL_CHAPTERS = 11
const DEVICE_CARD_INTERACTIVE_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  '[role="button"]',
  '[role="link"]',
].join(", ")

const DEFAULT_ACTIVITY_CONTEXT: ActivityContext = {
  mode: "",
  round: 1,
  qa: {
    questionSetId: "",
    questionOrder: [],
    timeLimitSec: 30,
    allowRetry: false,
    scoreMode: "team",
    display: {
      showCountdown: true,
      showResultAfterEachQuestion: true,
    },
    resumePolicy: "from_current_question",
  },
}

const DEFAULT_ROOM_OPERATION_PROFILE: RoomOperationProfile = {
  activity_defaults: {
    name: "",
    activity_context: DEFAULT_ACTIVITY_CONTEXT,
  },
  batch_action_ids: [],
  launch_action_id: "",
  stop_action_id: "",
  allow_activity_name_override: true,
  allow_seed_override: true,
}

function formatDeviceLastUpdate(lastUpdate?: string) {
  if (!lastUpdate) {
    return "-"
  }

  const parsed = dayjs(lastUpdate)
  if (!parsed.isValid()) {
    return lastUpdate
  }

  return parsed.format("HH:mm:ss")
}

function shouldIgnoreDeviceCardSelectionEvent(
  target: EventTarget | null,
  currentTarget: HTMLElement,
) {
  if (!(target instanceof Node)) {
    return false
  }

  const targetElement = target instanceof HTMLElement ? target : target.parentElement
  if (!targetElement) {
    return false
  }

  const interactiveTarget = targetElement.closest(DEVICE_CARD_INTERACTIVE_SELECTOR)
  return !!interactiveTarget && interactiveTarget !== currentTarget
}

export default function RoomControlPage() {
  const { id } = useParams<{ id: string }>()
  const roomId = id || ""

  const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
  const host = SERVER.replace(/^https?:\/\//, "")
  const minimapConfig = useRoomMinimapConfig(roomId)

  const [playerData, setPlayerData] = useState<PlayerData[]>([])
  const [deviceMap, setDeviceMap] = useState<Map<string, Device>>(new Map())
  const [roomDeviceIds, setRoomDeviceIds] = useState<string[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)
  const [selectedOption, setSelectedOption] = useState("")
  const [moveState, setMoveState] = useState("")
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [actionPanelOpen, setActionPanelOpen] = useState(false)
  const [deviceActionPending, setDeviceActionPending] = useState<
    Record<string, "connect" | "reconnect">
  >({})
  const [deviceCommandPending, setDeviceCommandPending] = useState<"" | "launch" | "stop">("")
  const [selectedDeviceMoveTarget, setSelectedDeviceMoveTarget] = useState("")
  const [selectedDeviceSequenceInput, setSelectedDeviceSequenceInput] = useState("")
  const [forceMovePending, setForceMovePending] = useState(false)
  const [forceMovePendingIds, setForceMovePendingIds] = useState<Set<string>>(new Set())
  const [sequencePendingIds, setSequencePendingIds] = useState<Set<string>>(new Set())
  const [currentActivityMeta, setCurrentActivityMeta] = useState<{
    id: string
    name: string
    status: ActivityStatus | ""
    seed?: number
    startedAt?: string
  }>({ id: "", name: "", status: "" })
  const [activityPending, setActivityPending] = useState("")
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [selectedActionId, setSelectedActionId] = useState("")
  const [batchSelectedDeviceIds, setBatchSelectedDeviceIds] = useState<string[]>([])
  const [executePending, setExecutePending] = useState(false)
  const [liveWindows, setLiveWindows] = useState<LiveStreamWindowState[]>([])
  const [liveStreamLayout, setLiveStreamLayout] = useState<LiveStreamLayout>("grid")

  const currentRoomName = useMemo(() => currentRoom?.name || roomId, [currentRoom?.name, roomId])
  const roomProfile = useMemo(
    () => currentRoom?.operation_profile || DEFAULT_ROOM_OPERATION_PROFILE,
    [currentRoom],
  )

  const playerByDeviceId = useMemo(
    () => new Map(playerData.map((player) => [player.device_id, player])),
    [playerData],
  )

  const displayDeviceIds = useMemo(() => {
    const ids = new Set<string>()
    roomDeviceIds.forEach((deviceId) => ids.add(deviceId))
    playerData.forEach((player) => ids.add(player.device_id))

    return Array.from(ids).sort((left, right) => {
      const leftPlayer = playerByDeviceId.get(left)
      const rightPlayer = playerByDeviceId.get(right)
      const leftSeq = leftPlayer ? leftPlayer.sequence : Number.MAX_SAFE_INTEGER
      const rightSeq = rightPlayer ? rightPlayer.sequence : Number.MAX_SAFE_INTEGER
      if (leftSeq !== rightSeq) return leftSeq - rightSeq

      const leftDevice = deviceMap.get(left)
      const rightDevice = deviceMap.get(right)
      const leftName = leftDevice ? getDisplayName(leftDevice) : left
      const rightName = rightDevice ? getDisplayName(rightDevice) : right
      return leftName.localeCompare(rightName)
    })
  }, [deviceMap, playerByDeviceId, playerData, roomDeviceIds])

  const minimapMarkers = useMemo(() => {
    const spatialMarkers = buildRoomMinimapMarkers(playerData, minimapConfig)
    const markers = buildRoomMinimapDisplayMarkers(spatialMarkers, playerData, deviceMap)
    const markerOrder = new Map(displayDeviceIds.map((deviceId, index) => [deviceId, index]))

    return markers.sort((left, right) => {
      const leftOrder = markerOrder.get(left.deviceId) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = markerOrder.get(right.deviceId) ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return left.displayName.localeCompare(right.displayName)
    })
  }, [deviceMap, displayDeviceIds, minimapConfig, playerData])

  const selectedAction = useMemo(
    () => actions.find((action) => action.action_id === selectedActionId) || null,
    [actions, selectedActionId],
  )

  const resolveRoomAction = useCallback(
    (explicitActionId: string | undefined, actionType: string) => {
      if (explicitActionId) {
        const explicitAction = actions.find((action) => action.action_id === explicitActionId)
        if (explicitAction) {
          return explicitAction
        }
      }

      const legacyBatchAction = roomProfile.batch_action_ids
        .map((actionId) => actions.find((action) => action.action_id === actionId) || null)
        .find((action): action is Action => action !== null && action.action_type === actionType)

      if (legacyBatchAction) {
        return legacyBatchAction
      }

      return actions.find((action) => action.action_type === actionType) || null
    },
    [actions, roomProfile.batch_action_ids],
  )

  const launchAppAction = useMemo(
    () => resolveRoomAction(roomProfile.launch_action_id, ACTION_TYPES.LAUNCH_APP),
    [resolveRoomAction, roomProfile.launch_action_id],
  )

  const stopAppAction = useMemo(
    () => resolveRoomAction(roomProfile.stop_action_id, ACTION_TYPES.STOP_APP),
    [resolveRoomAction, roomProfile.stop_action_id],
  )

  const hasRunningActivity = currentActivityMeta.status === "running" && currentActivityMeta.id !== ""
  const modalDeviceIds = useMemo(
    () => (roomDeviceIds.length > 0 ? roomDeviceIds : displayDeviceIds),
    [displayDeviceIds, roomDeviceIds],
  )
  const selectedDevice = selectedDeviceId ? deviceMap.get(selectedDeviceId) : null
  const selectedPlayer = selectedDeviceId ? playerByDeviceId.get(selectedDeviceId) : undefined
  const selectedDeviceAlias = selectedDevice
    ? getDisplayName(selectedDevice)
    : selectedDeviceId || "未選擇裝置"

  const loadControlData = useCallback(async () => {
    try {
      const [room, devices] = await Promise.all([
        roomId ? roomApi.get(roomId) : Promise.resolve(null),
        deviceApi.getAll(),
      ])
      setCurrentRoom(room)
      setRoomDeviceIds(room?.device_ids || [])
      setDeviceMap(new Map(devices.map((device) => [device.device_id, device])))
    } catch (error) {
      console.error("Failed to load control data:", error)
    }
  }, [roomId])

  const loadActions = useCallback(async () => {
    try {
      const actionsData = await actionApi.getAll()
      setActions(actionsData)
    } catch (error) {
      console.error("Failed to load actions:", error)
    }
  }, [])

  useEffect(() => {
    void loadControlData()
    void loadActions()
  }, [loadActions, loadControlData])

  useEffect(() => {
    if (!roomId) return

    const refresh = async () => {
      if (document.hidden) return
      await loadControlData()
      setCountdown(DEFAULT_POLL_INTERVAL_SECONDS)
    }

    void refresh()
    const interval = setInterval(() => {
      void refresh()
    }, DEFAULT_POLL_INTERVAL_SECONDS * 1000)

    const countdownInterval = setInterval(() => {
      if (document.hidden) return
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(countdownInterval)
    }
  }, [loadControlData, roomId])

  useEffect(() => {
    if (!roomId) return

    const ws = new WebSocket(`${wsProtocol}://${host}/api/ws/control/${roomId}`)
    setConnectionStatus("connecting")

    ws.onopen = () => setConnectionStatus("connected")
    ws.onclose = () => setConnectionStatus("disconnected")
    ws.onerror = () => setConnectionStatus("disconnected")
    ws.onmessage = (event) => {
      const data: RoomInfoData = JSON.parse(event.data)
      setPlayerData(data.players)
      setCurrentActivityMeta({
        id: data.current_activity_id || "",
        name: data.activity_name || "",
        status: data.activity_status || "",
        seed: data.activity_seed,
        startedAt: data.activity_started_at,
      })
    }

    return () => {
      ws.close()
    }
  }, [host, roomId, wsProtocol])

  useEffect(() => {
    if (moveState !== "") {
      const timer = setTimeout(() => {
        setMoveState("")
        setSelectedOption("")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [moveState])

  useEffect(() => {
    if (selectedDeviceId && !displayDeviceIds.includes(selectedDeviceId)) {
      setSelectedDeviceId(null)
      setActionPanelOpen(false)
    }
  }, [displayDeviceIds, selectedDeviceId])

  const handleChangeSequence = async (deviceId: string, seq: number) => {
    if (!roomId) return
    setSequencePendingIds((prev) => new Set(prev).add(deviceId))
    try {
      await controlApi.assignSeq(roomId, deviceId, seq)
    } catch (error) {
      console.error("Failed to assign sequence:", error)
      alert("切換 Sequence 失敗，請稍後再試")
    } finally {
      setSequencePendingIds((prev) => {
        const next = new Set(prev)
        next.delete(deviceId)
        return next
      })
    }
  }

  const handleForceAllMove = async () => {
    if (!roomId || selectedOption === "") return
    setForceMovePending(true)
    try {
      await simpleApi.forceAllMove(roomId, selectedOption)
      setMoveState("success")
    } catch (error) {
      console.error("Failed to send move command:", error)
      setMoveState("failed")
    } finally {
      setForceMovePending(false)
    }
  }

  const handleForceMoveSingle = async (deviceId: string, dest: string) => {
    if (!roomId || dest === "") return
    setForceMovePendingIds((prev) => new Set(prev).add(deviceId))
    try {
      await simpleApi.forceMove(roomId, deviceId, dest)
    } catch (error) {
      console.error("Failed to send single move command:", error)
      alert("跳轉章節失敗，請稍後再試")
    } finally {
      setForceMovePendingIds((prev) => {
        const next = new Set(prev)
        next.delete(deviceId)
        return next
      })
    }
  }

  const handleConnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "connect" }))
    try {
      await deviceApi.connect(deviceId)
      await loadControlData()
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

  const handleReconnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "reconnect" }))
    try {
      const device = deviceMap.get(deviceId)
      if (device?.status === DEVICE_STATUS.ONLINE) {
        await deviceApi.disconnect(deviceId)
      }
      await deviceApi.connect(deviceId)
      await loadControlData()
    } catch (error) {
      console.error("Failed to reconnect device:", error)
      alert("重新連線失敗，請稍後再試")
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleOpenLiveStream = (deviceId: string) => {
    const device = deviceMap.get(deviceId)
    if (!device) {
      alert("找不到設備資料，請重新整理後再試")
      return
    }

    if (device.status !== DEVICE_STATUS.ONLINE) {
      alert("設備需處於在線狀態才能開啟即時畫面")
      return
    }

    let reachedLimit = false
    setLiveWindows((prev) => {
      const result = openOrFocusLiveStreamWindow(
        prev,
        {
          deviceId,
          title: getDisplayName(device),
          subtitle: `${device.ip}:${device.port}`,
        },
        { width: window.innerWidth, height: window.innerHeight },
        LIVE_VIEW_MAX_STREAMS,
      )
      reachedLimit = result.reachedLimit
      return result.windows
    })

    if (reachedLimit) {
      alert(`即時畫面初版最多同時開啟 ${LIVE_VIEW_MAX_STREAMS} 台設備`)
    }
  }

  const handleCloseLiveStream = (deviceId: string) => {
    setLiveWindows((prev) => closeLiveStreamWindow(prev, deviceId))
  }

  const handleOpenLiveStreamPopup = () => {
    const popup = openRoomMonitoringWindow(roomId, {
      display: "wall",
      layout: liveStreamLayout,
    })

    if (!popup) {
      alert(MONITORING_WINDOW_BLOCKED_MESSAGE)
    }
  }

  const handleOpenBatchActionModal = (action: Action | null, fallbackLabel: string) => {
    if (!action) {
      alert(`找不到可用的「${fallbackLabel}」動作，請先到動作頁建立。`)
      return
    }

    const onlineDeviceIds = modalDeviceIds.filter(
      (deviceId) => deviceMap.get(deviceId)?.status === DEVICE_STATUS.ONLINE,
    )

    if (onlineDeviceIds.length === 0) {
      alert("目前沒有可執行批次動作的在線裝置")
      return
    }

    setSelectedActionId(action.action_id)
    setBatchSelectedDeviceIds(onlineDeviceIds)
    setBatchModalOpen(true)
  }

  const handleExecuteSingleAction = async (
    deviceId: string,
    action: Action | null,
    pendingKey: "launch" | "stop",
    fallbackLabel: string,
  ) => {
    if (!action) {
      alert(`找不到可用的「${fallbackLabel}」動作，請先到動作頁建立。`)
      return
    }

    setDeviceCommandPending(pendingKey)
    try {
      await actionApi.execute(action.action_id, deviceId)
    } catch (error) {
      console.error(`Failed to execute ${pendingKey} action:`, error)
      alert(`${fallbackLabel}失敗，請稍後再試`)
    } finally {
      setDeviceCommandPending("")
    }
  }

  const handleOpenDeviceActions = (deviceId: string) => {
    const player = playerByDeviceId.get(deviceId)
    setSelectedDeviceId(deviceId)
    setSelectedDeviceMoveTarget("")
    setSelectedDeviceSequenceInput(player ? player.sequence.toString() : "")
    setActionPanelOpen(true)
  }

  const handleStartConfiguredActivity = async () => {
    const activityName = roomProfile.activity_defaults.name.trim() || `${currentRoomName} Session`
    const seed = roomProfile.activity_defaults.seed
    let createdActivityId = ""

    setActivityPending("start")
    try {
      const created = await activityApi.createDraft(roomId, {
        name: activityName,
        activity_context: roomProfile.activity_defaults.activity_context || DEFAULT_ACTIVITY_CONTEXT,
      })
      createdActivityId = created.activity_id

      const started = await activityApi.start(
        created.activity_id,
        seed !== undefined ? { seed } : undefined,
      )
      setCurrentActivityMeta({
        id: started.activity_id,
        name: started.name,
        status: started.status,
        seed: started.runtime_snapshot?.seed,
        startedAt: started.started_at,
      })
      await loadControlData()
    } catch (error) {
      if (createdActivityId) {
        try {
          await activityApi.cancel(createdActivityId)
        } catch (cancelError) {
          console.error("Failed to roll back draft activity:", cancelError)
        }
      }
      console.error("Failed to start configured activity:", error)
      alert("啟動活動失敗，請稍後再試")
    } finally {
      setActivityPending("")
    }
  }

  const handleEndActivity = async (activityId: string) => {
    setActivityPending(`end:${activityId}`)
    try {
      await activityApi.end(activityId)
      setCurrentActivityMeta({ id: "", name: "", status: "" })
      await loadControlData()
    } catch (error) {
      console.error("Failed to end activity:", error)
      alert("結束活動失敗，請稍後再試")
    } finally {
      setActivityPending("")
    }
  }

  const handleConfirmBatch = async () => {
    if (batchSelectedDeviceIds.length === 0 || !selectedAction) return
    if (executePending) return

    setExecutePending(true)
    try {
      const result = await actionApi.executeBatch({
        action_id: selectedAction.action_id,
        device_ids: batchSelectedDeviceIds,
        max_workers: 5,
      })
      alert(`批次執行完成\n成功: ${result.success_count}\n失敗: ${result.failed_count}`)
      setBatchModalOpen(false)
      setBatchSelectedDeviceIds([])
    } catch (error) {
      console.error("Failed to execute action:", error)
      alert("執行失敗，請稍後再試")
    } finally {
      setExecutePending(false)
    }
  }

  const getAdbStatusText = (status?: Device["status"]) => {
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

  const getAdbStatusBadgeClass = (status?: Device["status"]) => {
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

  const getActivityBadgeClass = (status?: ActivityStatus | "") => {
    switch (status) {
      case "running":
        return "ui-badge-success"
      case "draft":
        return "ui-badge-warning"
      case "ended":
        return "ui-badge-primary"
      case "cancelled":
        return "ui-badge-danger"
      default:
        return "ui-badge-muted"
    }
  }

  const isSupportedDeviceStatus = (status?: string): status is Device["status"] => {
    return !!status && (Object.values(DEVICE_STATUS) as string[]).includes(status)
  }

  const options = Array.from({ length: TOTAL_CHAPTERS }, (_, index) => index.toString())

  if (!roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-danger">房間不存在</div>
      </div>
    )
  }

  return (
    <PageShell
      title={`${currentRoomName} 控制台`}
      subtitle={`下次更新 ${countdown} 秒`}
      eyebrow=""
      maxWidth="xl"
      headerVariant="plain"
      titleVariant="compact"
    >
      <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <section className="console-control-panel console-control-panel--padded">
              <div className="grid gap-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[15px] font-semibold text-text-primary">批次處理</div>
                    <div className="mt-1 text-sm text-text-secondary">
                      章節與時間目前先以 placeholder 顯示。
                    </div>
                  </div>
                  <span className={`ui-badge ${getActivityBadgeClass(currentActivityMeta.status)}`}>
                    {hasRunningActivity ? "進行中" : "待命"}
                  </span>
                </div>

                <div className="console-control-panel__inner grid grid-cols-2 gap-4 p-4">
                  <div>
                    <div className="text-[12px] font-semibold tracking-[0.08em] text-text-secondary">
                      Chapter 章節
                    </div>
                    <div className="mt-2 font-display text-[2rem] font-semibold leading-none text-text-primary">
                      0 / 7
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold tracking-[0.08em] text-text-secondary">
                      Time 時間
                    </div>
                    <div className="mt-2 font-display text-[2rem] font-semibold leading-none text-text-primary">
                      00:00 / 16:23
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  loading={
                    hasRunningActivity
                      ? activityPending === `end:${currentActivityMeta.id}`
                      : activityPending === "start"
                  }
                  disabled={activityPending !== ""}
                  className={
                    hasRunningActivity ? "ui-btn-md ui-btn-danger" : "ui-btn-md ui-btn-primary"
                  }
                  onClick={
                    hasRunningActivity
                      ? () => handleEndActivity(currentActivityMeta.id)
                      : handleStartConfiguredActivity
                  }
                >
                  {hasRunningActivity ? "End 結束體驗" : "Start 開始體驗"}
                </Button>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={() => handleOpenBatchActionModal(launchAppAction, "開啟 APP")}
                    className="console-button-pill console-button-pill--fit ui-btn-sm ui-btn-primary"
                    disabled={executePending}
                  >
                    開啟 APP
                  </Button>
                  <Button
                    onClick={() => handleOpenBatchActionModal(stopAppAction, "關閉 APP")}
                    className="console-button-pill console-button-pill--fit ui-btn-sm ui-btn-primary"
                    disabled={executePending}
                  >
                    關閉 APP
                  </Button>
                  <select
                    className={`console-control--compact console-control--select h-8 w-24 rounded-full px-3 py-0 text-center text-xs ${
                      selectedOption === "" ? "text-text-quiet" : ""
                    }`}
                    value={selectedOption}
                    onChange={(event) => setSelectedOption(event.target.value)}
                  >
                    <option value=""></option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="ui-btn-xs ui-btn-primary h-8 rounded-full px-3"
                    disabled={selectedOption === ""}
                    loading={forceMovePending}
                    onClick={handleForceAllMove}
                  >
                    Go
                  </Button>
                </div>

                {moveState === "success" ? (
                  <div className="text-xs text-success">已送出批次章節指令</div>
                ) : moveState === "failed" ? (
                  <div className="text-xs text-danger">批次章節指令送出失敗</div>
                ) : null}
              </div>
            </section>

            <section className="console-control-panel">
              <div className="console-control-panel__toolbar">
                <div className="console-control-panel__title">房間內裝置</div>
                <span
                  className={`ui-badge ${
                    connectionStatus === "connected"
                      ? "ui-badge-success"
                      : connectionStatus === "connecting"
                        ? "ui-badge-warning"
                        : "ui-badge-danger"
                  }`}
                >
                  {connectionStatus === "connected"
                    ? "已連線"
                    : connectionStatus === "connecting"
                      ? "連線中"
                      : "已中斷"}
                </span>
              </div>
              <div className="max-h-74 overflow-y-auto">
                {displayDeviceIds.map((deviceId) => {
                  const player = playerByDeviceId.get(deviceId)
                  const device = deviceMap.get(deviceId)
                  const alias = device ? getDisplayName(device) : deviceId
                  const adbStatus = isSupportedDeviceStatus(device?.status) ? device.status : undefined
                  const wsStatus = device?.ws_status
                  const isAdbOnline = adbStatus === DEVICE_STATUS.ONLINE
                  const isAdbConnecting = adbStatus === DEVICE_STATUS.CONNECTING
                  const devicePendingAction = deviceActionPending[deviceId]
                  const isSelectedDevice = selectedDeviceId === deviceId

                  return (
                    <div
                      key={deviceId}
                      role="button"
                      tabIndex={0}
                      data-device-id={deviceId}
                      aria-selected={isSelectedDevice}
                      onClick={(event) => {
                        if (shouldIgnoreDeviceCardSelectionEvent(event.target, event.currentTarget)) {
                          return
                        }
                        setSelectedDeviceId(deviceId)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        if (shouldIgnoreDeviceCardSelectionEvent(event.target, event.currentTarget)) {
                          return
                        }
                        event.preventDefault()
                        setSelectedDeviceId(deviceId)
                      }}
                      className={`grid grid-cols-[minmax(0,1.05fr)_116px_108px_112px] items-start gap-4 border-b border-border-subtle/65 px-5 py-3.5 last:border-b-0 ${
                        isSelectedDevice ? "bg-bg-panel/80" : "hover:bg-bg-panel/45"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{alias}</div>
                        <div className="console-meta mt-1">{deviceId}</div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="console-status-label">WS</span>
                          <span className={`ui-badge console-status-badge ${getWsStatusBadgeClass(wsStatus)}`}>
                            {getWsStatusText(wsStatus)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="console-status-label">ADB</span>
                          <span className={`ui-badge console-status-badge ${getAdbStatusBadgeClass(adbStatus)}`}>
                            {getAdbStatusText(adbStatus)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-text-secondary">
                        <div>
                          Battery：<span className="text-text-primary">{isAdbOnline && device?.battery !== undefined ? `${device.battery}%` : "-"}</span>
                        </div>
                        <div>
                          Status：<span className={player?.ready_to_move ? "text-success" : "text-msg-danger"}>{player ? (player.ready_to_move ? "Ready" : "Not Ready") : "-"}</span>
                        </div>
                        <div>
                          Chapter：<span className="text-text-primary">{player ? player.chapter : "-"}</span>
                        </div>
                        <div>
                          Time：<span className="text-text-primary">{formatDeviceLastUpdate(player?.last_update)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2.5">
                        <div className="text-right text-[11px] text-text-secondary">
                          Sequence
                          <div className="mt-1 text-[1.75rem] font-semibold leading-none text-text-primary">
                            {player ? player.sequence : "-"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            onClick={() => handleConnect(deviceId)}
                            className={`ui-btn-xs h-7 min-w-[4.5rem] rounded-full px-3 ${
                              isAdbOnline ? "ui-btn-muted" : "ui-btn-primary"
                            }`}
                            loading={devicePendingAction === "connect"}
                            disabled={!!devicePendingAction || isAdbOnline || isAdbConnecting}
                          >
                            {isAdbConnecting ? "連線中" : isAdbOnline ? "已連線" : "連線"}
                          </Button>
                          <Button
                            onClick={() => handleOpenDeviceActions(deviceId)}
                            className="ui-btn-xs ui-btn-primary h-7 min-w-[4.5rem] rounded-full px-3"
                          >
                            動作
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <section className="console-control-panel console-control-panel--padded">
            <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
              <div>
                <div className="mb-3 console-control-panel__title">房間平面圖</div>
                <RoomMinimap
                  config={minimapConfig}
                  markers={minimapMarkers}
                  selectedDeviceId={selectedDeviceId}
                  onSelectDevice={setSelectedDeviceId}
                  detailLevel="map-only"
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="console-control-panel__title">監控畫面</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ui-badge ui-badge-primary">
                      {liveWindows.length} / {LIVE_VIEW_MAX_STREAMS}
                    </span>
                    <div className="live-stream-layout-toggle" role="group" aria-label="即時串流排版">
                      <button
                        type="button"
                        onClick={() => setLiveStreamLayout("stack")}
                        className={`ui-btn ui-btn-xs ${
                          liveStreamLayout === "stack" ? "ui-btn-primary" : "ui-btn-muted"
                        }`}
                      >
                        堆疊
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveStreamLayout("grid")}
                        className={`ui-btn ui-btn-xs ${
                          liveStreamLayout === "grid" ? "ui-btn-primary" : "ui-btn-muted"
                        }`}
                      >
                        網格
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenLiveStreamPopup}
                      className="ui-btn ui-btn-xs ui-btn-outline"
                    >
                      在新視窗開啟
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiveWindows([])}
                      className="ui-btn ui-btn-xs ui-btn-muted"
                      disabled={liveWindows.length === 0}
                    >
                      收起
                    </button>
                  </div>
                </div>

                {liveWindows.length > 0 ? (
                  <LiveStreamStage
                    windows={liveWindows}
                    layout={liveStreamLayout}
                    selectedDeviceId={selectedDeviceId}
                    onSelectDevice={setSelectedDeviceId}
                    onClose={handleCloseLiveStream}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div
                        key={index}
                        className="aspect-[16/9] rounded-[12px] border border-border-subtle/70 bg-[#d7d7d7]"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
      </div>

      <OverlayCard
        open={actionPanelOpen && !!selectedDeviceId}
        onClose={() => setActionPanelOpen(false)}
        containerClassName="items-start justify-end p-5 md:p-8"
        panelClassName="mt-20 max-w-[22rem] p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[1.85rem] font-semibold tracking-[-0.04em] text-text-primary">
              {selectedDeviceAlias}
            </div>
            <div className="mt-2 text-sm text-text-secondary">執行動作</div>
          </div>
          <button
            type="button"
            onClick={() => setActionPanelOpen(false)}
            className="ui-btn ui-btn-xs ui-btn-muted h-9 w-9 justify-center rounded-full px-0"
            aria-label="關閉裝置動作面板"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {selectedDeviceId ? (
          <div className="mt-8 space-y-6">
            <div className="space-y-3">
              <Button
                onClick={() => handleReconnect(selectedDeviceId)}
                className="ui-btn-md ui-btn-primary w-full justify-start"
                loading={deviceActionPending[selectedDeviceId] === "reconnect"}
                disabled={!!deviceActionPending[selectedDeviceId]}
              >
                重新連線
              </Button>
              <Button
                onClick={() =>
                  handleExecuteSingleAction(selectedDeviceId, launchAppAction, "launch", "開啟 APP")
                }
                className="ui-btn-md ui-btn-primary w-full justify-start"
                loading={deviceCommandPending === "launch"}
                disabled={!launchAppAction || deviceCommandPending !== ""}
              >
                開啟 APP
              </Button>
              <Button
                onClick={() =>
                  handleExecuteSingleAction(selectedDeviceId, stopAppAction, "stop", "關閉 APP")
                }
                className="ui-btn-md ui-btn-muted w-full justify-start"
                loading={deviceCommandPending === "stop"}
                disabled={!stopAppAction || deviceCommandPending !== ""}
              >
                關閉 APP
              </Button>
              <Button
                onClick={() => handleOpenLiveStream(selectedDeviceId)}
                className="ui-btn-md ui-btn-muted w-full justify-start"
                disabled={selectedDevice?.status !== DEVICE_STATUS.ONLINE}
              >
                查看監控畫面
              </Button>
            </div>

            <div className="space-y-3">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-text-primary">跳轉章節</span>
                <div className="flex items-center gap-2">
                  <select
                    className="console-control--compact console-control--select h-10 min-w-0 flex-1"
                    value={selectedDeviceMoveTarget}
                    onChange={(event) => setSelectedDeviceMoveTarget(event.target.value)}
                  >
                    <option value=""></option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => handleForceMoveSingle(selectedDeviceId, selectedDeviceMoveTarget)}
                    className="ui-btn-sm ui-btn-primary h-10 rounded-full px-3"
                    loading={forceMovePendingIds.has(selectedDeviceId)}
                    disabled={selectedDeviceMoveTarget === "" || forceMovePendingIds.has(selectedDeviceId)}
                  >
                    Go
                  </Button>
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-text-primary">切換 Sequence</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="console-control--compact h-10 min-w-0 flex-1"
                    value={selectedDeviceSequenceInput}
                    onChange={(event) => setSelectedDeviceSequenceInput(event.target.value)}
                    placeholder="Sequence"
                  />
                  <Button
                    onClick={() =>
                      handleChangeSequence(
                        selectedDeviceId,
                        Number.parseInt(selectedDeviceSequenceInput || "0", 10),
                      )
                    }
                    className="ui-btn-sm ui-btn-primary h-10 rounded-full px-3"
                    loading={sequencePendingIds.has(selectedDeviceId)}
                    disabled={
                      selectedDeviceSequenceInput === "" ||
                      Number.isNaN(Number.parseInt(selectedDeviceSequenceInput, 10)) ||
                      sequencePendingIds.has(selectedDeviceId)
                    }
                  >
                    Go
                  </Button>
                </div>
              </label>
            </div>

            <div className="console-control-panel__inner p-4 text-sm text-text-secondary">
              <div>WS：{selectedDevice ? getWsStatusText(selectedDevice.ws_status) : "-"}</div>
              <div className="mt-2">ADB：{selectedDevice ? getAdbStatusText(selectedDevice.status) : "-"}</div>
                <div className="mt-2">Time：{formatDeviceLastUpdate(selectedPlayer?.last_update)}</div>
              <div className="mt-2">
                Battery：
                {selectedDevice && selectedDevice.battery !== undefined ? `${selectedDevice.battery}%` : "-"}
              </div>
              <div className="mt-2">
                Status：{selectedPlayer ? (selectedPlayer.ready_to_move ? "Ready" : "Not Ready") : "-"}
              </div>
            </div>
          </div>
        ) : null}
      </OverlayCard>

      <DeviceSelectionModal
        open={batchModalOpen}
        title={`執行動作: ${selectedAction?.name || ""}`}
        confirmText="執行"
        targets={modalDeviceIds.map((deviceId) => {
          const device = deviceMap.get(deviceId)
          return {
            id: deviceId,
            label: device ? getDisplayName(device) : deviceId,
            ip: device?.ip,
            status: device?.status,
            isOnline: device?.status === DEVICE_STATUS.ONLINE,
          }
        })}
        selectedIds={batchSelectedDeviceIds}
        onSelectedIdsChange={setBatchSelectedDeviceIds}
        confirmPending={executePending}
        onConfirm={handleConfirmBatch}
        onClose={() => {
          setBatchModalOpen(false)
          setBatchSelectedDeviceIds([])
        }}
      />
    </PageShell>
  )
}
