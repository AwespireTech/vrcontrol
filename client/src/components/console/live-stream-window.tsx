import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { getLiveStreamWindowDisplayHeight } from "@/lib/utils/live-stream-windows"
import type { LiveStreamWindowState } from "@/lib/utils/live-stream-windows"

type LiveStreamWindowProps = {
  windowState: LiveStreamWindowState
  active: boolean
  viewportWidth: number
  viewportHeight: number
  onClose: (deviceId: string) => void
  onFocus: (deviceId: string) => void
  onMove: (deviceId: string, nextX: number, nextY: number) => void
  onResize: (deviceId: string, nextWidth: number, nextHeight: number) => void
  onToggleMinimized: (deviceId: string) => void
  children: ReactNode
}

export default function LiveStreamWindow({
  windowState,
  active,
  viewportWidth,
  viewportHeight,
  onClose,
  onFocus,
  onMove,
  onResize,
  onToggleMinimized,
  children,
}: LiveStreamWindowProps) {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const dragPointerOffsetRef = useRef({ x: 0, y: 0 })
  const windowStateRef = useRef(windowState)
  const onMoveRef = useRef(onMove)
  const onResizeRef = useRef(onResize)
  const resizeStartRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })
  const draggingRef = useRef(false)
  const resizingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    windowStateRef.current = windowState
  }, [windowState])

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return
      }

      if (draggingRef.current) {
        const nextX = event.clientX - dragPointerOffsetRef.current.x
        const nextY = event.clientY - dragPointerOffsetRef.current.y
        onMoveRef.current(windowStateRef.current.deviceId, nextX, nextY)
        return
      }

      if (resizingRef.current) {
        const nextWidth = resizeStartRef.current.width + (event.clientX - resizeStartRef.current.x)
        const nextHeight = resizeStartRef.current.height + (event.clientY - resizeStartRef.current.y)
        onResizeRef.current(windowStateRef.current.deviceId, nextWidth, nextHeight)
      }
    },
    [],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(false)
    setResizing(false)
    draggingRef.current = false
    resizingRef.current = false
    activePointerIdRef.current = null
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
  }, [])

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return
    }

    event.preventDefault()
    onFocus(windowState.deviceId)
    setDragging(true)
    setResizing(false)
    draggingRef.current = true
    resizingRef.current = false
    activePointerIdRef.current = event.pointerId
    dragPointerOffsetRef.current = {
      x: event.clientX - windowState.x,
      y: event.clientY - windowState.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.userSelect = "none"
    document.body.style.cursor = "grabbing"
  }

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onFocus(windowState.deviceId)
    setResizing(true)
    setDragging(false)
    resizingRef.current = true
    draggingRef.current = false
    activePointerIdRef.current = event.pointerId
    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: windowState.width,
      height: windowState.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.userSelect = "none"
    document.body.style.cursor = "nwse-resize"
  }

  const displayHeight = Math.min(getLiveStreamWindowDisplayHeight(windowState), viewportHeight)

  return (
    <div
      className={`live-stream-window pointer-events-auto ${active ? "is-active" : ""}`}
      style={{
        width: Math.min(windowState.width, viewportWidth),
        height: displayHeight,
        left: windowState.x,
        top: windowState.y,
        zIndex: windowState.zIndex,
      }}
      onPointerDown={() => onFocus(windowState.deviceId)}
    >
      <div className="live-stream-window__header" onPointerDown={handleHeaderPointerDown}>
        <div className="live-stream-window__title-group">
          <div className="live-stream-window__grip" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{windowState.title}</div>
            {windowState.subtitle ? (
              <div className="truncate text-[11px] text-foreground/55">{windowState.subtitle}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleMinimized(windowState.deviceId)}
            className="ui-btn ui-btn-xs ui-btn-muted live-stream-window__close"
            aria-label={windowState.minimized ? `展開 ${windowState.title}` : `最小化 ${windowState.title}`}
          >
            {windowState.minimized ? "展開" : "最小化"}
          </button>
          <button
            type="button"
            onClick={() => onClose(windowState.deviceId)}
            className="ui-btn ui-btn-xs ui-btn-muted live-stream-window__close"
            aria-label={`關閉 ${windowState.title}`}
          >
            關閉
          </button>
        </div>
      </div>
      {!windowState.minimized ? <div className="live-stream-window__body">{children}</div> : null}
      {!windowState.minimized ? (
        <button
          type="button"
          className={`live-stream-window__resize-handle ${resizing ? "is-resizing" : ""}`}
          onPointerDown={handleResizePointerDown}
          aria-label={`調整 ${windowState.title} 視窗大小`}
        />
      ) : null}
    </div>
  )
}