import { useEffect, useMemo, useState } from "react"
import { DEFAULT_MONITORING_STATUS_POLL_INTERVAL_SECONDS } from "@/environment"
import { monitoringApi } from "@/services/quest-api"

type MonitoringStatusState = {
  known: boolean
  running: boolean
  loading: boolean
  error?: string
  updatedAt?: number
}

type Subscriber = (state: MonitoringStatusState) => void

let state: MonitoringStatusState = {
  known: false,
  running: false,
  loading: false,
  error: undefined,
  updatedAt: undefined,
}

let subscribers = new Set<Subscriber>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let eventsBound = false
let inFlight: Promise<void> | null = null

function emit(next: MonitoringStatusState) {
  state = next
  for (const fn of subscribers) fn(state)
}

async function refreshInternal(): Promise<void> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    emit({ ...state, loading: !state.known, error: undefined })
    try {
      const status = await monitoringApi.getStatus()
      emit({
        known: true,
        running: status.running,
        loading: false,
        error: undefined,
        updatedAt: Date.now(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emit({
        known: false,
        running: false,
        loading: false,
        error: message,
        updatedAt: Date.now(),
      })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

function ensurePollingStarted() {
  if (pollTimer) return
  const intervalMs = Math.max(1, DEFAULT_MONITORING_STATUS_POLL_INTERVAL_SECONDS) * 1000

  pollTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return
    void refreshInternal()
  }, intervalMs)

  // First tick immediately for faster UI sync
  void refreshInternal()
}

function maybeStopPolling() {
  if (subscribers.size > 0) return
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (eventsBound) {
    window.removeEventListener("focus", onFocus)
    document.removeEventListener("visibilitychange", onVisibilityChange)
    eventsBound = false
  }
}

function onFocus() {
  void refreshInternal()
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    void refreshInternal()
  }
}

function ensureEventsBound() {
  if (eventsBound) return
  window.addEventListener("focus", onFocus)
  document.addEventListener("visibilitychange", onVisibilityChange)
  eventsBound = true
}

export function useMonitoringStatus() {
  const [local, setLocal] = useState<MonitoringStatusState>(state)

  useEffect(() => {
    const sub: Subscriber = (s) => setLocal(s)
    subscribers.add(sub)

    ensureEventsBound()
    ensurePollingStarted()

    // sync immediately in case state changed before subscription
    sub(state)

    return () => {
      subscribers.delete(sub)
      maybeStopPolling()
    }
  }, [])

  const actions = useMemo(
    () => ({
      refresh: () => refreshInternal(),
    }),
    [],
  )

  return { ...local, ...actions }
}
