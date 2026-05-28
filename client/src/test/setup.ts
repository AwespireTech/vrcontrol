import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

class IntersectionObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return []
  }
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  writable: true,
  value: IntersectionObserverMock,
})

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
})

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  })
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  })

  window.alert = vi.fn()
  window.confirm = vi.fn(() => true)
  window.open = vi.fn(() => null) as typeof window.open
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})