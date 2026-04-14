import {
  LIVE_VIEW_WINDOW_DEFAULT_HEIGHT,
  LIVE_VIEW_WINDOW_DEFAULT_WIDTH,
  LIVE_VIEW_WINDOW_HEADER_HEIGHT,
  LIVE_VIEW_WINDOW_MIN_HEIGHT,
  LIVE_VIEW_WINDOW_MIN_WIDTH,
  LIVE_VIEW_WINDOW_OFFSET,
  LIVE_VIEW_WINDOW_STAGE_PADDING,
} from "@/environment"

export type LiveStreamWindowState = {
  deviceId: string
  title: string
  subtitle?: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
}

export type LiveStreamWindowTarget = {
  deviceId: string
  title: string
  subtitle?: string
}

type ViewportBounds = {
  width: number
  height: number
}

type OpenLiveStreamWindowResult = {
  windows: LiveStreamWindowState[]
  reachedLimit: boolean
}

function getTopZIndex(windows: LiveStreamWindowState[]) {
  return windows.reduce((max, entry) => Math.max(max, entry.zIndex), 0)
}

function clampWindowPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: ViewportBounds,
) {
  const maxX = Math.max(LIVE_VIEW_WINDOW_STAGE_PADDING, bounds.width - width - LIVE_VIEW_WINDOW_STAGE_PADDING)
  const maxY = Math.max(LIVE_VIEW_WINDOW_STAGE_PADDING, bounds.height - height - LIVE_VIEW_WINDOW_STAGE_PADDING)

  return {
    x: Math.min(maxX, Math.max(LIVE_VIEW_WINDOW_STAGE_PADDING, x)),
    y: Math.min(maxY, Math.max(LIVE_VIEW_WINDOW_STAGE_PADDING, y)),
  }
}

function clampWindowSize(width: number, height: number, bounds: ViewportBounds) {
  const maxWidth = Math.max(LIVE_VIEW_WINDOW_MIN_WIDTH, bounds.width - LIVE_VIEW_WINDOW_STAGE_PADDING * 2)
  const maxHeight = Math.max(
    LIVE_VIEW_WINDOW_MIN_HEIGHT,
    bounds.height - LIVE_VIEW_WINDOW_STAGE_PADDING * 2,
  )

  return {
    width: Math.min(maxWidth, Math.max(LIVE_VIEW_WINDOW_MIN_WIDTH, width)),
    height: Math.min(maxHeight, Math.max(LIVE_VIEW_WINDOW_MIN_HEIGHT, height)),
  }
}

function createWindowState(
  windows: LiveStreamWindowState[],
  target: LiveStreamWindowTarget,
  bounds: ViewportBounds,
): LiveStreamWindowState {
  const cascadeIndex = windows.length
  const availableWidth = Math.max(
    LIVE_VIEW_WINDOW_STAGE_PADDING,
    bounds.width - LIVE_VIEW_WINDOW_DEFAULT_WIDTH - LIVE_VIEW_WINDOW_STAGE_PADDING,
  )
  const availableHeight = Math.max(
    LIVE_VIEW_WINDOW_STAGE_PADDING,
    bounds.height - LIVE_VIEW_WINDOW_DEFAULT_HEIGHT - LIVE_VIEW_WINDOW_STAGE_PADDING,
  )
  const rawX =
    LIVE_VIEW_WINDOW_STAGE_PADDING +
    ((cascadeIndex * LIVE_VIEW_WINDOW_OFFSET) % Math.max(LIVE_VIEW_WINDOW_OFFSET, availableWidth))
  const rawY =
    LIVE_VIEW_WINDOW_STAGE_PADDING +
    56 +
    ((cascadeIndex * LIVE_VIEW_WINDOW_OFFSET) % Math.max(LIVE_VIEW_WINDOW_OFFSET, availableHeight))
  const position = clampWindowPosition(
    rawX,
    rawY,
    LIVE_VIEW_WINDOW_DEFAULT_WIDTH,
    LIVE_VIEW_WINDOW_DEFAULT_HEIGHT,
    bounds,
  )

  return {
    deviceId: target.deviceId,
    title: target.title,
    subtitle: target.subtitle,
    width: LIVE_VIEW_WINDOW_DEFAULT_WIDTH,
    height: LIVE_VIEW_WINDOW_DEFAULT_HEIGHT,
    x: position.x,
    y: position.y,
    zIndex: getTopZIndex(windows) + 1,
    minimized: false,
  }
}

export function openOrFocusLiveStreamWindow(
  windows: LiveStreamWindowState[],
  target: LiveStreamWindowTarget,
  bounds: ViewportBounds,
  maxStreams: number,
): OpenLiveStreamWindowResult {
  const existing = windows.find((entry) => entry.deviceId === target.deviceId)
  if (existing) {
    return {
      windows: bringLiveStreamWindowToFront(windows, target.deviceId),
      reachedLimit: false,
    }
  }

  if (windows.length >= maxStreams) {
    return { windows, reachedLimit: true }
  }

  return {
    windows: [...windows, createWindowState(windows, target, bounds)],
    reachedLimit: false,
  }
}

export function openManyLiveStreamWindows(
  windows: LiveStreamWindowState[],
  targets: LiveStreamWindowTarget[],
  bounds: ViewportBounds,
  maxStreams: number,
) {
  let nextWindows = [...windows]
  let droppedCount = 0

  for (const target of targets) {
    const result = openOrFocusLiveStreamWindow(nextWindows, target, bounds, maxStreams)
    nextWindows = result.windows
    if (result.reachedLimit) {
      droppedCount += 1
    }
  }

  return {
    windows: nextWindows,
    droppedCount,
  }
}

export function bringLiveStreamWindowToFront(
  windows: LiveStreamWindowState[],
  deviceId: string,
) {
  const nextZIndex = getTopZIndex(windows) + 1
  return windows.map((entry) =>
    entry.deviceId === deviceId ? { ...entry, zIndex: nextZIndex } : entry,
  )
}

export function moveLiveStreamWindow(
  windows: LiveStreamWindowState[],
  deviceId: string,
  nextX: number,
  nextY: number,
  bounds: ViewportBounds,
) {
  return windows.map((entry) => {
    if (entry.deviceId !== deviceId) return entry
    const position = clampWindowPosition(nextX, nextY, entry.width, entry.height, bounds)
    return {
      ...entry,
      x: position.x,
      y: position.y,
    }
  })
}

export function resizeLiveStreamWindow(
  windows: LiveStreamWindowState[],
  deviceId: string,
  nextWidth: number,
  nextHeight: number,
  bounds: ViewportBounds,
) {
  return windows.map((entry) => {
    if (entry.deviceId !== deviceId) return entry
    const size = clampWindowSize(nextWidth, nextHeight, bounds)
    const position = clampWindowPosition(entry.x, entry.y, size.width, size.height, bounds)
    return {
      ...entry,
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
    }
  })
}

export function toggleLiveStreamWindowMinimized(
  windows: LiveStreamWindowState[],
  deviceId: string,
) {
  const nextZIndex = getTopZIndex(windows) + 1
  return windows.map((entry) =>
    entry.deviceId === deviceId
      ? { ...entry, minimized: !entry.minimized, zIndex: nextZIndex }
      : entry,
  )
}

export function getLiveStreamWindowDisplayHeight(entry: LiveStreamWindowState) {
  return entry.minimized ? LIVE_VIEW_WINDOW_HEADER_HEIGHT : entry.height
}

export function closeLiveStreamWindow(windows: LiveStreamWindowState[], deviceId: string) {
  return windows.filter((entry) => entry.deviceId !== deviceId)
}