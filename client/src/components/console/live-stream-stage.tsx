import { useMemo } from "react"
import LiveStreamPlayer from "@/components/console/live-stream-player"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

export type LiveStreamLayout = "stack" | "grid"

type LiveStreamStageProps = {
  windows: LiveStreamWindowState[]
  layout: LiveStreamLayout
  onClose: (deviceId: string) => void
}

export default function LiveStreamStage({
  windows,
  layout,
  onClose,
}: LiveStreamStageProps) {
  const sortedWindows = useMemo(
    () => [...windows].sort((left, right) => left.zIndex - right.zIndex),
    [windows],
  )

  if (windows.length === 0) return null

  return (
    <div
      className={
        layout === "grid"
          ? "live-stream-inline-grid"
          : "live-stream-inline-stack"
      }
      aria-label="即時串流區段"
    >
      {sortedWindows.map((windowState) => (
        <div
          key={windowState.deviceId}
          className={layout === "grid" ? "live-stream-inline-grid__item" : "live-stream-inline-stack__item"}
        >
          <LiveStreamPlayer
            deviceId={windowState.deviceId}
            title={windowState.title}
            subtitle={windowState.subtitle}
            compact={layout === "grid"}
            onClose={() => onClose(windowState.deviceId)}
          />
        </div>
      ))}
    </div>
  )
}