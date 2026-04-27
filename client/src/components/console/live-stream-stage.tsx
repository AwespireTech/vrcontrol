import { useMemo } from "react"
import LiveStreamPlayer from "@/components/console/live-stream-player"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

export type LiveStreamLayout = "stack" | "grid"
const LIVE_STREAM_INTERACTIVE_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  '[role="button"]',
  '[role="link"]',
].join(", ")

function shouldIgnoreLiveStreamSelectionEvent(
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

  const interactiveTarget = targetElement.closest(LIVE_STREAM_INTERACTIVE_SELECTOR)
  return !!interactiveTarget && interactiveTarget !== currentTarget
}

type LiveStreamStageProps = {
  windows: LiveStreamWindowState[]
  layout: LiveStreamLayout
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
  onClose?: (deviceId: string) => void
}

export default function LiveStreamStage({
  windows,
  layout,
  selectedDeviceId,
  onSelectDevice,
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
          role={onSelectDevice ? "button" : undefined}
          tabIndex={onSelectDevice ? 0 : undefined}
          data-device-id={windowState.deviceId}
          aria-selected={selectedDeviceId === windowState.deviceId}
          onClick={
            onSelectDevice
              ? (event) => {
                  if (shouldIgnoreLiveStreamSelectionEvent(event.target, event.currentTarget)) {
                    return
                  }

                  onSelectDevice(windowState.deviceId)
                }
              : undefined
          }
          onKeyDown={
            onSelectDevice
              ? (event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return
                  }

                  if (shouldIgnoreLiveStreamSelectionEvent(event.target, event.currentTarget)) {
                    return
                  }

                  event.preventDefault()
                  onSelectDevice(windowState.deviceId)
                }
              : undefined
          }
          className={`selection-surface ${
            layout === "grid" ? "live-stream-inline-grid__item" : "live-stream-inline-stack__item"
          } ${
            selectedDeviceId === windowState.deviceId
              ? "selection-surface-selected rounded-[1.25rem] p-1"
              : "rounded-[1.25rem] p-1"
          } ${
            onSelectDevice ? "selection-surface-interactive cursor-pointer" : ""
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