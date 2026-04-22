export type RoomMinimapOrigin = {
  x: number
  z: number
}

export type RoomMinimapClampMode = "clamp" | "allow-overflow"

export type RoomMinimapDisplayOptions = {
  showGrid: boolean
  showCenterCrosshair: boolean
  showPlayerLabels: boolean
  showForwardArrow: boolean
}

export type RoomMinimapConfig = {
  width: number
  depth: number
  origin: RoomMinimapOrigin
  clampMode: RoomMinimapClampMode
  staleThresholdSeconds: number
  forwardArrowLength: number
  display: RoomMinimapDisplayOptions
}

const DEFAULT_ROOM_MINIMAP_CONFIG: RoomMinimapConfig = {
  width: 6,
  depth: 6,
  origin: { x: 0, z: 0 },
  clampMode: "clamp",
  staleThresholdSeconds: 5,
  forwardArrowLength: 0.45,
  display: {
    showGrid: true,
    showCenterCrosshair: true,
    showPlayerLabels: true,
    showForwardArrow: true,
  },
}

export function getRoomMinimapConfig(_roomId: string): RoomMinimapConfig {
  // Keep the current source fixed so the UI has a stable contract.
  // This function is the future replacement point for room parameters or API data.
  return DEFAULT_ROOM_MINIMAP_CONFIG
}
