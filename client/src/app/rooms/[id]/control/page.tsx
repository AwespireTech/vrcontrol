import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { DEFAULT_POLL_INTERVAL_SECONDS, SERVER } from "@/environment"
import Button from "@/components/button"
import PlayerInfo from "@/components/player-info"
import { actionApi, controlApi, deviceApi, roomApi, scrcpyApi, simpleApi } from "@/services/quest-api"
import { QUEST_DEVICE_STATUS, type QuestAction, type QuestDevice } from "@/services/quest-types"
import { getDisplayName } from "@/lib/utils/device"
import type { PlayerData, RoomInfoData } from "@/interfaces/room.interface"
import QuestPageShell from "@/components/quest/quest-page-shell"
import QuestDeviceSelectionModal from "@/components/quest/quest-device-selection-modal"

const TotalChapters = 11

export default function RoomControlPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const roomId = id || ""

  const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
  const host = SERVER.replace(/^https?:\/\//, "")

  const [playerData, setPlayerData] = useState<PlayerData[]>([])
  const [deviceMap, setDeviceMap] = useState<Map<string, QuestDevice>>(new Map())
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

  const [actions, setActions] = useState<QuestAction[]>([])
  const [selectedActionId, setSelectedActionId] = useState<string>("")
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchMode, setBatchMode] = useState<"action" | "monitor">("action")
  const [batchSelectedDeviceIds, setBatchSelectedDeviceIds] = useState<string[]>([])
  const [executePending, setExecutePending] = useState(false)
  const [batchMonitorPending, setBatchMonitorPending] = useState(false)
  const [targetMonitorIndex, setTargetMonitorIndex] = useState(0)

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

  const currentRoomName = useMemo(() => {
    const found = roomList.find((room) => room.value === roomId)
    return found?.label || roomId
  }, [roomId, roomList])

  const loadControlData = useCallback(async () => {
    try {
      const [questRooms, devices] = await Promise.all([roomApi.getAll(), deviceApi.getAll()])
      const roomOptions = questRooms
        .map((room) => ({ value: room.room_id, label: room.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setRoomList(roomOptions)
      setDeviceMap(new Map(devices.map((device) => [device.device_id, device])))

      if (roomId) {
        const currentRoom = questRooms.find((room) => room.room_id === roomId)
        setRoomDeviceIds(currentRoom?.device_ids || [])
      }
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
    }

    return () => {
      ws.close()
    }
  }, [roomId, host, wsProtocol])

  useEffect(() => {
    if (moveState !== "") {
      const timer = setTimeout(() => {
        setMoveState("")
        setSelectedOption("")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [moveState])

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

  const getAdbStatusText = (status?: QuestDevice["status"]) => {
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

  const getAdbStatusBadgeClass = (status?: QuestDevice["status"]) => {
    switch (status) {
      case QUEST_DEVICE_STATUS.ONLINE:
        return "ui-badge-success"
      case QUEST_DEVICE_STATUS.CONNECTING:
        return "ui-badge-warning"
      case QUEST_DEVICE_STATUS.ERROR:
        return "ui-badge-danger"
      case QUEST_DEVICE_STATUS.OFFLINE:
      case QUEST_DEVICE_STATUS.DISCONNECTED:
      default:
        return "ui-badge-muted"
    }
  }

  const getWsStatusText = (status?: QuestDevice["ws_status"]) => {
    switch (status) {
      case "connected":
        return "已連線"
      case "disconnected":
        return "已中斷"
      default:
        return "未知"
    }
  }

  const getWsStatusBadgeClass = (status?: QuestDevice["ws_status"]) => {
    switch (status) {
      case "connected":
        return "ui-badge-success"
      case "disconnected":
        return "ui-badge-danger"
      default:
        return "ui-badge-muted"
    }
  }

  type AdbStatus = (typeof QUEST_DEVICE_STATUS)[keyof typeof QUEST_DEVICE_STATUS]

  const isQuestDeviceStatus = (status?: string): status is AdbStatus => {
    return !!status && (Object.values(QUEST_DEVICE_STATUS) as string[]).includes(status)
  }

  const options = Array.from({ length: TotalChapters }, (_, i) => i.toString())

  const selectedAction = useMemo(() => {
    return actions.find((action) => action.action_id === selectedActionId) || null
  }, [actions, selectedActionId])

  const modalDeviceIds = useMemo(() => {
    return roomDeviceIds.length > 0 ? roomDeviceIds : displayDeviceIds
  }, [displayDeviceIds, roomDeviceIds])

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

      alert(
        `批次監看完成\n成功: ${result.success_count}\n失敗: ${result.failed_count}`,
      )

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
    <QuestPageShell
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
          <button
            onClick={() => navigate("/rooms")}
            className="ui-btn ui-btn-md ui-btn-muted"
          >
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
              <div className="text-sm font-semibold text-foreground">動作執行（批次）</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-foreground/70">Action</span>
                <select
                  className={`ui-select mx-2 max-w-[320px] px-2 py-1 ${
                    selectedActionId === "" ? "text-foreground/50" : ""
                  }`}
                  value={selectedActionId}
                  onChange={(e) => setSelectedActionId(e.target.value)}
                >
                  <option value="" className="text-foreground/50"></option>
                  {actions.map((action) => (
                    <option
                      key={action.action_id}
                      value={action.action_id}
                      className="text-foreground"
                    >
                      {action.name}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!selectedAction}
                  onClick={() => {
                    if (!selectedAction) return
                    setBatchMode("action")
                    setBatchSelectedDeviceIds([])
                    setBatchModalOpen(true)
                  }}
                >
                  選擇設備並執行
                </Button>
                {actions.length === 0 ? (
                  <span className="text-xs text-foreground/50">尚無動作（請先到動作管理建立）</span>
                ) : null}
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
                <span className="text-xs text-foreground/50">
                  只可選擇在線設備
                </span>
              </div>
            </div>
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
                const adbStatus = isQuestDeviceStatus(device?.status) ? device?.status : undefined
                const wsStatus = device?.ws_status
                const isAdbOnline = adbStatus === QUEST_DEVICE_STATUS.ONLINE
                const isAdbConnecting = adbStatus === QUEST_DEVICE_STATUS.CONNECTING
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

                return (
                  <div key={deviceId} className="surface-panel p-4">
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
                          title={device?.ws_last_seen ? `最後回報: ${device.ws_last_seen}` : undefined}
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
                          <div className="ui-badge ui-badge-muted">未加入房間控制（無即時玩家資料）</div>
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

      <QuestDeviceSelectionModal
        open={batchModalOpen}
        title={
          batchMode === "action"
            ? `執行動作: ${selectedAction?.name || ""}`
            : "批次監看設備"
        }
        confirmText={batchMode === "action" ? "執行" : "監看"}
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
    </QuestPageShell>
  )
}
