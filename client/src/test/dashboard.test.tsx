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

    expect(await screen.findByRole("heading", { name: "設備控制台" })).toBeInTheDocument()

    expect(screen.getByText("設備總數").parentElement).toHaveTextContent("2")
    expect(screen.getByText("在線設備").parentElement).toHaveTextContent("1")
    expect(screen.getByText("房間數量").parentElement).toHaveTextContent("2")
    expect(screen.getByText("動作數量").parentElement).toHaveTextContent("2")

    expect(screen.getByRole("link", { name: /設備管理/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /房間管理/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /動作管理/ })).toBeInTheDocument()
  })
})