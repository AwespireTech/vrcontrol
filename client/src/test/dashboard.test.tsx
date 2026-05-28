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

describe("DashboardPage", () => {
  it("renders dashboard metrics and entry points with mocked data", async () => {
    const user = userEvent.setup()

    renderRoute("/")

    expect(await screen.findByRole("heading", { name: "Dashboard 總覽" })).toBeInTheDocument()

    expect(screen.getByText("Devices 裝置總數").parentElement).toHaveTextContent("2")
    expect(screen.getByText("Groups 群組總數").parentElement).toHaveTextContent("2")

    expect(screen.getByRole("link", { name: /Manage Devices/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Manage Groups/ })).toBeInTheDocument()

    const monitorToggle = screen.getByRole("button", { name: "Monitor 監控" })
    expect(monitorToggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "主展示區" })).not.toBeInTheDocument()

    await user.click(monitorToggle)

    expect(monitorToggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("link", { name: "主展示區" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/")
  })
})