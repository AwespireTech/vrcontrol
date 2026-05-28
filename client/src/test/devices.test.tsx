import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderRoute } from "./render-app"

vi.mock("@/services/api", async () => {
  const { createApiModuleMock } = await import("./mocks/api-module")
  return createApiModuleMock()
})

describe("DevicesPage", () => {
  it("renders the devices route with mocked page dependencies", async () => {
    renderRoute("/devices")

    expect(await screen.findByRole("heading", { name: "Devices 裝置" })).toBeInTheDocument()
    expect(await screen.findByText("Quest 3 Demo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Device 新增裝置" })).toBeInTheDocument()
  })
})