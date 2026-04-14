import { useEffect, useMemo, useState } from "react"
import LiveStreamPlayer from "@/components/console/live-stream-player"
import LiveStreamWindow from "@/components/console/live-stream-window"
import {
  LIVE_VIEW_FLOATING_BREAKPOINT,
  LIVE_VIEW_MAX_STREAMS,
  LIVE_VIEW_WINDOW_STAGE_PADDING,
} from "@/environment"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

type LiveStreamStageProps = {
  windows: LiveStreamWindowState[]
  onClose: (deviceId: string) => void
  onCloseAll: () => void
  onFocus: (deviceId: string) => void
  onMove: (deviceId: string, nextX: number, nextY: number, bounds: { width: number; height: number }) => void
  onResize: (deviceId: string, nextWidth: number, nextHeight: number, bounds: { width: number; height: number }) => void
  onToggleMinimized: (deviceId: string) => void
}

export default function LiveStreamStage({
  windows,
  onClose,
  onCloseAll,
  onFocus,
  onMove,
  onResize,
  onToggleMinimized,
}: LiveStreamStageProps) {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }))

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const floatingEnabled = viewport.width >= LIVE_VIEW_FLOATING_BREAKPOINT
  const sortedWindows = useMemo(
    () => [...windows].sort((left, right) => left.zIndex - right.zIndex),
    [windows],
  )

  if (windows.length === 0) return null

  if (!floatingEnabled) {
    return (
      <div className="surface-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">即時畫面</h2>
            <p className="text-sm text-foreground/60">
              目前為窄螢幕回退模式，改用堆疊顯示。桌面寬度下會啟用可拖曳浮動視窗。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="ui-badge ui-badge-primary">
              {windows.length} / {LIVE_VIEW_MAX_STREAMS}
            </span>
            <button type="button" onClick={onCloseAll} className="ui-btn ui-btn-xs ui-btn-muted">
              全部關閉
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {sortedWindows.map((windowState) => (
            <LiveStreamPlayer
              key={windowState.deviceId}
              deviceId={windowState.deviceId}
              title={windowState.title}
              subtitle={windowState.subtitle}
              onClose={() => onClose(windowState.deviceId)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="live-stream-stage-toolbar pointer-events-auto fixed right-6 top-6 z-[90] flex items-center gap-2 rounded-full border border-border/70 bg-surface/90 px-3 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur">
        <span className="ui-badge ui-badge-primary">
          即時畫面 {windows.length} / {LIVE_VIEW_MAX_STREAMS}
        </span>
        <span className="text-xs text-foreground/60">拖曳視窗標頭可自由排列</span>
        <button type="button" onClick={onCloseAll} className="ui-btn ui-btn-xs ui-btn-muted">
          全部關閉
        </button>
      </div>
      <div className="live-stream-stage" aria-label="即時畫面浮動視窗層">
        {sortedWindows.map((windowState) => (
          <LiveStreamWindow
            key={windowState.deviceId}
            windowState={windowState}
            active={windowState.zIndex === sortedWindows[sortedWindows.length - 1]?.zIndex}
            viewportWidth={viewport.width - LIVE_VIEW_WINDOW_STAGE_PADDING * 2}
            viewportHeight={viewport.height - LIVE_VIEW_WINDOW_STAGE_PADDING * 2}
            onClose={onClose}
            onFocus={onFocus}
            onMove={(deviceId, nextX, nextY) => onMove(deviceId, nextX, nextY, viewport)}
            onResize={(deviceId, nextWidth, nextHeight) =>
              onResize(deviceId, nextWidth, nextHeight, viewport)
            }
            onToggleMinimized={onToggleMinimized}
          >
            <LiveStreamPlayer
              deviceId={windowState.deviceId}
              title={windowState.title}
              subtitle={windowState.subtitle}
              compact
              onClose={() => onClose(windowState.deviceId)}
            />
          </LiveStreamWindow>
        ))}
      </div>
    </>
  )
}