import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockDevices } from "../../tests/fixtures/mock-data"
import { renderRoute } from "./render-app"

const { getConnectionStatusMock, disconnectMock } = vi.hoisted(() => ({
  getConnectionStatusMock: vi.fn(),
  disconnectMock: vi.fn(),
}))

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock({
    deviceApi: {
      getConnectionStatus: getConnectionStatusMock,
      disconnect: disconnectMock,
    },
  })
})

function connectionSnapshot(status: string) {
  return {
    checked_at: "2026-08-23T12:00:00Z",
    last_successful_check: "2026-08-23T12:00:00Z",
    statuses: mockDevices.map((device) => ({
      device_id: device.device_id,
      status: device.device_id === mockDevices[0].device_id ? status : device.status,
    })),
  }
}

function questDeviceRow() {
  const row = screen.getByText("Quest 3 Demo").closest(".console-list-row")
  if (!row) throw new Error("Quest device row not found")
  return within(row as HTMLElement)
}

describe("DevicesPage", () => {
  beforeEach(() => {
    getConnectionStatusMock.mockReset()
    disconnectMock.mockReset()
    getConnectionStatusMock.mockResolvedValue(connectionSnapshot("online"))
    disconnectMock.mockResolvedValue({
      ...mockDevices[0],
      status: "disconnected",
      auto_reconnect_disabled_reason: "manual_disconnect",
    })
  })

  it("renders the devices route with mocked page dependencies", async () => {
    renderRoute("/devices")

    expect(await screen.findByRole("heading", { name: "Devices 裝置" })).toBeInTheDocument()
    expect(await screen.findByText("Quest 3 Demo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Device 新增裝置" })).toBeInTheDocument()
  })

  it("converges an initially online device to the offline snapshot", async () => {
    getConnectionStatusMock.mockResolvedValue(connectionSnapshot("offline"))

    renderRoute("/devices")

    await screen.findByText("Quest 3 Demo")
    await waitFor(() => {
      expect(questDeviceRow().getByRole("button", { name: "ADB 連線" })).toBeInTheDocument()
    })
  })

  it("converges a stale online device to manual disconnect after clicking disconnect", async () => {
    const user = userEvent.setup()
    getConnectionStatusMock
      .mockResolvedValueOnce(connectionSnapshot("online"))
      .mockResolvedValue(connectionSnapshot("disconnected"))

    renderRoute("/devices")

    await screen.findByText("Quest 3 Demo")
    const disconnectButton = await waitFor(() =>
      questDeviceRow().getByRole("button", { name: "中斷 ADB" }),
    )
    await user.click(disconnectButton)

    await waitFor(() => {
      expect(questDeviceRow().getByRole("button", { name: "ADB 連線" })).toBeInTheDocument()
      expect(questDeviceRow().getByText("手動斷開")).toBeInTheDocument()
    })
    expect(disconnectMock).toHaveBeenCalledWith(mockDevices[0].device_id)
  })
})
