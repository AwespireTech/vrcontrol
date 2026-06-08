import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

const { setIntervalMock } = vi.hoisted(() => ({
  setIntervalMock: vi.fn(async () => undefined),
}))

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock({
    monitoringApi: {
      setInterval: setIntervalMock,
    },
  })
})

describe("SettingsPage", () => {
  it("renders settings sections and applies the monitoring interval", async () => {
    const user = userEvent.setup()

    renderRoute("/settings")

    expect(await screen.findByRole("heading", { name: "系統設定" })).toBeInTheDocument()
  expect(await screen.findByText("Scrcpy WebRTC 串流")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "應用" }))

    expect(setIntervalMock).toHaveBeenCalledWith(10)
  })
})