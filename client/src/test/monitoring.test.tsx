import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock()
})

vi.mock("@/hooks/useMonitoringStatus", () => ({
  useMonitoringStatus: () => ({
    known: true,
    running: true,
    loading: false,
    refresh: async () => undefined,
  }),
}))

describe("MonitoringPage", () => {
  it("renders monitoring data and filters the list with mocked devices", async () => {
    const user = userEvent.setup()

    renderRoute("/monitoring")

    expect(await screen.findByRole("heading", { name: "監控中心" })).toBeInTheDocument()
    expect(await screen.findByText("Quest 3 Demo")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("搜尋：名稱 / IP / ID"), "backup")

    expect(screen.queryByText("Quest 3 Demo")).not.toBeInTheDocument()
    expect(screen.getByText("Pico Backup")).toBeInTheDocument()
  })
})