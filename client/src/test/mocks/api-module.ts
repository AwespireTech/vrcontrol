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
  mockScrcpySessions,
  mockScrcpySystemInfo,
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
  getIsolation: (async () => mockIsolationDevices) satisfies AsyncValue<typeof mockIsolationDevices>,
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
  connect: voidAsync,
  disconnect: voidAsync,
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
  getStatus: (async () => ({ running: true }) satisfies MonitoringStatus) satisfies AsyncValue<MonitoringStatus>,
  start: voidAsync,
  stop: voidAsync,
  setInterval: voidAsync,
  runOnce: voidAsync,
}

const scrcpyApi = {
  getSystemInfo: (async () => mockScrcpySystemInfo) satisfies AsyncValue<typeof mockScrcpySystemInfo>,
  getConfig: (async () => mockScrcpyConfig) satisfies AsyncValue<typeof mockScrcpyConfig>,
  getSessions: (async () => mockScrcpySessions) satisfies AsyncValue<typeof mockScrcpySessions>,
  refreshSessions: (async () => mockScrcpySessions) satisfies AsyncValue<typeof mockScrcpySessions>,
  stop: voidAsync,
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