import { useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { DEVICE_STATUS, type Device, type Room } from "@/services/api-types"
import { deviceApi, roomApi } from "@/services/api"
import { LIVE_VIEW_MAX_STREAMS, SERVER } from "@/environment"
import LiveStreamStage from "@/components/console/live-stream-stage"
import type { LiveStreamLayout } from "@/components/console/live-stream-stage"
import PageShell from "@/components/console/page-shell"
import RoomMinimap from "@/components/console/room-minimap"
import { useRoomMinimapConfig } from "@/hooks/useRoomMinimapConfig"
import type { PlayerData, RoomInfoData } from "@/interfaces/room.interface"
import { buildRoomMinimapDisplayMarkers } from "@/lib/room-minimap/display"
import { buildRoomMinimapMarkers } from "@/lib/room-minimap/mappers"
import { getDisplayName } from "@/lib/utils/device"
import { getAdbStatusText, getWsStatusText } from "@/lib/utils/device-status"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

function buildLiveStreamWindows(devices: Device[]): LiveStreamWindowState[] {
  return devices.slice(0, LIVE_VIEW_MAX_STREAMS).map((device, index) => ({
    deviceId: device.device_id,
    title: getDisplayName(device),
    subtitle: `${device.ip}:${device.port}`,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zIndex: index + 1,
    minimized: false,
  }))
}

function sortRoomDevices(room: Room | null, devices: Device[]) {
  const order = new Map((room?.device_ids || []).map((deviceId, index) => [deviceId, index]))
  return [...devices]
    .filter((device) => order.has(device.device_id) || device.room_id === room?.room_id)
    .sort((left, right) => {
      const leftOrder = order.get(left.device_id) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = order.get(right.device_id) ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return getDisplayName(left).localeCompare(getDisplayName(right))
    })
}

function getConnectionBadgeClass(status: string) {
  if (status === DEVICE_STATUS.ONLINE) return "ui-badge-success"
  if (status === DEVICE_STATUS.CONNECTING) return "ui-badge-warning"
  if (status === DEVICE_STATUS.ERROR) return "ui-badge-danger"
  return "ui-badge-muted"
}

export default function MonitoringRoomPage() {
  const { id } = useParams<{ id: string }>()
  const roomId = id || ""
  const [searchParams] = useSearchParams()
  const displayMode = searchParams.get("display") === "wall" ? "wall" : "page"
  const layoutParam = searchParams.get("layout")
  const [layout, setLayout] = useState<LiveStreamLayout>(layoutParam === "stack" ? "stack" : "grid")
  const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
  const host = SERVER.replace(/^https?:\/\//, "")
  const minimapConfig = useRoomMinimapConfig(roomId)

  const [room, setRoom] = useState<Room | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [players, setPlayers] = useState<PlayerData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [activityMeta, setActivityMeta] = useState<{
    id: string
    name: string
    status: string
    seed?: number
  }>({ id: "", name: "", status: "" })

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setLoadError("")
      try {
        const [roomData, devicesData] = await Promise.all([roomApi.get(roomId), deviceApi.getAll()])
        if (!active) return
        setRoom(roomData)
        setDevices(sortRoomDevices(roomData, devicesData))
        if (!roomData) {
          setLoadError("找不到指定的房間")
        }
      } catch (error) {
        console.error("Failed to load monitoring room:", error)
        if (active) {
          setLoadError("載入監控房間失敗，請稍後再試")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return

    const socket = new WebSocket(`${wsProtocol}://${host}/api/ws/control/${roomId}`)
    setConnectionStatus("connecting")

    socket.onopen = () => setConnectionStatus("connected")
    socket.onclose = () => setConnectionStatus("disconnected")
    socket.onerror = () => setConnectionStatus("disconnected")
    socket.onmessage = (event) => {
      const data: RoomInfoData = JSON.parse(event.data)
      setPlayers(data.players)
      setActivityMeta({
        id: data.current_activity_id || "",
        name: data.activity_name || "",
        status: data.activity_status || "",
        seed: data.activity_seed,
      })
    }

    return () => {
      socket.close()
    }
  }, [host, roomId, wsProtocol])

  const deviceMap = useMemo(
    () => new Map(devices.map((device) => [device.device_id, device])),
    [devices],
  )

  const liveWindows = useMemo(() => buildLiveStreamWindows(devices), [devices])
  const selectedDevice = selectedDeviceId ? deviceMap.get(selectedDeviceId) : null
  const droppedStreamCount = Math.max(0, devices.length - liveWindows.length)
  const markers = useMemo(
    () => buildRoomMinimapMarkers(players, minimapConfig),
    [minimapConfig, players],
  )
  const displayMarkers = useMemo(
    () => buildRoomMinimapDisplayMarkers(markers, players, deviceMap),
    [deviceMap, markers, players],
  )
  const onlineCount = devices.filter((device) => device.status === DEVICE_STATUS.ONLINE).length
  const title = room?.name || roomId || "監控畫面"

  const content = (
    <div className={displayMode === "wall" ? "monitoring-wall" : "space-y-6"}>
      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-foreground/45">Room Monitor</div>
            <h2 className="mt-2 text-2xl font-bold text-foreground">{title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-foreground/60">
              <span>{devices.length} 台裝置</span>
              <span>·</span>
              <span>{onlineCount} 台在線</span>
              {activityMeta.name ? (
                <>
                  <span>·</span>
                  <span>{activityMeta.name}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`ui-badge ${connectionStatus === "connected" ? "ui-badge-success" : connectionStatus === "connecting" ? "ui-badge-warning" : "ui-badge-muted"}`}>
              {connectionStatus === "connected" ? "Room WS 已連線" : connectionStatus === "connecting" ? "Room WS 連線中" : "Room WS 離線"}
            </span>
            {activityMeta.status ? <span className="ui-badge ui-badge-primary">{activityMeta.status}</span> : null}
            <div className="live-stream-layout-toggle" role="group" aria-label="即時串流排版">
              <button
                type="button"
                onClick={() => setLayout("stack")}
                className={`ui-btn ui-btn-xs ${layout === "stack" ? "ui-btn-primary" : "ui-btn-muted"}`}
              >
                堆疊
              </button>
              <button
                type="button"
                onClick={() => setLayout("grid")}
                className={`ui-btn ui-btn-xs ${layout === "grid" ? "ui-btn-primary" : "ui-btn-muted"}`}
              >
                網格
              </button>
            </div>
            {displayMode === "wall" ? (
              <Link to={`/monitoring/rooms/${encodeURIComponent(roomId)}`} className="ui-btn ui-btn-xs ui-btn-outline">
                一般模式
              </Link>
            ) : (
              <Link to={`/monitoring/rooms/${encodeURIComponent(roomId)}?display=wall&layout=${layout}`} className="ui-btn ui-btn-xs ui-btn-outline">
                牆面模式
              </Link>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="live-stream-empty-state">載入監控資料中…</div>
      ) : loadError ? (
        <div className="live-stream-empty-state">{loadError}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-5">
            <RoomMinimap
              config={minimapConfig}
              markers={displayMarkers}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={setSelectedDeviceId}
              detailLevel="map-only"
            />

            <section className="surface-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">裝置狀態</h3>
                <span className="ui-badge ui-badge-muted">{devices.length}</span>
              </div>
              <div className="space-y-2">
                {devices.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-subtle/70 p-4 text-sm text-foreground/60">
                    這個房間目前沒有裝置。
                  </div>
                ) : (
                  devices.map((device) => (
                    <button
                      key={device.device_id}
                      type="button"
                      onClick={() => setSelectedDeviceId((current) => current === device.device_id ? null : device.device_id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        selectedDeviceId === device.device_id
                          ? "border-primary/70 bg-primary/10"
                          : "border-border-subtle/70 bg-bg-panel/55 hover:border-border-subtle hover:bg-bg-panel/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-foreground">{getDisplayName(device)}</span>
                        <span className={`ui-badge ${getConnectionBadgeClass(device.status)} text-[11px]`}>
                          {getAdbStatusText(device.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-foreground/55">
                        <span className="truncate">{device.ip}:{device.port}</span>
                        <span>{getWsStatusText(device.ws_status)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="surface-card p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">即時串流</h3>
                <p className="mt-1 text-sm text-foreground/60">
                  {droppedStreamCount > 0
                    ? `目前顯示前 ${LIVE_VIEW_MAX_STREAMS} 台，另有 ${droppedStreamCount} 台未開啟。`
                    : "每個監控頁會建立自己的 WebRTC viewer，不依賴控制頁。"}
                </p>
              </div>
              {selectedDevice ? (
                <span className="ui-badge ui-badge-primary">已選取 {getDisplayName(selectedDevice)}</span>
              ) : null}
            </div>

            {liveWindows.length > 0 ? (
              <LiveStreamStage
                windows={liveWindows}
                layout={layout}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
              />
            ) : (
              <div className="live-stream-empty-state">尚未有可顯示的即時串流裝置。</div>
            )}
          </section>
        </div>
      )}
    </div>
  )

  if (displayMode === "wall") {
    return <div className="console-page">{content}</div>
  }

  return (
    <PageShell title="監控中心" subtitle="查看房間即時串流與目前玩家狀態" maxWidth="xl">
      {content}
    </PageShell>
  )
}
