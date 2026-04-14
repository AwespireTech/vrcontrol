import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import LiveStreamStage from "@/components/console/live-stream-stage"
import type { LiveStreamLayout } from "@/components/console/live-stream-stage"
import {
  createLiveStreamPopupChannel,
  postLiveStreamPopupMessage,
  subscribeLiveStreamPopupChannel,
  type LiveStreamPopupState,
} from "@/lib/utils/live-stream-popup"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

type PopupSyncStatus = "connecting" | "waiting-data" | "ready"

function mapStreamsToWindows(streams: LiveStreamPopupState["streams"]): LiveStreamWindowState[] {
  return streams.map((stream, index) => ({
    deviceId: stream.deviceId,
    title: stream.title,
    subtitle: stream.subtitle,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    zIndex: index + 1,
    minimized: false,
  }))
}

export default function LiveStreamPopupPage() {
  const [searchParams] = useSearchParams()
  const initialLayout = searchParams.get("layout") === "stack" ? "stack" : "grid"
  const [layout, setLayout] = useState<LiveStreamLayout>(initialLayout)
  const [streams, setStreams] = useState<LiveStreamPopupState["streams"]>([])
  const [syncStatus, setSyncStatus] = useState<PopupSyncStatus>("connecting")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [takeoverReleased, setTakeoverReleased] = useState(false)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const sourceLabel = useMemo(() => {
    const source = searchParams.get("source")
    const roomId = searchParams.get("roomId")

    if (source === "rooms") {
      return roomId ? `來源房間：${roomId}` : "來源頁面：房間控制"
    }

    if (source === "devices") {
      return "來源頁面：設備管理"
    }

    return "來源頁面：即時串流"
  }, [searchParams])

  const liveWindows = useMemo(() => mapStreamsToWindows(streams), [streams])

  useEffect(() => {
    const channel = createLiveStreamPopupChannel()
    channelRef.current = channel

    const unsubscribe = subscribeLiveStreamPopupChannel(channel, (message) => {
      const routeSource = searchParams.get("source")
      const routeRoomId = searchParams.get("roomId")

      if (message.type === "takeover-released") {
        if (routeSource && message.source && routeSource !== message.source) {
          return
        }

        if (routeRoomId && message.roomId && routeRoomId !== message.roomId) {
          return
        }

        setStreams([])
        setTakeoverReleased(true)
        setSyncStatus("waiting-data")
        setLastUpdatedAt(message.timestamp)
        return
      }

      if (message.type !== "init" && message.type !== "state-update") {
        return
      }

      const nextState = message.payload

      if (routeSource && nextState.source && routeSource !== nextState.source) {
        return
      }

      if (routeRoomId && nextState.roomId && routeRoomId !== nextState.roomId) {
        return
      }

      setLayout(nextState.layout)
      setStreams(nextState.streams)
      setTakeoverReleased(false)
      setLastUpdatedAt(nextState.timestamp)
      setSyncStatus("ready")

      if (message.type === "init") {
        postLiveStreamPopupMessage(channel, {
          type: "takeover-requested",
          source: nextState.source,
          roomId: nextState.roomId,
          timestamp: Date.now(),
        })
      }
    })

    postLiveStreamPopupMessage(channel, {
      type: "popup-ready",
      source: searchParams.get("source") === "devices" ? "devices" : searchParams.get("source") === "rooms" ? "rooms" : undefined,
      roomId: searchParams.get("roomId") || undefined,
      timestamp: Date.now(),
    })
    setSyncStatus(channel ? "waiting-data" : "connecting")

    return () => {
      unsubscribe()
      channel?.close()
    }
  }, [searchParams])

  const syncStatusLabel =
    syncStatus === "connecting"
      ? "同步通道不可用"
      : syncStatus === "waiting-data"
        ? "已連線，等待主頁資料"
        : "已同步"

  return (
    <div className="live-stream-popup-page">
      <div className="live-stream-popup-page__inner">
        <header className="surface-card live-stream-popup-page__hero">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-foreground/50">
              VR Control Console
            </div>
            <h1 className="mt-2 text-3xl font-bold text-foreground">即時串流外部視窗</h1>
            <p className="mt-2 text-sm text-foreground/70">
              目前會等待主頁送出即時串流清單與版型設定。這一批先驗證同步鏈路，不切走主頁顯示。
            </p>
          </div>
          <div className="live-stream-popup-page__hero-actions">
            <span className="ui-badge ui-badge-primary">MVP 骨架</span>
            <button type="button" onClick={() => window.close()} className="ui-btn ui-btn-sm ui-btn-muted">
              關閉視窗
            </button>
          </div>
        </header>

        <section className="surface-card p-4 md:p-6">
          <div className="live-stream-section__header">
            <div>
              <h2 className="text-xl font-bold text-foreground">即時串流</h2>
              <p className="text-sm text-foreground/60">{sourceLabel}</p>
            </div>
            <div className="live-stream-section__toolbar">
              <span className={`ui-badge ${syncStatus === "ready" ? "ui-badge-success" : "ui-badge-muted"}`}>
                {syncStatusLabel}
              </span>
              <div className="live-stream-layout-toggle" role="group" aria-label="即時串流排版">
                <button
                  type="button"
                  disabled
                  className={`ui-btn ui-btn-xs ${layout === "stack" ? "ui-btn-primary" : "ui-btn-muted"}`}
                >
                  堆疊
                </button>
                <button
                  type="button"
                  disabled
                  className={`ui-btn ui-btn-xs ${layout === "grid" ? "ui-btn-primary" : "ui-btn-muted"}`}
                >
                  網格
                </button>
              </div>
            </div>
          </div>

          <div className="live-stream-popup-notice">
            {takeoverReleased
              ? "主頁已重新接管即時串流顯示。此視窗目前保留開啟，但不再承載播放器。"
              : syncStatus === "ready"
              ? `已收到主頁同步資料${lastUpdatedAt ? `，最後更新於 ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}。`
              : "新視窗已連上同步通道，等待主頁送出即時串流清單。"}
          </div>

          {streams.length > 0 ? (
            <LiveStreamStage windows={liveWindows} layout={layout} />
          ) : (
            <div className="live-stream-empty-state">
              {syncStatus === "connecting"
                ? "目前瀏覽器不支援跨視窗同步通道，請改回主頁查看即時串流。"
                : syncStatus === "waiting-data"
                  ? "目前尚未接收即時串流資料，請回到主頁開啟或調整直播清單。"
                  : "主頁已連線，但目前沒有要顯示的即時串流。"}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}