import type { PlayerData, Vector3 } from "@/interfaces/room.interface"

import type { RoomMinimapConfig } from "./config"

export type RoomMinimapProjectedPosition = {
  normalizedX: number
  normalizedY: number
  worldX: number
  worldZ: number
  isOutOfBounds: boolean
  wasClamped: boolean
}

export type RoomMinimapHeading = {
  dx: number
  dy: number
}

export type RoomMinimapMarker = {
  deviceId: string
  sequence: number
  readyToMove: boolean
  message: string
  lastUpdate: string
  isStale: boolean
  position: RoomMinimapProjectedPosition
  heading: RoomMinimapHeading | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function isRoomMinimapPlayerStale(player: PlayerData, staleThresholdSeconds: number) {
  const lastUpdateMs = Date.parse(player.last_update)
  if (Number.isNaN(lastUpdateMs)) {
    return true
  }

  return Date.now() - lastUpdateMs > staleThresholdSeconds * 1000
}

export function projectRoomMinimapPosition(
  position: Vector3,
  config: RoomMinimapConfig,
): RoomMinimapProjectedPosition {
  const halfWidth = config.width / 2
  const halfDepth = config.depth / 2

  const worldX = position.x - config.origin.x
  const worldZ = position.z - config.origin.z
  const isOutOfBounds = Math.abs(worldX) > halfWidth || Math.abs(worldZ) > halfDepth

  const projectedX =
    config.clampMode === "clamp" ? clamp(worldX, -halfWidth, halfWidth) : worldX
  const projectedZ =
    config.clampMode === "clamp" ? clamp(worldZ, -halfDepth, halfDepth) : worldZ

  return {
    normalizedX: (projectedX + halfWidth) / config.width,
    normalizedY: 1 - (projectedZ + halfDepth) / config.depth,
    worldX,
    worldZ,
    isOutOfBounds,
    wasClamped: projectedX !== worldX || projectedZ !== worldZ,
  }
}

export function projectRoomMinimapHeading(
  forward: Vector3,
  config: RoomMinimapConfig,
): RoomMinimapHeading | null {
  const planarX = forward.x
  const planarZ = forward.z
  const planarLength = Math.hypot(planarX, planarZ)

  if (planarLength < 0.0001) {
    return null
  }

  const normalizedX = planarX / planarLength
  const normalizedZ = planarZ / planarLength

  return {
    dx: normalizedX * (config.forwardArrowLength / config.width),
    dy: -normalizedZ * (config.forwardArrowLength / config.depth),
  }
}

export function buildRoomMinimapMarkers(
  players: PlayerData[],
  config: RoomMinimapConfig,
): RoomMinimapMarker[] {
  return players.map((player) => ({
    deviceId: player.device_id,
    sequence: player.sequence,
    readyToMove: player.ready_to_move,
    message: player.message,
    lastUpdate: player.last_update,
    isStale: isRoomMinimapPlayerStale(player, config.staleThresholdSeconds),
    position: projectRoomMinimapPosition(player.head_position, config),
    heading: config.display.showForwardArrow
      ? projectRoomMinimapHeading(player.head_forward, config)
      : null,
  }))
}