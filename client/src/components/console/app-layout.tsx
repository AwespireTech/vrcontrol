import { Outlet } from "react-router-dom"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import AppSidebar from "./app-sidebar"

const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 420
const SIDEBAR_COLLAPSED_WIDTH = 68
const SMALL_SCREEN_QUERY = "(max-width: 1024px)"

export default function AppLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(296)
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const autoCollapsedRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(296)

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging) return
      const delta = event.clientX - dragStartXRef.current
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, dragStartWidthRef.current + delta),
      )
      setSidebarWidth(nextWidth)
    },
    [dragging],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(false)
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
    window.removeEventListener("pointermove", handlePointerMove)
    window.removeEventListener("pointerup", handlePointerUp)
  }, [handlePointerMove])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (collapsed) return
      setDragging(true)
      dragStartXRef.current = event.clientX
      dragStartWidthRef.current = sidebarWidth
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [collapsed, handlePointerMove, handlePointerUp, sidebarWidth],
  )

  useEffect(() => {
    const media = window.matchMedia(SMALL_SCREEN_QUERY)
    if (media.matches) {
      setCollapsed(true)
      autoCollapsedRef.current = true
    }
  }, [])

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  const handleToggleCollapsed = () => {
    setCollapsed((prev) => !prev)
    autoCollapsedRef.current = false
  }

  return (
    <div className="relative -m-10 min-h-screen bg-background text-foreground">
      <AppSidebar
        collapsed={collapsed}
        dragging={dragging}
        collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
        width={sidebarWidth}
        onToggleCollapsed={handleToggleCollapsed}
        onResizePointerDown={handlePointerDown}
      />
      <div
        className={`relative box-border min-h-screen w-full ${dragging ? "" : "transition-[padding] duration-200"}`}
        style={{ paddingLeft: collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth }}
      >
        <div className="min-h-screen w-full">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
