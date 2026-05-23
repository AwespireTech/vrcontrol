import { defineConfig } from "@playwright/test"
import { fileURLToPath } from "node:url"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173"
const configDir = fileURLToPath(new URL(".", import.meta.url))
const devServerCommand = "node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: devServerCommand,
        cwd: configDir,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
})