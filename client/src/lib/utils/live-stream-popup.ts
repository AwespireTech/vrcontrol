import {
  LIVE_STREAM_POPUP_DEFAULT_HEIGHT,
  LIVE_STREAM_POPUP_DEFAULT_LEFT,
  LIVE_STREAM_POPUP_DEFAULT_TOP,
  LIVE_STREAM_POPUP_DEFAULT_WIDTH,
} from "@/environment"

export const LIVE_STREAM_POPUP_PATH = "/live-stream-popup"
export const LIVE_STREAM_POPUP_WINDOW_NAME = "vrcontrol-live-stream-popup"

type LiveStreamPopupOpenOptions = {
  source?: "rooms" | "devices"
  roomId?: string
  layout?: "stack" | "grid"
}

function buildPopupFeatures() {
  return [
    `width=${LIVE_STREAM_POPUP_DEFAULT_WIDTH}`,
    `height=${LIVE_STREAM_POPUP_DEFAULT_HEIGHT}`,
    `left=${LIVE_STREAM_POPUP_DEFAULT_LEFT}`,
    `top=${LIVE_STREAM_POPUP_DEFAULT_TOP}`,
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
    "toolbar=no",
    "menubar=no",
    "location=no",
    "status=no",
  ].join(",")
}

function buildPopupUrl(options: LiveStreamPopupOpenOptions) {
  const params = new URLSearchParams()

  if (options.source) params.set("source", options.source)
  if (options.roomId) params.set("roomId", options.roomId)
  if (options.layout) params.set("layout", options.layout)

  const query = params.toString()
  return query ? `${LIVE_STREAM_POPUP_PATH}?${query}` : LIVE_STREAM_POPUP_PATH
}

export function openLiveStreamPopupWindow(options: LiveStreamPopupOpenOptions = {}) {
  const popup = window.open(
    buildPopupUrl(options),
    LIVE_STREAM_POPUP_WINDOW_NAME,
    buildPopupFeatures(),
  )

  if (popup) {
    popup.focus()
  }

  return popup
}