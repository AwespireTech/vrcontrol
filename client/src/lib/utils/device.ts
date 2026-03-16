import type { Device } from "@/services/api-types"

/**
 * 獲取設備的顯示名稱
 * 優先順序: alias > name > device_id
 * @param device 設備對象
 * @returns 設備的顯示名稱
 */
export function getDisplayName(device: Device): string {
  return device.alias || device.name || device.device_id
}
