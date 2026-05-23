import { render } from "@testing-library/react"
import App from "@/App"

export function renderRoute(route = "/") {
  window.history.replaceState({}, "", route)
  return render(<App />)
}