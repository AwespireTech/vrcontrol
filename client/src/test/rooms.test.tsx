import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock()
})

describe("RoomsPage", () => {
  it("renders group list and simplified room actions with mocked data", async () => {
    renderRoute("/rooms")

    expect(await screen.findByRole("heading", { name: "Groups 群組管理" })).toBeInTheDocument()
    expect(await screen.findByText("群組列表")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Add Group 新增群組/ })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /進入控制頁/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /開啟監控/ }).length).toBeGreaterThan(0)
  })

  it("opens the selected group monitoring wall in a popup", async () => {
    const focus = vi.fn()
    const open = vi.spyOn(window, "open").mockReturnValue({ focus } as unknown as Window)
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined)

    renderRoute("/rooms")

    const monitorButtons = await screen.findAllByRole("button", { name: /開啟監控/ })
    fireEvent.click(monitorButtons[0])

    expect(open).toHaveBeenCalledWith(
      "/monitoring/rooms/room-main-stage?display=wall&layout=grid",
      "vrcontrol-monitoring-room-main-stage",
      expect.any(String),
    )
    expect(focus).toHaveBeenCalled()
    expect(alert).not.toHaveBeenCalled()
  })
})
