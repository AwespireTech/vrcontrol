import { screen } from "@testing-library/react"
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
    renderRoute("/")

    expect(await screen.findByRole("heading", { name: "Dashboard 總覽" })).toBeInTheDocument()

    expect(screen.getByText("Devices 裝置總數").parentElement).toHaveTextContent("2")
    expect(screen.getByText("Groups 群組總數").parentElement).toHaveTextContent("2")

    expect(screen.getByRole("link", { name: /Manage Devices/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Manage Groups/ })).toBeInTheDocument()
  })
})