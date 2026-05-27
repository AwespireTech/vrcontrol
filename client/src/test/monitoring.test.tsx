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

describe("MonitoringPage", () => {
  it("renders the monitoring landing shell", async () => {
    renderRoute("/monitoring")

    expect(await screen.findByRole("heading", { name: "監控中心" })).toBeInTheDocument()
  })
})