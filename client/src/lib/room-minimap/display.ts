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

export function buildRoomMinimapDisplayMarkers(
  markers: RoomMinimapMarker[],
  players: PlayerData[],
  deviceMap: Map<string, Device>,
): RoomMinimapDisplayMarker[] {
  const playerByDeviceId = new Map(players.map((player) => [player.device_id, player]))

  return markers.map((marker) => {
    const player = playerByDeviceId.get(marker.deviceId)
    const device = deviceMap.get(marker.deviceId)
    const shortLabel = buildFallbackShortLabel(marker)

    return {
      ...marker,
      displayName: device ? getDisplayName(device) : shortLabel,
      shortLabel,
      secondaryLabel: marker.deviceId,
      chapter: player?.chapter ?? 0,
      adbStatus: device?.status,
      wsStatus: device?.ws_status,
      hasDeviceMetadata: !!device,
    }
  })
}