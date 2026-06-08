import {
  ACTION_TYPES,
  DEVICE_STATUS,
  type Action,
  type Device,
  type IsolationDevice,
  type Room,
  type ScrcpyConfig,
  type USBDevice,
  type UserPreference,
} from "../../src/services/api-types"

const timestamp = "2026-05-23T09:00:00Z"

export const mockDevices: Device[] = [
  {
    device_id: "device-quest-01",
    serial: "SERIAL-QUEST-01",
    alias: "Quest 3 Demo",
    name: "Quest 3 Demo",
    model: "Meta Quest 3",
    android_version: "14",
    ip: "192.168.0.101",
    port: 5555,
    status: DEVICE_STATUS.ONLINE,
    battery: 92,
    temperature: 31,
    is_charging: true,
    ping_ms: 22,
    ping_status: "ok",
    room_id: "room-main-stage",
    notes: "Primary demo headset",
    auto_reconnect_enabled: true,
    ws_status: "connected",
    ws_last_seen: timestamp,
    last_seen: timestamp,
    first_connected: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    device_id: "device-pico-02",
    serial: "SERIAL-PICO-02",
    alias: "Pico Backup",
    name: "Pico Backup",
    model: "Pico 4",
    android_version: "13",
    ip: "192.168.0.102",
    port: 5555,
    status: DEVICE_STATUS.OFFLINE,
    battery: 0,
    temperature: 0,
    is_charging: false,
    ping_ms: 0,
    ping_status: "unknown",
    room_id: "",
    notes: "Backup device",
    auto_reconnect_enabled: true,
    ws_status: "disconnected",
    ws_last_seen: timestamp,
    last_seen: timestamp,
    first_connected: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  },
]

export const mockRooms: Room[] = [
  {
    room_id: "room-main-stage",
    name: "主展示區",
    description: "主要展示與導覽房間",
    max_devices: 4,
    device_ids: [mockDevices[0].device_id],
    assigned_sequences: {},
    socket_ip: "127.0.0.1",
    socket_port: 9001,
    socket_running: true,
    parameters: {},
    operation_profile: {
      activity_defaults: {
        name: "Main Stage Demo",
        activity_context: {},
      },
      batch_action_ids: [],
      allow_activity_name_override: true,
      allow_seed_override: true,
    },
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    room_id: "room-training",
    name: "訓練區",
    description: "備用教學與操作區",
    max_devices: 2,
    device_ids: [],
    assigned_sequences: {},
    socket_ip: "127.0.0.1",
    socket_port: 9002,
    socket_running: false,
    parameters: {},
    operation_profile: {
      activity_defaults: {
        name: "Training",
        activity_context: {},
      },
      batch_action_ids: [],
      allow_activity_name_override: true,
      allow_seed_override: false,
    },
    created_at: timestamp,
    updated_at: timestamp,
  },
]

export const mockActions: Action[] = [
  {
    action_id: "action-launch-home",
    name: "啟動 Home App",
    description: "開啟展示用 Home App",
    action_type: ACTION_TYPES.LAUNCH_APP,
    params: { package_name: "com.demo.home" },
    execution_count: 10,
    success_count: 9,
    failure_count: 1,
    last_executed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    action_id: "action-sleep-all",
    name: "全部休眠",
    description: "讓所有裝置進入待機",
    action_type: ACTION_TYPES.SLEEP,
    params: {},
    execution_count: 5,
    success_count: 5,
    failure_count: 0,
    last_executed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  },
]

export const mockIsolationDevices: IsolationDevice[] = [
  {
    client_id: "isolation-client-1",
    device_id: mockDevices[0].device_id,
    ip: mockDevices[0].ip,
    valid: true,
    id_matched: true,
    ip_matched: true,
    connected_at: timestamp,
    last_seen: timestamp,
  },
]

export const mockUsbDevices: USBDevice[] = [
  {
    serial: "USB-QUEST-01",
    state: "device",
    model: "Meta Quest 3",
    ip: mockDevices[0].ip,
    connection_type: "usb",
    tcpip_enabled: true,
    tcpip_port: 5555,
  },
]

export const mockScrcpyConfig: ScrcpyConfig = {
  bitrate: "8M",
  max_size: 1920,
  max_fps: 60,
  video_codec_options: "",
}

export const mockPreference: UserPreference = {
  poll_interval_sec: 5,
  batch_size: 8,
  max_concurrency: 1,
  reconnect_cooldown_sec: 30,
  reconnect_max_retries: 5,
  updated_at: timestamp,
}