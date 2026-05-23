import type { Page, Route } from "@playwright/test"
import {
  mockActions,
  mockDevices,
  mockIsolationDevices,
  mockPreference,
  mockRooms,
  mockScrcpySessions,
  mockScrcpySystemInfo,
  mockUsbDevices,
} from "../../fixtures/mock-data"

function fulfillJson(route: Route, payload: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  })
}

export async function registerMockApiRoutes(page: Page) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl

    switch (pathname) {
      case "/api/devices":
        return fulfillJson(route, { success: true, data: mockDevices })
      case "/api/devices/isolation":
        return fulfillJson(route, { success: true, data: mockIsolationDevices })
      case "/api/devices/usb":
        return fulfillJson(route, { success: true, data: mockUsbDevices })
      case "/api/devices/batch/status":
        return fulfillJson(route, {
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
        })
      case "/api/rooms":
        return fulfillJson(route, { success: true, data: mockRooms })
      case "/api/actions":
        return fulfillJson(route, { success: true, data: mockActions })
      case "/api/monitoring/status":
        return fulfillJson(route, { success: true, data: { running: true } })
      case "/api/preferences":
        return fulfillJson(route, { success: true, data: mockPreference })
      case "/api/scrcpy/system-info":
        return fulfillJson(route, { success: true, data: mockScrcpySystemInfo })
      case "/api/scrcpy/sessions":
      case "/api/scrcpy/sessions/refresh":
        return fulfillJson(route, { success: true, data: mockScrcpySessions })
      default:
        return fulfillJson(route, { success: true, data: null })
    }
  })
}