import { expect, test } from "@playwright/test"
import { registerMockApiRoutes } from "./helpers/mock-api"

test("captures current UI across the main console routes", async ({ page }, testInfo) => {
  await registerMockApiRoutes(page)
  const mainNav = page.getByLabel("主導覽")

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Dashboard 總覽" })).toBeVisible()
  await expect(mainNav).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("dashboard-current.png"), fullPage: true })

  await page.goto("/devices")
  await expect(page.getByRole("heading", { name: "Devices 裝置" })).toBeVisible()
  await expect(page.getByText("Quest 3 Demo")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("devices-current.png"), fullPage: true })

  await page.goto("/rooms")
  await expect(page.getByRole("heading", { name: "Groups 群組管理" })).toBeVisible()
  await expect(page.locator(".console-table-title").filter({ hasText: "主展示區" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("rooms-current.png"), fullPage: true })

  await page.goto("/actions")
  await expect(page.getByRole("heading", { name: "動作管理" })).toBeVisible()
  await expect(page.getByText("啟動 Home App")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("actions-current.png"), fullPage: true })

  await page.goto("/monitoring")
  await expect(page.getByRole("heading", { name: "監控中心" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("monitoring-current.png"), fullPage: true })

  await page.goto("/monitoring/rooms/room-main-stage")
  await expect(page.getByRole("heading", { name: "監控中心" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "主展示區" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "即時串流" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("monitoring-room-current.png"), fullPage: true })

  await page.goto("/settings")
  await expect(page.getByRole("heading", { name: "系統設定" })).toBeVisible()
  await expect(page.getByText("Scrcpy 螢幕鏡像")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("settings-current.png"), fullPage: true })
})