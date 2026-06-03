export function getServerOrigin(
  explicitServer?: string,
  currentOrigin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  if (explicitServer && explicitServer.trim()) {
    return explicitServer.trim().replace(/\/+$/, "")
  }

  if (!currentOrigin) {
    return "http://localhost:8080"
  }

  try {
    const origin = new URL(currentOrigin)
    const isDevFrontend = origin.port === "5173" || origin.hostname === "localhost" || origin.hostname === "127.0.0.1"

    if (isDevFrontend) {
      return `${origin.protocol}//${origin.hostname}:8080`
    }

    return origin.origin
  } catch {
    return "http://localhost:8080"
  }
}

export function getApiBaseUrl(explicitServer?: string, currentOrigin?: string) {
  return `${getServerOrigin(explicitServer, currentOrigin)}/api`
}

export function buildWebSocketUrl(path: string, explicitServer?: string, currentOrigin?: string) {
  const serverOrigin = getServerOrigin(explicitServer, currentOrigin)
  const url = new URL(path, serverOrigin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}
