export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface PlayerData {
  device_id: string
  message: string
  chapter: number
  sequence: number
  ready_to_move: boolean
  left_hand_available: boolean
  left_hand_position: Vector3
  left_hand_forward: Vector3
  right_hand_available: boolean
  right_hand_position: Vector3
  right_hand_forward: Vector3
  head_position: Vector3
  head_forward: Vector3
  last_update: string
}

export interface RoomInfoData {
  room_id: string
  players: PlayerData[]
  player_count: number
}
