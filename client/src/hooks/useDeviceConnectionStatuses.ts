import { useEffect, useMemo, useState } from "react"
import { deviceApi } from "@/services/api"
import type { DeviceConnectionStatus } from "@/services/api-types"

type DeviceConnectionState = {
  known: boolean
  loading: boolean
  statuses: Record<string, DeviceConnectionStatus>
  error?: string
  checkedAt?: string
  lastSuccessfulCheck?: string
}

type Subscriber = (state: DeviceConnectionState) => void

const POLL_INTERVAL_MS = 5_000

let state: DeviceConnectionState = {
  known: false,
  loading: false,
  statuses: {},
}
let subscribers = new Set<Subscriber>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let eventsBound = false
let inFlight: Promise<void> | null = null

function emit(next: DeviceConnectionState) {
  state = next
  for (const subscriber of subscribers) subscriber(state)
}

async function refreshInternal(): Promise<void> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    emit({ ...state, loading: !state.known })
    try {
      const snapshot = await deviceApi.getConnectionStatus()
      emit({
        known: true,
        loading: false,
        statuses: Object.fromEntries(snapshot.statuses.map((status) => [status.device_id, status])),
        error: undefined,
        checkedAt: snapshot.checked_at,
        lastSuccessfulCheck: snapshot.last_successful_check,
      })
    } catch (error) {
      emit({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

function onFocus() {
  void refreshInternal()
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") void refreshInternal()
}

function ensureStarted() {
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshInternal()
    }, POLL_INTERVAL_MS)
    void refreshInternal()
  }

  if (!eventsBound) {
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    eventsBound = true
  }
}

function stopWhenUnused() {
  if (subscribers.size > 0) return
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  if (eventsBound) {
    window.removeEventListener("focus", onFocus)
    document.removeEventListener("visibilitychange", onVisibilityChange)
    eventsBound = false
  }
}

export function useDeviceConnectionStatuses() {
  const [local, setLocal] = useState(state)

  useEffect(() => {
    subscribers.add(setLocal)
    ensureStarted()
    setLocal(state)

    return () => {
      subscribers.delete(setLocal)
      stopWhenUnused()
    }
  }, [])

  const actions = useMemo(
    () => ({
      refresh: refreshInternal,
    }),
    [],
  )

  return { ...local, ...actions }
}
