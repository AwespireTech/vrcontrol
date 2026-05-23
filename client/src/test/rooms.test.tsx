import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock()
})

describe("RoomsPage", () => {
  it("renders room data and primary action with mocked data", async () => {
    renderRoute("/rooms")

    expect(await screen.findByRole("heading", { name: "房間管理" })).toBeInTheDocument()
    expect(await screen.findByText("主展示區")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /建立房間/ })).toBeInTheDocument()
  })
})