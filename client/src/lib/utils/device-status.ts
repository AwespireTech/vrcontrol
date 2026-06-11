import { DEVICE_STATUS, type Device } from "@/services/api-types"

export function getAdbStatusText(status?: Device["status"]) {
  switch (status) {
    case DEVICE_STATUS.ONLINE:
      return "在線"
    case DEVICE_STATUS.OFFLINE:
      return "離線"
    case DEVICE_STATUS.CONNECTING:
      return "連線中"
    case DEVICE_STATUS.ERROR:
      return "錯誤"
    case DEVICE_STATUS.DISCONNECTED:
      return "手動斷開"
    default:
      return "未知"
  }
}

export function getAdbStatusBadgeClass(status?: Device["status"]) {
  switch (status) {
    case DEVICE_STATUS.ONLINE:
      return "ui-badge-success"
    case DEVICE_STATUS.CONNECTING:
      return "ui-badge-warning"
    case DEVICE_STATUS.ERROR:
      return "ui-badge-danger"
    case DEVICE_STATUS.OFFLINE:
    case DEVICE_STATUS.DISCONNECTED:
    default:
      return "ui-badge-muted"
  }
}

export function getWsStatusText(status?: Device["ws_status"]) {
  switch (status) {
    case "connected":
      return "已連線"
    case "disconnected":
      return "已中斷"
    default:
      return "未知"
  }
}

export function getWsStatusBadgeClass(status?: Device["ws_status"]) {
  switch (status) {
    case "connected":
      return "ui-badge-success"
    case "disconnected":
      return "ui-badge-danger"
    default:
      return "ui-badge-muted"
  }
}

type AdbStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS]

export function isSupportedDeviceStatus(status?: string): status is AdbStatus {
  return !!status && (Object.values(DEVICE_STATUS) as string[]).includes(status)
}