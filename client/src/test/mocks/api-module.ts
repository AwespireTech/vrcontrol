import type {
  BatchExecuteResponse,
  BatchStatusResponse,
  MonitoringStatus,
  UserPreference,
} from "@/services/api-types"
import {
  mockActions,
  mockDevices,
  mockIsolationDevices,
  mockPreference,
  mockRooms,
  mockScrcpyConfig,
  mockUsbDevices,
} from "../../../tests/fixtures/mock-data"

type AsyncValue<T> = () => Promise<T>

type ApiModuleMockOverrides = {
  deviceApi?: Partial<typeof deviceApi>
  roomApi?: Partial<typeof roomApi>
  actionApi?: Partial<typeof actionApi>
  monitoringApi?: Partial<typeof monitoringApi>
  scrcpyApi?: Partial<typeof scrcpyApi>
  preferenceApi?: Partial<typeof preferenceApi>
}

const voidAsync = async () => undefined

const deviceApi = {
  getAll: (async () => mockDevices) satisfies AsyncValue<typeof mockDevices>,
  getConnectionStatus: async () => ({
    checked_at: new Date().toISOString(),
    last_successful_check: new Date().toISOString(),
    statuses: mockDevices.map((device) => ({
      device_id: device.device_id,
      status: device.status,
      auto_reconnect_disabled_reason: device.auto_reconnect_disabled_reason,
    })),
  }),
  getIsolation: (async () => mockIsolationDevices) satisfies AsyncValue<
    typeof mockIsolationDevices
  >,
  getUSBDevices: (async () => mockUsbDevices) satisfies AsyncValue<typeof mockUsbDevices>,
  getStatusBatch: (async () =>
    ({
      success: true,
      count: 1,
      results: [
        {
          device_id: mockDevices[0].device_id,
          battery: mockDevices[0].battery,
          temperature: mockDevices[0].temperature,
          is_charging: mockDevices[0].is_charging,
          error: "",
        },
      ],
    }) satisfies BatchStatusResponse) satisfies AsyncValue<BatchStatusResponse>,
  connect: async () => mockDevices[0],
  disconnect: async () => ({
    ...mockDevices[0],
    status: "disconnected",
    auto_reconnect_disabled_reason: "manual_disconnect" as const,
  }),
  delete: voidAsync,
  ping: voidAsync,
  connectBatch: async (): Promise<BatchExecuteResponse> => ({
    success: true,
    total: 1,
    success_count: 1,
    failed_count: 0,
    results: [],
  }),
  pingBatch: async (): Promise<BatchExecuteResponse> => ({
    success: true,
    total: 1,
    success_count: 1,
    failed_count: 0,
    results: [],
  }),
  setAutoReconnectEnabledBatch: async () => ({
    total: 1,
    success_count: 1,
    failed_count: 0,
    failed: {},
  }),
  resetAutoReconnect: async () => mockDevices[0],
  resetAutoReconnectBatch: async () => ({
    total: 1,
    success_count: 1,
    failed_count: 0,
    failed: {},
  }),
  patch: async () => mockDevices[0],
  replace: async () => mockDevices[0],
  enableUSBTCPIP: voidAsync,
}

const roomApi = {
  getAll: (async () => mockRooms) satisfies AsyncValue<typeof mockRooms>,
  get: async (roomId: string) => mockRooms.find((room) => room.room_id === roomId) || null,
  delete: voidAsync,
  updateDevices: async () => mockRooms[0],
}

const actionApi = {
  getAll: (async () => mockActions) satisfies AsyncValue<typeof mockActions>,
  delete: voidAsync,
  executeBatch: async (): Promise<BatchExecuteResponse> => ({
    success: true,
    total: 1,
    success_count: 1,
    failed_count: 0,
    results: [],
  }),
}

const monitoringApi = {
  getStatus: (async () =>
    ({ running: true }) satisfies MonitoringStatus) satisfies AsyncValue<MonitoringStatus>,
  start: voidAsync,
  stop: voidAsync,
  setInterval: voidAsync,
  runOnce: voidAsync,
}

const scrcpyApi = {
  getConfig: (async () => mockScrcpyConfig) satisfies AsyncValue<typeof mockScrcpyConfig>,
  updateConfig: voidAsync,
}

const preferenceApi = {
  get: (async () => mockPreference) satisfies AsyncValue<UserPreference>,
  update: async (preference: Partial<UserPreference>) => ({ ...mockPreference, ...preference }),
}

export function createApiModuleMock(overrides: ApiModuleMockOverrides = {}) {
  return {
    deviceApi: { ...deviceApi, ...overrides.deviceApi },
    roomApi: { ...roomApi, ...overrides.roomApi },
    actionApi: { ...actionApi, ...overrides.actionApi },
    monitoringApi: { ...monitoringApi, ...overrides.monitoringApi },
    scrcpyApi: { ...scrcpyApi, ...overrides.scrcpyApi },
    preferenceApi: { ...preferenceApi, ...overrides.preferenceApi },
  }
}
