import { useMemo } from "react"
import LiveStreamPlayer from "@/components/console/live-stream-player"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

export type LiveStreamLayout = "stack" | "grid"

type LiveStreamStageProps = {
  windows: LiveStreamWindowState[]
  layout: LiveStreamLayout
  selectedDeviceId?: string | null
  onClose?: (deviceId: string) => void
}

export default function LiveStreamStage({
  windows,
  layout,
  selectedDeviceId,
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
          data-device-id={windowState.deviceId}
          aria-selected={selectedDeviceId === windowState.deviceId}
          className={`${
            layout === "grid" ? "live-stream-inline-grid__item" : "live-stream-inline-stack__item"
          } ${
            selectedDeviceId === windowState.deviceId
              ? "rounded-[1.25rem] border border-primary/80 bg-primary/10 p-1 shadow-[0_0_0_1px_rgba(96,165,250,0.32),0_16px_42px_-28px_rgba(96,165,250,0.95)]"
              : ""
          }`}
        >
          <LiveStreamPlayer
            deviceId={windowState.deviceId}
            title={windowState.title}
            subtitle={windowState.subtitle}
            compact={layout === "grid"}
            onClose={onClose ? () => onClose(windowState.deviceId) : undefined}
          />
        </div>
      ))}
    </div>
  )
}