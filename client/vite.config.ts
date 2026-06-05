import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"

const backendTarget = process.env.VITE_API_SERVER || "http://localhost:8080"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
