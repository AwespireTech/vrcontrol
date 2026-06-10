import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

const { setIntervalMock } = vi.hoisted(() => ({
  setIntervalMock: vi.fn(async () => undefined),
}))

const { updateScrcpyConfigMock } = vi.hoisted(() => ({
  updateScrcpyConfigMock: vi.fn(async () => undefined),
}))

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock({
    monitoringApi: {
      setInterval: setIntervalMock,
    },
    scrcpyApi: {
      updateConfig: updateScrcpyConfigMock,
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

  it("allows custom bitrate input and saves it", async () => {
    const user = userEvent.setup()

    renderRoute("/settings")

    const bitrateInput = await screen.findByLabelText("位元率")
    await user.clear(bitrateInput)
    await user.type(bitrateInput, "800k")

    await user.click(screen.getByRole("button", { name: "保存配置" }))

    expect(updateScrcpyConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ bitrate: "800k" }),
    )
  })

  it("blocks invalid bitrate input", async () => {
    const user = userEvent.setup()

    renderRoute("/settings")

    const bitrateInput = await screen.findByLabelText("位元率")
    await user.clear(bitrateInput)
    await user.type(bitrateInput, "abc")

    expect(screen.getByText("位元率格式需為整數加上 k 或 M，例如 800k、1M")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled()
  })
})
