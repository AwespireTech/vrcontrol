import type { Device, DeviceConnectionStatus } from "@/services/api-types"

/**
 * 獲取設備的顯示名稱
 * 優先順序: alias > name > device_id
 * @param device 設備對象
 * @returns 設備的顯示名稱
 */
export function getDisplayName(device: Device): string {
  return device.alias || device.name || device.device_id
}

export function mergeDeviceConnectionStatus(
  device: Device,
  status?: DeviceConnectionStatus,
): Device {
  if (!status) return device
  return {
    ...device,
    status: status.status,
    auto_reconnect_disabled_reason: status.auto_reconnect_disabled_reason,
    auto_reconnect_retry_count: status.auto_reconnect_retry_count,
    auto_reconnect_next_attempt_at: status.auto_reconnect_next_attempt_at,
    auto_reconnect_last_error: status.auto_reconnect_last_error,
  }
}
