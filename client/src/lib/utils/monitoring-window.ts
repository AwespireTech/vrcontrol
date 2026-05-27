import type { LiveStreamLayout } from "@/components/console/live-stream-stage"

const MONITORING_WINDOW_DEFAULT_WIDTH = 1440
const MONITORING_WINDOW_DEFAULT_HEIGHT = 960
const MONITORING_WINDOW_DEFAULT_LEFT = 96
const MONITORING_WINDOW_DEFAULT_TOP = 72

export const MONITORING_WINDOW_BLOCKED_MESSAGE =
  "無法開啟監控視窗，請確認瀏覽器已允許此網站彈出視窗"

export type RoomMonitoringOpenOptions = {
  display?: "page" | "wall"
  layout?: LiveStreamLayout
}

export function buildRoomMonitoringPath(roomId: string, options: RoomMonitoringOpenOptions = {}) {
  const params = new URLSearchParams()

  if (options.display && options.display !== "page") {
    params.set("display", options.display)
  }
  if (options.layout) {
    params.set("layout", options.layout)
  }

  const query = params.toString()
  const path = `/monitoring/rooms/${encodeURIComponent(roomId)}`
  return query ? `${path}?${query}` : path
}

function buildMonitoringWindowFeatures() {
  return [
    `width=${MONITORING_WINDOW_DEFAULT_WIDTH}`,
    `height=${MONITORING_WINDOW_DEFAULT_HEIGHT}`,
    `left=${MONITORING_WINDOW_DEFAULT_LEFT}`,
    `top=${MONITORING_WINDOW_DEFAULT_TOP}`,
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
    "toolbar=no",
    "menubar=no",
    "location=no",
    "status=no",
  ].join(",")
}

export function openRoomMonitoringWindow(roomId: string, options: RoomMonitoringOpenOptions = {}) {
  const popup = window.open(
    buildRoomMonitoringPath(roomId, options),
    `vrcontrol-monitoring-${roomId}`,
    buildMonitoringWindowFeatures(),
  )

  if (popup) {
    popup.focus()
  }

  return popup
}
