import { useMemo } from "react"

import { getRoomMinimapConfig } from "@/lib/room-minimap/config"

export function useRoomMinimapConfig(roomId: string) {
  return useMemo(() => getRoomMinimapConfig(roomId), [roomId])
}