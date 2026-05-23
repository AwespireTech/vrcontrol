import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock()
})

describe("ActionsPage", () => {
  it("opens the execute modal from the mocked action list", async () => {
    const user = userEvent.setup()

    renderRoute("/actions")

    expect(await screen.findByRole("heading", { name: "動作管理" })).toBeInTheDocument()
    expect(await screen.findByText("啟動 Home App")).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "執行" })[0])

    expect(await screen.findByRole("heading", { name: /執行動作/ })).toBeInTheDocument()
    expect(screen.getByText(/選擇設備/)).toBeInTheDocument()
  })
})