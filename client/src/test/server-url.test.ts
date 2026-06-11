import { describe, expect, it } from "vitest"
import { buildWebSocketUrl, getApiBaseUrl, getServerOrigin } from "@/lib/utils/server-url"

describe("server URL helpers", () => {
  it("prefers explicit VITE_API_SERVER when provided", () => {
    expect(getServerOrigin("http://backend-host:8080", "http://frontend-host:5173")).toBe(
      "http://backend-host:8080",
    )
  })

  it("uses current host on dev port 5173 to target backend port 8080", () => {
    expect(getServerOrigin(undefined, "http://192.168.1.10:5173")).toBe("http://192.168.1.10:8080")
  })

  it("uses current origin for non-dev production-like hosts", () => {
    expect(getServerOrigin(undefined, "https://vrcontrol.example.com")).toBe(
      "https://vrcontrol.example.com",
    )
  })

  it("builds API base URLs and websocket URLs from the resolved origin", () => {
    expect(getApiBaseUrl("http://192.168.1.10:8080")).toBe("http://192.168.1.10:8080/api")
    expect(buildWebSocketUrl("/api/ws/control/room-1", "https://vrcontrol.example.com")).toBe(
      "wss://vrcontrol.example.com/api/ws/control/room-1",
    )
  })
})
