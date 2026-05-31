import { expect, test, type Page } from "@playwright/test"
import { registerMockApiRoutes } from "./helpers/mock-api"

const ROOM_ID = "room-main-stage"
const ONLINE_DEVICE_ID = "device-quest-01"
const OFFLINE_DEVICE_ID = "device-pico-02"

const roomControlDevices = [
  {
    device_id: ONLINE_DEVICE_ID,
    serial: "SERIAL-QUEST-01",
    alias: "Quest 3 Demo",
    name: "Quest 3 Demo",
    model: "Meta Quest 3",
    android_version: "14",
    ip: "192.168.0.101",
    port: 5555,
    status: "online",
    battery: 92,
    temperature: 31,
    is_charging: true,
    ping_ms: 22,
    ping_status: "ok",
    room_id: ROOM_ID,
    notes: "Primary demo headset",
    auto_reconnect_enabled: true,
    ws_status: "connected",
    ws_last_seen: "2026-05-23T09:10:11",
    last_seen: "2026-05-23T09:10:11",
    first_connected: "2026-05-23T09:10:11",
    created_at: "2026-05-23T09:10:11",
    updated_at: "2026-05-23T09:10:11",
  },
  {
    device_id: OFFLINE_DEVICE_ID,
    serial: "SERIAL-PICO-02",
    alias: "Pico Backup",
    name: "Pico Backup",
    model: "Pico 4",
    android_version: "13",
    ip: "192.168.0.102",
    port: 5555,
    status: "offline",
    battery: 0,
    temperature: 0,
    is_charging: false,
    ping_ms: 0,
    ping_status: "unknown",
    room_id: ROOM_ID,
    notes: "Backup device",
    auto_reconnect_enabled: true,
    ws_status: "disconnected",
    ws_last_seen: "2026-05-23T09:10:11",
    last_seen: "2026-05-23T09:10:11",
    first_connected: "2026-05-23T09:10:11",
    created_at: "2026-05-23T09:10:11",
    updated_at: "2026-05-23T09:10:11",
  },
]

const roomControlRoom = {
  room_id: ROOM_ID,
  name: "主展示區",
  description: "主要展示與導覽房間",
  max_devices: 4,
  device_ids: [ONLINE_DEVICE_ID, OFFLINE_DEVICE_ID],
  assigned_sequences: {},
  socket_ip: "127.0.0.1",
  socket_port: 9001,
  socket_running: true,
  parameters: {},
  operation_profile: {
    activity_defaults: {
      name: "Main Stage Demo",
      activity_context: {},
    },
    batch_action_ids: [],
    launch_action_id: "action-room-launch",
    stop_action_id: "action-room-stop",
    allow_activity_name_override: true,
    allow_seed_override: true,
  },
  created_at: "2026-05-23T09:10:11",
  updated_at: "2026-05-23T09:10:11",
}

const roomControlActions = [
  {
    action_id: "action-global-launch",
    name: "啟動預設 App",
    description: "預設開啟動作",
    action_type: "launch_app",
    params: { package_name: "com.demo.global" },
    execution_count: 0,
    success_count: 0,
    failure_count: 0,
    last_executed_at: "",
    created_at: "2026-05-23T09:10:11",
    updated_at: "2026-05-23T09:10:11",
  },
  {
    action_id: "action-room-launch",
    name: "房間開啟 App",
    description: "房間專用開啟動作",
    action_type: "launch_app",
    params: { package_name: "com.demo.room.launch" },
    execution_count: 0,
    success_count: 0,
    failure_count: 0,
    last_executed_at: "",
    created_at: "2026-05-23T09:10:11",
    updated_at: "2026-05-23T09:10:11",
  },
  {
    action_id: "action-room-stop",
    name: "房間關閉 App",
    description: "房間專用關閉動作",
    action_type: "stop_app",
    params: { package_name: "com.demo.room.launch" },
    execution_count: 0,
    success_count: 0,
    failure_count: 0,
    last_executed_at: "",
    created_at: "2026-05-23T09:10:11",
    updated_at: "2026-05-23T09:10:11",
  },
]

const initialRoomSocketPayload = {
  room_id: ROOM_ID,
  current_activity_id: "",
  activity_name: "",
  activity_status: "",
  players: [
    {
      device_id: ONLINE_DEVICE_ID,
      message: "00:10 / 16:23",
      chapter: 3,
      sequence: 7,
      ready_to_move: true,
      left_hand_available: true,
      left_hand_position: { x: 0, y: 0, z: 0 },
      left_hand_forward: { x: 0, y: 0, z: 1 },
      right_hand_available: true,
      right_hand_position: { x: 0, y: 0, z: 0 },
      right_hand_forward: { x: 0, y: 0, z: 1 },
      head_position: { x: 0, y: 1.5, z: 0 },
      head_forward: { x: 0, y: 0, z: 1 },
      last_update: "2026-05-23T09:10:11",
    },
    {
      device_id: OFFLINE_DEVICE_ID,
      message: "00:05 / 16:23",
      chapter: 2,
      sequence: 2,
      ready_to_move: false,
      left_hand_available: false,
      left_hand_position: { x: 0, y: 0, z: 0 },
      left_hand_forward: { x: 0, y: 0, z: 1 },
      right_hand_available: false,
      right_hand_position: { x: 0, y: 0, z: 0 },
      right_hand_forward: { x: 0, y: 0, z: 1 },
      head_position: { x: 0, y: 1.5, z: 0 },
      head_forward: { x: 0, y: 0, z: 1 },
      last_update: "2026-05-23T09:10:08",
    },
  ],
  player_count: 2,
}

async function installMockRoomSocket(page: Page, payload: unknown) {
  await page.addInitScript((initialPayload) => {
    class MockWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      static sockets = []

      url
      readyState = MockWebSocket.CONNECTING
      onopen = null
      onclose = null
      onerror = null
      onmessage = null

      constructor(url) {
        this.url = url
        MockWebSocket.sockets.push(this)
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN
          this.onopen?.({ type: "open" })
          if (initialPayload) {
            this.onmessage?.({ data: JSON.stringify(initialPayload) })
          }
        }, 0)
      }

      send() {}

      close() {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ type: "close" })
      }
    }

    window.WebSocket = MockWebSocket
    window.__emitMockRoomSocketPayload = (nextPayload) => {
      MockWebSocket.sockets.forEach((socket) => {
        socket.onmessage?.({ data: JSON.stringify(nextPayload) })
      })
    }
  }, payload)
}

async function registerRoomControlRoutes(
  page: Page,
  onActionExecute: (actionId: string) => void,
  onAssignSequence: (url: string) => void,
  onForceMove: (url: string) => void,
) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl

    if (pathname === "/api/rooms") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [roomControlRoom] }),
      })
      return
    }

    if (pathname === `/api/rooms/${ROOM_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: roomControlRoom }),
      })
      return
    }

    if (pathname === "/api/devices") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: roomControlDevices }),
      })
      return
    }

    if (pathname === "/api/actions") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: roomControlActions }),
      })
      return
    }

    if (pathname === `/api/devices/${OFFLINE_DEVICE_ID}/connect`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: null }),
      })
      return
    }

    const actionExecuteMatch = pathname.match(/^\/api\/actions\/([^/]+)\/execute$/)
    if (actionExecuteMatch) {
      onActionExecute(actionExecuteMatch[1])
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { ok: true } }),
      })
      return
    }

    if (pathname.startsWith(`/api/control/assignseq/${ROOM_ID}/`)) {
      onAssignSequence(pathname)
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      return
    }

    if (pathname.startsWith(`/api/simple/forcemove/${ROOM_ID}/`)) {
      onForceMove(pathname)
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: null }),
    })
  })
}

test("shows monitoring rooms from the collapsed mobile sidebar", async ({ page }, testInfo) => {
  await registerMockApiRoutes(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/")
  await page.getByRole("button", { name: "Monitor 監控" }).click()

  await expect(page.getByText("Monitor Rooms")).toBeVisible()
  await expect(page.getByRole("link", { name: "主展示區" })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("mobile-monitoring-flyout.png"),
    fullPage: true,
  })
})

test("keeps room control inputs stable and uses room-specific actions", async ({
  page,
}, testInfo) => {
  let lastExecutedActionId = ""
  let lastAssignSequencePath = ""
  let lastForceMovePath = ""

  await installMockRoomSocket(page, initialRoomSocketPayload)
  await registerRoomControlRoutes(
    page,
    (actionId) => {
      lastExecutedActionId = actionId
    },
    (url) => {
      lastAssignSequencePath = url
    },
    (url) => {
      lastForceMovePath = url
    },
  )

  await page.goto(`/rooms/${ROOM_ID}/control`)

  await expect(page.getByRole("heading", { name: "主展示區" })).toBeVisible()
  const summaryPanel = page.locator(".console-control-panel--padded")
  await expect(summaryPanel.getByText("依 Sequence 最小裝置顯示：Pico Backup")).toBeVisible()
  await expect(summaryPanel.getByText("00:05 / 16:23")).toBeVisible()

  const offlineRow = page.locator(`[data-device-id="${OFFLINE_DEVICE_ID}"]`)
  await expect(offlineRow.getByRole("button", { name: "動作" })).toBeVisible()
  await expect(offlineRow.getByRole("button", { name: "連線" })).toBeVisible()

  await offlineRow.getByRole("button", { name: "動作" }).click()
  await expect(page.getByRole("dialog").getByText("Pico Backup")).toBeVisible()
  await page.getByRole("button", { name: "關閉裝置動作面板" }).click()

  const onlineRow = page.locator(`[data-device-id="${ONLINE_DEVICE_ID}"]`)
  await onlineRow.getByRole("button", { name: "動作" }).click()

  const actionDialog = page.getByRole("dialog")
  const sequenceInput = actionDialog.getByPlaceholder("Sequence")
  await expect(sequenceInput).toHaveValue("7")
  await sequenceInput.fill("42")

  await page.evaluate(
    (payload) => {
      window.__emitMockRoomSocketPayload(payload)
    },
    {
      ...initialRoomSocketPayload,
      players: [
        {
          ...initialRoomSocketPayload.players[0],
          chapter: 5,
          sequence: 9,
          message: "00:59 / 16:23",
        },
      ],
    },
  )

  await expect(sequenceInput).toHaveValue("42")
  await actionDialog.getByRole("button", { name: "開啟 APP" }).click()
  await expect.poll(() => lastExecutedActionId).toBe("action-room-launch")

  await actionDialog.getByRole("button", { name: "關閉 APP" }).click()
  await expect.poll(() => lastExecutedActionId).toBe("action-room-stop")

  await actionDialog.getByRole("combobox").selectOption("5")
  await actionDialog.getByRole("button", { name: "Go" }).first().click()
  await expect
    .poll(() => lastForceMovePath)
    .toBe(`/api/simple/forcemove/${ROOM_ID}/${ONLINE_DEVICE_ID}/5`)

  await actionDialog.getByRole("button", { name: "Go" }).nth(1).click()
  await expect
    .poll(() => lastAssignSequencePath)
    .toBe(`/api/control/assignseq/${ROOM_ID}/${ONLINE_DEVICE_ID}/42`)

  await expect(actionDialog.getByText("Time：00:59 / 16:23")).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("room-control-regression.png"),
    fullPage: true,
  })
})
