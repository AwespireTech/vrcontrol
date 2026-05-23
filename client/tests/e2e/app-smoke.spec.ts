import { expect, test } from "@playwright/test"
import { registerMockApiRoutes } from "./helpers/mock-api"

test("captures current UI across the main console routes", async ({ page }, testInfo) => {
  await registerMockApiRoutes(page)
  const mainNav = page.getByLabel("主導覽")

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "設備控制台" })).toBeVisible()
  await expect(mainNav).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("dashboard-current.png"), fullPage: true })

  await page.goto("/devices")
  await expect(page.getByRole("heading", { name: "設備管理" })).toBeVisible()
  await expect(page.getByText("Quest 3 Demo")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("devices-current.png"), fullPage: true })

  await page.goto("/rooms")
  await expect(page.getByRole("heading", { name: "房間管理" })).toBeVisible()
  await expect(page.getByText("主展示區")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("rooms-current.png"), fullPage: true })

  await page.goto("/actions")
  await expect(page.getByRole("heading", { name: "動作管理" })).toBeVisible()
  await expect(page.getByText("啟動 Home App")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("actions-current.png"), fullPage: true })
})