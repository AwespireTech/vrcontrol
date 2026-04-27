import { getDisplayName } from "@/lib/utils/device"
import type { PlayerData } from "@/interfaces/room.interface"
import type { Device } from "@/services/api-types"

import type { RoomMinimapMarker } from "./mappers"

export type RoomMinimapDisplayMarker = RoomMinimapMarker & {
  displayName: string
  shortLabel: string
  secondaryLabel: string
  chapter: number
  adbStatus?: Device["status"]
  wsStatus?: Device["ws_status"]
  hasDeviceMetadata: boolean
}

function buildFallbackShortLabel(marker: RoomMinimapMarker) {
  if (marker.sequence > 0) {
    return `P${marker.sequence}`
  }

  return marker.deviceId.slice(-4).toUpperCase()
}

function buildAliasShortLabel(displayName: string, fallbackLabel: string) {
  const trimmed = displayName.trim()
  if (!trimmed) {
    return fallbackLabel
  }

  const tokens = trimmed.split(/[\s_-]+/).filter(Boolean)
  if (tokens.length > 1) {
    const initials = tokens
      .slice(0, 3)
      .map((token) => token[0])
      .join("")
      .toUpperCase()

    if (initials.length >= 2) {
      return initials
    }
  }

  return trimmed.length <= 6 ? trimmed : `${trimmed.slice(0, 5)}…`
}

export function buildRoomMinimapDisplayMarkers(
  markers: RoomMinimapMarker[],
  players: PlayerData[],
  deviceMap: Map<string, Device>,
): RoomMinimapDisplayMarker[] {
  const playerByDeviceId = new Map(players.map((player) => [player.device_id, player]))

  return markers.map((marker) => {
    const player = playerByDeviceId.get(marker.deviceId)
    const device = deviceMap.get(marker.deviceId)
    const fallbackLabel = buildFallbackShortLabel(marker)
    const displayName = device ? getDisplayName(device) : fallbackLabel

    return {
      ...marker,
      displayName,
      shortLabel: buildAliasShortLabel(displayName, fallbackLabel),
      secondaryLabel: marker.deviceId,
      chapter: player?.chapter ?? 0,
      adbStatus: device?.status,
      wsStatus: device?.ws_status,
      hasDeviceMetadata: !!device,
    }
  })
}