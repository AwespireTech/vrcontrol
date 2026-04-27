import {
  LIVE_STREAM_POPUP_DEFAULT_HEIGHT,
  LIVE_STREAM_POPUP_DEFAULT_LEFT,
  LIVE_STREAM_POPUP_DEFAULT_TOP,
  LIVE_STREAM_POPUP_DEFAULT_WIDTH,
} from "@/environment"
import type { LiveStreamLayout } from "@/components/console/live-stream-stage"

export const LIVE_STREAM_POPUP_PATH = "/live-stream-popup"
export const LIVE_STREAM_POPUP_WINDOW_NAME = "vrcontrol-live-stream-popup"
export const LIVE_STREAM_POPUP_CHANNEL_NAME = "vrcontrol-live-stream-popup-channel"
export const LIVE_STREAM_POPUP_BLOCKED_MESSAGE =
  "無法開啟新視窗，請確認瀏覽器已允許此網站彈出視窗"

export type LiveStreamPopupSource = "rooms" | "devices"

export type LiveStreamPopupOpenOptions = {
  source?: LiveStreamPopupSource
  roomId?: string
  layout?: LiveStreamLayout
}

export type LiveStreamPopupStream = {
  deviceId: string
  title: string
  subtitle?: string
}

export type LiveStreamPopupState = {
  source?: LiveStreamPopupSource
  roomId?: string
  layout: LiveStreamLayout
  selectedDeviceId?: string | null
  streams: LiveStreamPopupStream[]
  timestamp: number
}

export type LiveStreamPopupMessage =
  | {
      type: "popup-ready"
      source?: LiveStreamPopupSource
      roomId?: string
      timestamp: number
    }
  | {
      type: "init" | "state-update"
      payload: LiveStreamPopupState
    }
  | {
      type: "takeover-requested" | "takeover-released"
      source?: LiveStreamPopupSource
      roomId?: string
      timestamp: number
    }
  | {
      type: "popup-closing" | "source-unavailable"
      source?: LiveStreamPopupSource
      roomId?: string
      timestamp: number
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

export function isLiveStreamPopupChannelSupported() {
  return typeof window !== "undefined" && "BroadcastChannel" in window
}

export function createLiveStreamPopupChannel() {
  if (!isLiveStreamPopupChannelSupported()) {
    return null
  }

  return new BroadcastChannel(LIVE_STREAM_POPUP_CHANNEL_NAME)
}

export function postLiveStreamPopupMessage(
  channel: BroadcastChannel | null,
  message: LiveStreamPopupMessage,
) {
  channel?.postMessage(message)
}

export function subscribeLiveStreamPopupChannel(
  channel: BroadcastChannel | null,
  listener: (message: LiveStreamPopupMessage) => void,
) {
  if (!channel) {
    return () => undefined
  }

  const handleMessage = (event: MessageEvent<LiveStreamPopupMessage>) => {
    listener(event.data)
  }

  channel.addEventListener("message", handleMessage)

  return () => {
    channel.removeEventListener("message", handleMessage)
  }
}