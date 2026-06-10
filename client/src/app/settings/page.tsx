import { useEffect, useState } from "react"
import MonitoringManagementSection from "@/components/console/monitoring-management-section"
import { monitoringApi, scrcpyApi, preferenceApi } from "@/services/api"
import { ScrcpyConfigForm } from "@/components/console/scrcpy-config-form"
import type { ScrcpyConfig, UserPreference } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"
import Button from "@/components/button"
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from "@/environment"

export default function SettingsPage() {
  const [monitoringInterval, setMonitoringInterval] = useState(10)
  const [loading, setLoading] = useState(true)

  // Scrcpy 串流設定狀態
  const [scrcpyConfig, setScrcpyConfig] = useState<ScrcpyConfig | null>(null)
  const [scrcpyConfigChanged, setScrcpyConfigChanged] = useState(false)
  const [scrcpyConfigValid, setScrcpyConfigValid] = useState(true)

  // 使用者偏好狀態
  const [preference, setPreference] = useState<UserPreference | null>(null)
  const [preferenceChanged, setPreferenceChanged] = useState(false)
  const [savingPreference, setSavingPreference] = useState(false)
  const [savingScrcpyConfig, setSavingScrcpyConfig] = useState(false)
  const [settingInterval, setSettingInterval] = useState(false)

  const loadSettings = async () => {
    try {
      // 載入 scrcpy 配置
      const config = await scrcpyApi.getConfig()
      setScrcpyConfig(config)

      // 載入使用者偏好
      const pref = await preferenceApi.get()
      setPreference(pref)
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSetInterval = async () => {
    if (settingInterval) return
    setSettingInterval(true)
    try {
      await monitoringApi.setInterval(monitoringInterval)
      alert(`已設定監控間隔為 ${monitoringInterval} 秒`)
    } catch (error) {
      console.error("Failed to set interval:", error)
      alert("設定失敗，請稍後再試")
    } finally {
      setSettingInterval(false)
    }
  }

  const handleScrcpyConfigChange = (config: ScrcpyConfig) => {
    setScrcpyConfig(config)
    setScrcpyConfigChanged(true)
  }

  const handleScrcpyConfigValidityChange = (isValid: boolean) => {
    setScrcpyConfigValid(isValid)
  }

  const handleSaveScrcpyConfig = async () => {
    if (!scrcpyConfig) return
    if (savingScrcpyConfig) return

    setSavingScrcpyConfig(true)
    try {
      await scrcpyApi.updateConfig(scrcpyConfig)
      setScrcpyConfigChanged(false)
      alert("已保存 Scrcpy 配置")
    } catch (error) {
      console.error("Failed to save scrcpy config:", error)
      alert("保存配置失敗，請稍後再試")
    } finally {
      setSavingScrcpyConfig(false)
    }
  }

  const handlePreferenceChange = (field: keyof UserPreference, value: number) => {
    if (!preference) return
    setPreference({ ...preference, [field]: value })
    setPreferenceChanged(true)
  }

  const handleSavePreference = async () => {
    if (!preference) return
    if (savingPreference) return

    setSavingPreference(true)
    try {
      const updated = await preferenceApi.update(preference)
      setPreference(updated)
      setPreferenceChanged(false)
      alert("已保存設備狀態設定")
    } catch (error) {
      console.error("Failed to save preference:", error)
      alert("保存設定失敗，請稍後再試")
    } finally {
      setSavingPreference(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-foreground text-xl">載入中…</div>
      </div>
    )
  }

  return (
    <PageShell title="系統設定" subtitle="偏好、監控與 Scrcpy 的設定總覽" maxWidth="lg">
      <div className="space-y-6">
        {/* 設備狀態設定 */}
        <div className="surface-card p-6">
          <h2 className="text-foreground mb-4 text-xl font-bold">設備狀態</h2>

          {preference && (
            <div className="space-y-4">
              <div className="surface-panel p-4">
                <p className="text-foreground mb-3 font-semibold">狀態更新間隔</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={preference.poll_interval_sec}
                    onChange={(e) =>
                      handlePreferenceChange(
                        "poll_interval_sec",
                        parseInt(e.target.value) || DEFAULT_POLL_INTERVAL_SECONDS,
                      )
                    }
                    className="ui-input w-full px-4 py-2"
                  />
                  <span className="text-foreground/70">秒</span>
                </div>
                <p className="text-foreground/50 mt-2 text-xs">
                  設定設備頁自動更新設備狀態的時間間隔（5–300 秒）
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="text-foreground mb-3 font-semibold">批次數量</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={preference.batch_size}
                    onChange={(e) =>
                      handlePreferenceChange(
                        "batch_size",
                        parseInt(e.target.value) || DEFAULT_BATCH_SIZE,
                      )
                    }
                    className="ui-input w-full px-4 py-2"
                  />
                  <span className="text-foreground/70">台</span>
                </div>
                <p className="text-foreground/50 mt-2 text-xs">每次批次查詢的設備數量（1–50 台）</p>
              </div>

              <div className="surface-panel p-4">
                <p className="text-foreground mb-3 font-semibold">最大併發</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={preference.max_concurrency}
                    onChange={(e) =>
                      handlePreferenceChange(
                        "max_concurrency",
                        parseInt(e.target.value) || DEFAULT_MAX_CONCURRENCY,
                      )
                    }
                    className="ui-input w-full px-4 py-2"
                  />
                  <span className="text-foreground/70">個</span>
                </div>
                <p className="text-foreground/50 mt-2 text-xs">
                  同時查詢設備狀態的最大並行數（1–20 個）
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="text-foreground mb-3 font-semibold">自動重連冷卻</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    value={preference.reconnect_cooldown_sec}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      handlePreferenceChange(
                        "reconnect_cooldown_sec",
                        Number.isNaN(next) ? preference.reconnect_cooldown_sec : next,
                      )
                    }}
                    className="ui-input w-full px-4 py-2"
                  />
                  <span className="text-foreground/70">秒</span>
                </div>
                <p className="text-foreground/50 mt-2 text-xs">
                  設備離線後，兩次自動重連嘗試之間的等待時間（5–3600 秒）
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="text-foreground mb-3 font-semibold">自動重連上限</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={preference.reconnect_max_retries}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      handlePreferenceChange(
                        "reconnect_max_retries",
                        Number.isNaN(next) ? preference.reconnect_max_retries : next,
                      )
                    }}
                    className="ui-input w-full px-4 py-2"
                  />
                  <span className="text-foreground/70">次</span>
                </div>
                <p className="text-foreground/50 mt-2 text-xs">
                  0 代表不進行自動重連；達到上限後會標記為「自動重連已停用」（0–20 次）
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSavePreference}
                  disabled={!preferenceChanged || savingPreference}
                  loading={savingPreference}
                  className={`ui-btn-md transition-colors ${
                    preferenceChanged
                      ? "ui-btn-primary"
                      : "bg-muted/50 text-foreground/50 cursor-not-allowed"
                  }`}
                >
                  保存設定
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 監控服務設定 */}
        <div className="surface-card p-6">
          <h2 className="text-foreground mb-4 text-xl font-bold">網路監控服務</h2>

          <div className="space-y-4">
            <div className="surface-panel p-4">
              <p className="text-foreground mb-2 font-semibold">說明</p>
              <p className="text-foreground/70 text-sm">
                監控的啟動、執行與設備管理已集中到下方 Monitoring 區塊，這裡保留服務層級設定。
              </p>
            </div>

            <div className="surface-panel p-4">
              <p className="text-foreground mb-3 font-semibold">監控間隔</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={monitoringInterval}
                  onChange={(e) => setMonitoringInterval(parseInt(e.target.value) || 10)}
                  className="ui-input px-4 py-2"
                />
                <span className="text-foreground/70">秒</span>
                <Button
                  onClick={handleSetInterval}
                  className="ui-btn-md ui-btn-primary"
                  loading={settingInterval}
                >
                  應用
                </Button>
              </div>
              <p className="text-foreground/50 mt-2 text-xs">
                設定監控服務檢查設備連線狀態的時間間隔（1–300 秒）
              </p>
            </div>
          </div>
        </div>

        <MonitoringManagementSection />

        {/* Scrcpy WebRTC 串流設定 */}
        <div className="surface-card p-6">
          <h2 className="text-foreground mb-4 text-xl font-bold">Scrcpy WebRTC 串流</h2>
          <p className="text-foreground/60 mb-6 text-sm">
            這些參數會套用到後端啟動的 scrcpy standalone server，供頁內即時畫面使用。
          </p>

          {/* 配置表單 */}
          {scrcpyConfig && (
            <div>
              <ScrcpyConfigForm
                value={scrcpyConfig}
                onChange={handleScrcpyConfigChange}
                onValidityChange={handleScrcpyConfigValidityChange}
              />

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSaveScrcpyConfig}
                  disabled={!scrcpyConfigChanged || savingScrcpyConfig || !scrcpyConfigValid}
                  loading={savingScrcpyConfig}
                  className={`ui-btn ui-btn-md transition-colors ${
                    scrcpyConfigChanged && scrcpyConfigValid
                      ? "ui-btn-primary"
                      : "bg-muted/50 text-foreground/50 cursor-not-allowed"
                  }`}
                >
                  保存配置
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 系統信息 */}
        <div className="surface-card p-6">
          <h2 className="text-foreground mb-4 text-xl font-bold">系統資訊</h2>
          <div className="space-y-3 text-sm">
            <div className="border-border flex justify-between border-b py-2">
              <span className="text-foreground/70">API 端點:</span>
              <span className="text-foreground font-mono">/api</span>
            </div>
            <div className="border-border flex justify-between border-b py-2">
              <span className="text-foreground/70">Socket 連線埠範圍:</span>
              <span className="text-foreground font-mono">3000-3100</span>
            </div>
            <div className="border-border flex justify-between border-b py-2">
              <span className="text-foreground/70">資料儲存:</span>
              <span className="text-foreground font-mono">JSON 檔案</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-foreground/70">前端更新間隔:</span>
              <span className="text-foreground font-mono">5 秒</span>
            </div>
          </div>
        </div>

        {/* 關於 */}
        <div className="surface-card p-6">
          <h2 className="text-foreground mb-4 text-xl font-bold">關於</h2>
          <p className="text-foreground/70 mb-2">
            本控制模組提供完整的 Meta Quest 設備管理功能，包括：
          </p>
          <ul className="text-foreground/70 ml-4 list-inside list-disc space-y-1">
            <li>設備連線與狀態監控</li>
            <li>房間管理與 Socket Server</li>
            <li>動作執行與批次操作</li>
            <li>自動化網絡監控</li>
            <li>ADB 命令整合</li>
          </ul>
        </div>
      </div>
    </PageShell>
  )
}
