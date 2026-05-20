import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { DEFAULT_POLL_INTERVAL_SECONDS, LIVE_VIEW_MAX_STREAMS, SERVER } from "@/environment"
import Button from "@/components/button"
import PlayerInfo from "@/components/player-info"
import LiveStreamStage from "@/components/console/live-stream-stage"
import RoomMinimap from "@/components/console/room-minimap"
import LiveStreamTakeoverPlaceholder from "@/components/console/live-stream-takeover-placeholder"
import type { LiveStreamLayout } from "@/components/console/live-stream-stage"
import { useRoomMinimapConfig } from "@/hooks/useRoomMinimapConfig"
import { buildRoomMinimapDisplayMarkers } from "@/lib/room-minimap/display"
import { buildRoomMinimapMarkers } from "@/lib/room-minimap/mappers"
import {
  actionApi,
  activityApi,
  controlApi,
  deviceApi,
  roomApi,
  scrcpyApi,
  simpleApi,
} from "@/services/api"
import {
  DEVICE_STATUS,
  type Action,
  type ActivityContext,
  type ActivityStatus,
  type Device,
  type Room,
  type RoomOperationProfile,
} from "@/services/api-types"
import { getDisplayName } from "@/lib/utils/device"
import type { PlayerData, RoomInfoData } from "@/interfaces/room.interface"
import PageShell from "@/components/console/page-shell"
import DeviceSelectionModal from "@/components/console/device-selection-modal"
import {
  createLiveStreamPopupChannel,
  LIVE_STREAM_POPUP_BLOCKED_MESSAGE,
  openLiveStreamPopupWindow,
  postLiveStreamPopupMessage,
  subscribeLiveStreamPopupChannel,
  type LiveStreamPopupState,
} from "@/lib/utils/live-stream-popup"
import {
  closeLiveStreamWindow,
  openManyLiveStreamWindows,
  openOrFocusLiveStreamWindow,
  type LiveStreamWindowState,
} from "@/lib/utils/live-stream-windows"

const TotalChapters = 11
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
  allow_activity_name_override: true,
  allow_seed_override: true,
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
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const roomId = id || ""

  const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
  const host = SERVER.replace(/^https?:\/\//, "")
  const minimapConfig = useRoomMinimapConfig(roomId)

  const [playerData, setPlayerData] = useState<PlayerData[]>([])
  const [deviceMap, setDeviceMap] = useState<Map<string, Device>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [selectedOption, setSelectedOption] = useState("")
  const [moveState, setMoveState] = useState("")
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)

  const [forceMovePending, setForceMovePending] = useState(false)
  const [forceMovePendingIds, setForceMovePendingIds] = useState<Set<string>>(new Set())
  const [sequencePendingIds, setSequencePendingIds] = useState<Set<string>>(new Set())
  const [deviceActionPending, setDeviceActionPending] = useState<
    Record<string, "connect" | "disconnect" | "monitor">
  >({})

  const [roomList, setRoomList] = useState<{ value: string; label: string }[]>([])
  const [roomDeviceIds, setRoomDeviceIds] = useState<string[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)

  const [actions, setActions] = useState<Action[]>([])
  const [selectedActionId, setSelectedActionId] = useState<string>("")
  const [activityNameOverride, setActivityNameOverride] = useState("")
  const [activitySeedOverride, setActivitySeedOverride] = useState("")
  const [activityPending, setActivityPending] = useState<string>("")
  const [currentActivityMeta, setCurrentActivityMeta] = useState<{
    id: string
    name: string
    status: ActivityStatus | ""
    seed?: number
    startedAt?: string
  }>({ id: "", name: "", status: "" })
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchMode, setBatchMode] = useState<"action" | "monitor" | "live">("action")
  const [batchSelectedDeviceIds, setBatchSelectedDeviceIds] = useState<string[]>([])
  const [executePending, setExecutePending] = useState(false)
  const [batchMonitorPending, setBatchMonitorPending] = useState(false)
  const [targetMonitorIndex, setTargetMonitorIndex] = useState(0)
  const [liveWindows, setLiveWindows] = useState<LiveStreamWindowState[]>([])
  const [liveStreamLayout, setLiveStreamLayout] = useState<LiveStreamLayout>("grid")
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [popupTakeoverActive, setPopupTakeoverActive] = useState(false)
  const popupChannelRef = useRef<BroadcastChannel | null>(null)

  const buildLiveStreamPopupState = useCallback((): LiveStreamPopupState => {
    return {
      source: "rooms",
      roomId,
      layout: liveStreamLayout,
      takeoverActive: popupTakeoverActive,
      selectedDeviceId,
      streams: popupTakeoverActive
        ? liveWindows.map((entry) => ({
            deviceId: entry.deviceId,
            title: entry.title,
            subtitle: entry.subtitle,
          }))
        : [],
      timestamp: Date.now(),
    }
  }, [liveStreamLayout, liveWindows, popupTakeoverActive, roomId, selectedDeviceId])

  const playerByDeviceId = useMemo(() => {
    return new Map(playerData.map((player) => [player.device_id, player]))
  }, [playerData])

  const displayDeviceIds = useMemo(() => {
    const ids = new Set<string>()
    roomDeviceIds.forEach((id) => ids.add(id))
    playerData.forEach((player) => ids.add(player.device_id))

    const list = Array.from(ids)
    list.sort((a, b) => {
      const playerA = playerByDeviceId.get(a)
      const playerB = playerByDeviceId.get(b)
      const seqA = playerA ? playerA.sequence : Number.MAX_SAFE_INTEGER
      const seqB = playerB ? playerB.sequence : Number.MAX_SAFE_INTEGER
      if (seqA !== seqB) return seqA - seqB

      const deviceA = deviceMap.get(a)
      const deviceB = deviceMap.get(b)
      const nameA = deviceA ? getDisplayName(deviceA) : a
      const nameB = deviceB ? getDisplayName(deviceB) : b
      return nameA.localeCompare(nameB)
    })
    return list
  }, [deviceMap, playerByDeviceId, playerData, roomDeviceIds])

  const minimapMarkers = useMemo(() => {
    const spatialMarkers = buildRoomMinimapMarkers(playerData, minimapConfig)
    const markers = buildRoomMinimapDisplayMarkers(spatialMarkers, playerData, deviceMap)
    const markerOrder = new Map(displayDeviceIds.map((deviceId, index) => [deviceId, index]))

    return markers.sort((a, b) => {
      const orderA = markerOrder.get(a.deviceId) ?? Number.MAX_SAFE_INTEGER
      const orderB = markerOrder.get(b.deviceId) ?? Number.MAX_SAFE_INTEGER

      if (orderA !== orderB) {
        return orderA - orderB
      }

      return a.displayName.localeCompare(b.displayName)
    })
  }, [deviceMap, displayDeviceIds, minimapConfig, playerData])

  const currentRoomName = useMemo(() => {
    if (currentRoom?.name) {
      return currentRoom.name
    }
    const found = roomList.find((room) => room.value === roomId)
    return found?.label || roomId
  }, [currentRoom?.name, roomId, roomList])

  const roomProfile = useMemo(() => {
    return currentRoom?.operation_profile || DEFAULT_ROOM_OPERATION_PROFILE
  }, [currentRoom])

  const handleToggleSelectedDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId((current) => (current === deviceId ? null : deviceId))
  }, [])

  const loadControlData = useCallback(async () => {
    try {
      const [rooms, devices, room] = await Promise.all([
        roomApi.getAll(),
        deviceApi.getAll(),
        roomId ? roomApi.get(roomId) : Promise.resolve(null),
      ])
      const roomOptions = rooms
        .map((room) => ({ value: room.room_id, label: room.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setRoomList(roomOptions)
      setDeviceMap(new Map(devices.map((device) => [device.device_id, device])))
      setCurrentRoom(room)

      setRoomDeviceIds(room?.device_ids || [])
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

  const refreshDeviceStatuses = useCallback(async () => {
    try {
      const [devices, room] = await Promise.all([
        deviceApi.getAll(),
        roomId ? roomApi.get(roomId) : Promise.resolve(null),
      ])
      setDeviceMap(new Map(devices.map((device) => [device.device_id, device])))
      if (room?.device_ids) setRoomDeviceIds(room.device_ids)
    } catch (error) {
      console.error("Failed to refresh device statuses:", error)
    }
  }, [roomId])

  useEffect(() => {
    loadControlData()
    loadActions()
  }, [loadActions, loadControlData])

  useEffect(() => {
    setActivityNameOverride(roomProfile.activity_defaults.name || "")
    setActivitySeedOverride(roomProfile.activity_defaults.seed?.toString() || "")
  }, [roomId, roomProfile])

  useEffect(() => {
    if (!roomId) return

    refreshDeviceStatuses()
    const interval = setInterval(() => {
      if (document.hidden) return
      refreshDeviceStatuses()
      setCountdown(DEFAULT_POLL_INTERVAL_SECONDS)
    }, DEFAULT_POLL_INTERVAL_SECONDS * 1000)

    const countdownInterval = setInterval(() => {
      if (document.hidden) return
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(countdownInterval)
    }
  }, [refreshDeviceStatuses, roomId])

  useEffect(() => {
    if (!roomId) return

    const ws = new WebSocket(`${wsProtocol}://${host}/api/ws/control/${roomId}`)
    setConnectionStatus("connecting")

    ws.onopen = () => {
      setConnectionStatus("connected")
    }

    ws.onclose = () => {
      setConnectionStatus("disconnected")
    }

    ws.onerror = () => {
      setConnectionStatus("disconnected")
    }

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
  }, [roomId, host, wsProtocol])

  useEffect(() => {
    const channel = createLiveStreamPopupChannel()
    popupChannelRef.current = channel

    const unsubscribe = subscribeLiveStreamPopupChannel(channel, (message) => {
      if (message.type === "selection-requested") {
        if (message.sender !== "popup") {
          return
        }

        if (message.source && message.source !== "rooms") {
          return
        }

        if (message.roomId && message.roomId !== roomId) {
          return
        }

        if (!displayDeviceIds.includes(message.deviceId)) {
          return
        }

        handleToggleSelectedDevice(message.deviceId)
        return
      }

      if (message.type === "popup-ready") {
        if (message.source && message.source !== "rooms") {
          return
        }

        if (message.roomId && message.roomId !== roomId) {
          return
        }

        postLiveStreamPopupMessage(channel, {
          type: "init",
          payload: buildLiveStreamPopupState(),
        })
        return
      }

      if (message.type === "takeover-requested") {
        if (message.source && message.source !== "rooms") {
          return
        }

        if (message.roomId && message.roomId !== roomId) {
          return
        }

        setPopupTakeoverActive(true)
        return
      }

      if (message.type === "popup-closing") {
        if (message.source && message.source !== "rooms") {
          return
        }

        if (message.roomId && message.roomId !== roomId) {
          return
        }

        setPopupTakeoverActive(false)
      }
    })

    return () => {
      unsubscribe()
      channel?.close()
    }
  }, [buildLiveStreamPopupState, displayDeviceIds, handleToggleSelectedDevice, roomId])

  useEffect(() => {
    postLiveStreamPopupMessage(popupChannelRef.current, {
      type: "state-update",
      payload: buildLiveStreamPopupState(),
    })
  }, [buildLiveStreamPopupState])

  useEffect(() => {
    const handlePageHide = () => {
      postLiveStreamPopupMessage(popupChannelRef.current, {
        type: "source-unavailable",
        source: "rooms",
        roomId,
        timestamp: Date.now(),
      })
    }

    window.addEventListener("pagehide", handlePageHide)

    return () => {
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [roomId])

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
    if (!selectedDeviceId) {
      return
    }

    if (!displayDeviceIds.includes(selectedDeviceId)) {
      setSelectedDeviceId(null)
    }
  }, [displayDeviceIds, selectedDeviceId])

  const handleChangeSequence = async (player: string, seq: number) => {
    if (!roomId) return
    setSequencePendingIds((prev) => {
      const next = new Set(prev)
      next.add(player)
      return next
    })
    try {
      await controlApi.assignSeq(roomId, player, seq)
    } catch (error) {
      console.error("Failed to assign sequence:", error)
    } finally {
      setSequencePendingIds((prev) => {
        const next = new Set(prev)
        next.delete(player)
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
    setForceMovePendingIds((prev) => {
      const next = new Set(prev)
      next.add(deviceId)
      return next
    })
    try {
      await simpleApi.forceMove(roomId, deviceId, dest)
    } catch (error) {
      console.error("Failed to send single move command:", error)
      alert("送出失敗，請稍後再試")
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

  const handleDisconnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "disconnect" }))
    try {
      await deviceApi.disconnect(deviceId)
      await loadControlData()
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

  const handleMonitor = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: "monitor" }))
    try {
      const info = await scrcpyApi.getSystemInfo()
      if (!info.installed) {
        throw new Error(info.error_message || "Scrcpy 未安裝")
      }
      await scrcpyApi.start(deviceId)
      alert("已啟動監看視窗")
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
    const popup = openLiveStreamPopupWindow({
      source: "rooms",
      roomId,
      layout: liveStreamLayout,
    })

    if (!popup) {
      alert(LIVE_STREAM_POPUP_BLOCKED_MESSAGE)
    }
  }

  const handleReturnLiveStreamInline = () => {
    setPopupTakeoverActive(false)
    postLiveStreamPopupMessage(popupChannelRef.current, {
      type: "takeover-released",
      source: "rooms",
      roomId,
      timestamp: Date.now(),
    })
  }

  const getAdbStatusText = (status?: Device["status"]) => {
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

  const getAdbStatusBadgeClass = (status?: Device["status"]) => {
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
    switch (status) {
      case "connected":
        return "已連線"
      case "disconnected":
        return "已中斷"
      default:
        return "未知"
    }
  }

  const getWsStatusBadgeClass = (status?: Device["ws_status"]) => {
    switch (status) {
      case "connected":
        return "ui-badge-success"
      case "disconnected":
        return "ui-badge-danger"
      default:
        return "ui-badge-muted"
    }
  }

  type AdbStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS]

  const isSupportedDeviceStatus = (status?: string): status is AdbStatus => {
    return !!status && (Object.values(DEVICE_STATUS) as string[]).includes(status)
  }

  const options = Array.from({ length: TotalChapters }, (_, i) => i.toString())

  const selectedAction = useMemo(() => {
    return actions.find((action) => action.action_id === selectedActionId) || null
  }, [actions, selectedActionId])

  const hasRunningActivity = currentActivityMeta.status === "running" && currentActivityMeta.id !== ""

  const presetActions = useMemo(() => {
    return roomProfile.batch_action_ids
      .map((actionId) => actions.find((action) => action.action_id === actionId) || null)
      .filter((action): action is Action => action !== null)
  }, [actions, roomProfile.batch_action_ids])

  const missingBatchActionIds = useMemo(() => {
    return roomProfile.batch_action_ids.filter(
      (actionId) => !actions.some((action) => action.action_id === actionId),
    )
  }, [actions, roomProfile.batch_action_ids])

  const modalDeviceIds = useMemo(() => {
    return roomDeviceIds.length > 0 ? roomDeviceIds : displayDeviceIds
  }, [displayDeviceIds, roomDeviceIds])

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

  const handleStartConfiguredActivity = async () => {
    const defaultName = roomProfile.activity_defaults.name.trim()
    const activityName = roomProfile.allow_activity_name_override
      ? activityNameOverride.trim() || defaultName || `${currentRoomName} Session`
      : defaultName || `${currentRoomName} Session`

    const seedInput = roomProfile.allow_seed_override
      ? activitySeedOverride.trim()
      : roomProfile.activity_defaults.seed?.toString() || ""

    let seed: number | undefined = roomProfile.activity_defaults.seed
    if (seedInput !== "") {
      const parsedSeed = Number(seedInput)
      if (!Number.isInteger(parsedSeed)) {
        alert("seed 必須是整數")
        return
      }
      seed = parsedSeed
    }

    let createdActivityId = ""
    setActivityPending("start")
    try {
      const created = await activityApi.createDraft(roomId, {
        name: activityName,
        activity_context: roomProfile.activity_defaults.activity_context || DEFAULT_ACTIVITY_CONTEXT,
      })
      createdActivityId = created.activity_id
      const started = await activityApi.start(created.activity_id, seed !== undefined ? { seed } : undefined)
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
    if (batchSelectedDeviceIds.length === 0) return

    if (batchMode === "action") {
      if (!selectedAction) return
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
      return
    }

    if (batchMode === "live") {
      const liveTargets = modalDeviceIds
        .filter((id) => batchSelectedDeviceIds.includes(id))
        .map((deviceId) => {
          const device = deviceMap.get(deviceId)
          return {
            deviceId,
            title: device ? getDisplayName(device) : deviceId,
            subtitle: device ? `${device.ip}:${device.port}` : deviceId,
          }
        })
      if (liveTargets.length === 0) return

      let droppedCount = 0
      setLiveWindows((prev) => {
        const result = openManyLiveStreamWindows(
          prev,
          liveTargets,
          { width: window.innerWidth, height: window.innerHeight },
          LIVE_VIEW_MAX_STREAMS,
        )
        droppedCount = result.droppedCount
        return result.windows
      })

      setBatchModalOpen(false)
      setBatchSelectedDeviceIds([])

      if (droppedCount > 0) {
        alert(
          `即時畫面初版最多同時開啟 ${LIVE_VIEW_MAX_STREAMS} 台設備，已有 ${droppedCount} 台未加入直播牆`,
        )
      }
      return
    }

    if (batchMonitorPending) return

    // Keep windows in a stable order by preserving the modal target ordering.
    const orderedDeviceIds = modalDeviceIds.filter((id) => batchSelectedDeviceIds.includes(id))
    if (orderedDeviceIds.length === 0) return

    const buildAutoLayout = (count: number) => {
      const screenW =
        typeof window !== "undefined"
          ? window.screen?.availWidth || window.innerWidth || 1920
          : 1920
      const screenH =
        typeof window !== "undefined"
          ? window.screen?.availHeight || window.innerHeight || 1080
          : 1080

      const columns = Math.max(1, Math.ceil(Math.sqrt(count)))

      const gapX = 4
      const gapY = 16
      const paddingX = 8
      const paddingY = 8
      const baseX = targetMonitorIndex * screenW
      const baseY = 0

      return {
        mode: "tile" as const,
        columns,
        base_x: baseX,
        base_y: baseY,
        screen_width: screenW,
        screen_height: screenH,
        padding_x: paddingX,
        padding_y: paddingY,
        gap_x: gapX,
        gap_y: gapY,
        // Reserve extra space so window decorations do not cause overlap.
        frame_margin_x: 16,
        frame_margin_y: 40,
      }
    }

    setBatchMonitorPending(true)
    try {
      const result = await scrcpyApi.startBatch({
        device_ids: orderedDeviceIds,
        layout: buildAutoLayout(orderedDeviceIds.length),
      })

      alert(`批次監看完成\n成功: ${result.success_count}\n失敗: ${result.failed_count}`)

      setBatchModalOpen(false)
      setBatchSelectedDeviceIds([])
    } catch (error) {
      console.error("Failed to start scrcpy batch:", error)
      alert("批次監看失敗，請稍後再試")
    } finally {
      setBatchMonitorPending(false)
    }
  }

  if (!roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-danger">房間不存在</div>
      </div>
    )
  }

  return (
    <PageShell
      title="房間控制"
      subtitle={`房間: ${currentRoomName}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`ui-badge text-xs font-semibold ${
              connectionStatus === "connected"
                ? "ui-badge-success"
                : connectionStatus === "connecting"
                  ? "ui-badge-muted"
                  : "ui-badge-danger"
            }`}
          >
            {connectionStatus === "connected"
              ? "已連線"
              : connectionStatus === "connecting"
                ? "連線中"
                : "已中斷"}
          </span>
          <button onClick={() => navigate("/rooms")} className="ui-btn ui-btn-md ui-btn-muted">
            返回房間列表
          </button>
          <button
            onClick={() => navigate(`/rooms/${roomId}`)}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            編輯房間
          </button>
          <button
            onClick={() => navigate(`/rooms/${roomId}/devices`)}
            className="ui-btn ui-btn-md ui-btn-accent"
          >
            前往設備
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <div className="surface-card space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">目前設定</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  這個房間會重複使用同一組 activity 預設與固定批次動作，操作人員只需依當前設定開始或結束活動。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`ui-badge ${getActivityBadgeClass(currentActivityMeta.status)}`}>
                  {currentActivityMeta.status
                    ? `目前活動 ${currentActivityMeta.status}`
                    : "目前沒有進行中的活動"}
                </span>
                {currentActivityMeta.name ? (
                  <span className="text-sm text-foreground/70">{currentActivityMeta.name}</span>
                ) : null}
                {currentActivityMeta.seed ? (
                  <span className="font-mono text-xs text-foreground/50">
                    seed {currentActivityMeta.seed}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface/30 p-4">
                  <div className="text-sm font-semibold text-foreground">活動預設</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-background/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                        預設名稱
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {roomProfile.activity_defaults.name || "未設定"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-background/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                        Seed 策略
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {roomProfile.activity_defaults.seed !== undefined
                          ? `固定 ${roomProfile.activity_defaults.seed}`
                          : "啟動時自動產生"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-background/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                        固定批次動作
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {roomProfile.batch_action_ids.length > 0
                          ? `${roomProfile.batch_action_ids.length} 個已綁定動作`
                          : "未設定"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-background/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                        覆蓋權限
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {roomProfile.allow_activity_name_override ? "名稱可覆蓋" : "名稱固定"}
                        {roomProfile.allow_seed_override ? " / Seed 可覆蓋" : " / Seed 固定"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/30 p-4">
                  <div className="text-sm font-semibold text-foreground">開始新活動</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                        活動名稱
                      </span>
                      <input
                        value={activityNameOverride}
                        onChange={(event) => setActivityNameOverride(event.target.value)}
                        disabled={!roomProfile.allow_activity_name_override}
                        placeholder="例如：Standard Round"
                        className="ui-input"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                        Seed
                      </span>
                      <input
                        type="number"
                        value={activitySeedOverride}
                        onChange={(event) => setActivitySeedOverride(event.target.value)}
                        disabled={!roomProfile.allow_seed_override}
                        placeholder="留白則使用房間預設"
                        className="ui-input"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      loading={activityPending === "start"}
                      disabled={activityPending !== "" || hasRunningActivity}
                      className="ui-btn-md ui-btn-primary"
                      onClick={handleStartConfiguredActivity}
                    >
                      以目前設定開始活動
                    </Button>
                    <Button
                      type="button"
                      loading={activityPending === `end:${currentActivityMeta.id}`}
                      disabled={activityPending !== "" || !hasRunningActivity}
                      className="ui-btn-md ui-btn-danger"
                      onClick={() => handleEndActivity(currentActivityMeta.id)}
                    >
                      結束目前活動
                    </Button>
                    <span className="text-xs text-foreground/50">
                      activity context 由房間設定頁維護；控制頁只保留少量臨時覆蓋欄位。
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/30 p-4">
                  <div className="text-sm font-semibold text-foreground">Activity Context</div>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-background/70 p-3 text-xs text-foreground/80">
                    {JSON.stringify(roomProfile.activity_defaults.activity_context || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">目前活動狀態</div>
                  {currentActivityMeta.id ? (
                    <span className="font-mono text-xs text-foreground/50">
                      {currentActivityMeta.id}
                    </span>
                  ) : null}
                </div>

                {!currentActivityMeta.id ? (
                  <div className="mt-3 text-sm text-foreground/60">
                    目前沒有進行中的活動。按左側按鈕即可依 room 的固定設定開始新活動。
                  </div>
                ) : (
                  <div className="mt-3 space-y-4">
                    <div className="rounded-2xl bg-background/60 p-3 text-sm text-foreground/80">
                      <div>名稱: {currentActivityMeta.name || "未命名活動"}</div>
                      <div className="mt-2">狀態: {currentActivityMeta.status || "unknown"}</div>
                      <div className="mt-2">Seed: {currentActivityMeta.seed ?? "—"}</div>
                      <div className="mt-2">
                        開始時間:
                        {currentActivityMeta.startedAt
                          ? ` ${new Date(currentActivityMeta.startedAt).toLocaleString()}`
                          : " —"}
                      </div>
                    </div>
                    <div className="text-xs text-foreground/50">
                      活動歷史與結果查詢暫時保留在後端 API，不再放在這個操作頁上。
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="surface-card space-y-5 p-6">
            <h2 className="text-xl font-bold text-foreground">房間控制</h2>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">強制移動（全部）</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground/70">Force all move to chapter</span>
                <select
                  id="moveSelect"
                  className={`ui-select mx-2 max-h-40 place-self-center overflow-y-auto px-2 py-1 text-center ${
                    selectedOption === "" ? "text-foreground/50" : ""
                  }`}
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                >
                  <option value="" className="text-foreground/50"></option>
                  {options.map((option, index) => (
                    <option key={index} value={option} className="text-foreground">
                      {option}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={selectedOption === ""}
                  loading={forceMovePending}
                  onClick={handleForceAllMove}
                >
                  Go
                </Button>
                {moveState === "success" && <span className="text-success">已送出指令</span>}
                {moveState === "failed" && (
                  <span className="text-danger">送出失敗，請稍後再試</span>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-sm font-semibold text-foreground">固定批次動作</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {presetActions.length === 0 ? (
                  <span className="text-xs text-foreground/50">
                    尚未設定固定批次動作，請到房間設定頁填入 batch_action_ids。
                  </span>
                ) : (
                  presetActions.map((action) => (
                    <Button
                      key={action.action_id}
                      onClick={() => {
                        setSelectedActionId(action.action_id)
                        setBatchMode("action")
                        setBatchSelectedDeviceIds([])
                        setBatchModalOpen(true)
                      }}
                    >
                      執行 {action.name}
                    </Button>
                  ))
                )}
              </div>
              {missingBatchActionIds.length > 0 ? (
                <div className="mt-2 text-xs text-warning">
                  找不到這些固定動作：{missingBatchActionIds.join(", ")}
                </div>
              ) : null}
              {actions.length === 0 ? (
                <span className="mt-2 block text-xs text-foreground/50">
                  尚無動作（請先到動作管理建立）
                </span>
              ) : null}
              <div className="mt-2 text-xs text-foreground/50">
                固定批次動作由 room operation profile 管理，不再讓操作人員每次手動選 action。
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-sm font-semibold text-foreground">房間設定捷徑</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate(`/rooms/${roomId}`)}
                  className="ui-btn ui-btn-md ui-btn-muted"
                >
                  編輯目前設定
                </button>
                <span className="text-xs text-foreground/50">
                  若要調整 activity context、固定 seed 或固定批次動作，請回房間設定頁修改。
                </span>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-sm font-semibold text-foreground">設備監看（批次）</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-foreground/70">scrcpy</span>
                <select
                  className="ui-select max-w-[200px] px-2 py-1"
                  value={targetMonitorIndex}
                  onChange={(e) => setTargetMonitorIndex(Number(e.target.value) || 0)}
                >
                  <option value={0}>顯示器 1（主螢幕）</option>
                  <option value={1}>顯示器 2（右側）</option>
                  <option value={2}>顯示器 3（更右側）</option>
                  <option value={3}>顯示器 4（更右側）</option>
                </select>
                <Button
                  onClick={() => {
                    setBatchMode("monitor")
                    setBatchSelectedDeviceIds([])
                    setBatchModalOpen(true)
                  }}
                >
                  選擇設備並批次監看
                </Button>
                <Button
                  onClick={() => {
                    setBatchMode("live")
                    setBatchSelectedDeviceIds([])
                    setBatchModalOpen(true)
                  }}
                  className="ui-btn-sm ui-btn-outline"
                >
                  選擇設備並開啟即時畫面
                </Button>
                <span className="text-xs text-foreground/50">只可選擇在線設備</span>
              </div>
            </div>
          </div>

          <div className="surface-card p-4 md:p-6">
            <RoomMinimap
              config={minimapConfig}
              markers={minimapMarkers}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleToggleSelectedDevice}
              subtitle="使用 head_position / head_forward 的 xz 平面投影"
            />
          </div>

          <div className="surface-card p-4 md:p-6">
            <div className="live-stream-section__header">
              <div>
                <h2 className="text-xl font-bold text-foreground">即時串流</h2>
                <p className="text-sm text-foreground/60">
                  批次開啟後會集中顯示在這個區段，可依需求切換堆疊或網格檢視。
                </p>
              </div>
              <div className="live-stream-section__toolbar">
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
                  全部關閉
                </button>
              </div>
            </div>

            {popupTakeoverActive ? (
              <LiveStreamTakeoverPlaceholder
                description="外部視窗已接管這個房間的即時串流顯示。你仍可在本頁調整清單與版型，變更會同步送到外部視窗。"
                onFocusPopup={handleOpenLiveStreamPopup}
                onReturnInline={handleReturnLiveStreamInline}
              />
            ) : liveWindows.length > 0 ? (
              <LiveStreamStage
                windows={liveWindows}
                layout={liveStreamLayout}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={handleToggleSelectedDevice}
                onClose={handleCloseLiveStream}
              />
            ) : (
              <div className="live-stream-empty-state">
                從設備列或批次操作開啟「即時畫面」後，串流會集中顯示在這裡。
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">房間內設備</h2>
              <span className="ui-badge ui-badge-muted text-xs">下次更新 {countdown} 秒</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {displayDeviceIds.map((deviceId) => {
                const player = playerByDeviceId.get(deviceId)
                const device = deviceMap.get(deviceId)
                const alias = device ? getDisplayName(device) : deviceId
                const adbStatus = isSupportedDeviceStatus(device?.status)
                  ? device?.status
                  : undefined
                const wsStatus = device?.ws_status
                const isAdbOnline = adbStatus === DEVICE_STATUS.ONLINE
                const isAdbConnecting = adbStatus === DEVICE_STATUS.CONNECTING
                const devicePendingAction = deviceActionPending[deviceId]
                const isDevicePending = !!devicePendingAction
                const batteryText =
                  isAdbOnline && device?.battery !== undefined && device?.battery !== null
                    ? `${device.battery}%`
                    : "—"
                const temperatureText =
                  isAdbOnline && device?.temperature !== undefined && device?.temperature !== null
                    ? `${device.temperature}°C`
                    : "—"
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

                      handleToggleSelectedDevice(deviceId)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") {
                        return
                      }

                      if (shouldIgnoreDeviceCardSelectionEvent(event.target, event.currentTarget)) {
                        return
                      }

                      event.preventDefault()
                      handleToggleSelectedDevice(deviceId)
                    }}
                    className={`surface-panel selection-surface selection-surface-interactive cursor-pointer p-4 ${
                      isSelectedDevice ? "selection-surface-selected" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{alias}</div>
                        <div className="font-mono text-xs text-foreground/50">{deviceId}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                        <span className="uppercase tracking-wide">電量</span>
                        <span className="font-semibold text-foreground">{batteryText}</span>
                        <span className="text-foreground/40">|</span>
                        <span className="uppercase tracking-wide">溫度</span>
                        <span className="font-semibold text-foreground">{temperatureText}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`ui-badge ${getWsStatusBadgeClass(wsStatus)}`}
                          title={
                            device?.ws_last_seen ? `最後回報: ${device.ws_last_seen}` : undefined
                          }
                        >
                          WS {getWsStatusText(wsStatus)}
                        </span>
                        <span className={`ui-badge ${getAdbStatusBadgeClass(adbStatus)}`}>
                          ADB {getAdbStatusText(adbStatus)}
                        </span>
                        {!isAdbOnline && !isAdbConnecting && (
                          <Button
                            onClick={() => handleConnect(deviceId)}
                            className="ui-btn-xs ui-btn-primary"
                            loading={devicePendingAction === "connect"}
                            disabled={isDevicePending}
                          >
                            連線
                          </Button>
                        )}
                        {isAdbOnline && (
                          <>
                            <Button
                              onClick={() => handleDisconnect(deviceId)}
                              className="ui-btn-xs ui-btn-danger"
                              loading={devicePendingAction === "disconnect"}
                              disabled={isDevicePending}
                            >
                              斷開
                            </Button>
                            <Button
                              onClick={() => handleMonitor(deviceId)}
                              className="ui-btn-xs ui-btn-accent"
                              loading={devicePendingAction === "monitor"}
                              disabled={isDevicePending}
                            >
                              監看
                            </Button>
                            <Button
                              onClick={() => handleOpenLiveStream(deviceId)}
                              className="ui-btn-xs ui-btn-outline"
                              disabled={isDevicePending}
                            >
                              即時畫面
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      {player ? (
                        <PlayerInfo
                          player={player}
                          handleChangeSequence={handleChangeSequence}
                          handleForceMove={handleForceMoveSingle}
                          forceMoveOptions={options}
                          displayName={alias}
                          adbStatus={adbStatus}
                          sequenceLoading={sequencePendingIds.has(deviceId)}
                          forceMoveLoading={forceMovePendingIds.has(deviceId)}
                        />
                      ) : (
                        <div className="px-4 py-3 text-xs text-foreground/60">
                          <div className="ui-badge ui-badge-muted">
                            未加入房間控制（無即時玩家資料）
                          </div>
                          <div className="mt-2 text-foreground/50">
                            此設備已在房間設定中，但目前未連上房間 WebSocket。
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <DeviceSelectionModal
        open={batchModalOpen}
        title={
          batchMode === "action"
            ? `執行動作: ${selectedAction?.name || ""}`
            : batchMode === "monitor"
              ? "批次監看設備"
              : "批次開啟即時畫面"
        }
        confirmText={batchMode === "action" ? "執行" : batchMode === "monitor" ? "監看" : "開啟"}
        targets={modalDeviceIds.map((deviceId) => {
          const device = deviceMap.get(deviceId)
          return {
            id: deviceId,
            label: device ? getDisplayName(device) : deviceId,
            ip: device?.ip,
            status: device?.status,
            isOnline: device?.status === "online",
          }
        })}
        selectedIds={batchSelectedDeviceIds}
        onSelectedIdsChange={setBatchSelectedDeviceIds}
        confirmPending={batchMode === "action" ? executePending : batchMonitorPending}
        onConfirm={handleConfirmBatch}
        onClose={() => {
          setBatchModalOpen(false)
          setBatchSelectedDeviceIds([])
        }}
      />
    </PageShell>
  )
}
