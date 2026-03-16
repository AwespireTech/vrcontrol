import { useEffect, useState } from "react"
import { monitoringApi, scrcpyApi, preferenceApi } from "@/services/quest-api"
import { ScrcpyConfigForm } from "@/components/quest/scrcpy-config-form"
import type { ScrcpyConfig, ScrcpySystemInfo, UserPreference } from "@/services/quest-types"
import QuestPageShell from "@/components/quest/quest-page-shell"
import Button from "@/components/button"
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from "@/environment"

export default function QuestSettingsPage() {
  const [monitoringInterval, setMonitoringInterval] = useState(10)
  const [loading, setLoading] = useState(true)

  // Scrcpy 相關狀態
  const [scrcpySystemInfo, setScrcpySystemInfo] = useState<ScrcpySystemInfo | null>(null)
  const [scrcpyConfig, setScrcpyConfig] = useState<ScrcpyConfig | null>(null)
  const [scrcpyConfigChanged, setScrcpyConfigChanged] = useState(false)

  // 使用者偏好狀態
  const [preference, setPreference] = useState<UserPreference | null>(null)
  const [preferenceChanged, setPreferenceChanged] = useState(false)
  const [savingPreference, setSavingPreference] = useState(false)
  const [savingScrcpyConfig, setSavingScrcpyConfig] = useState(false)
  const [settingInterval, setSettingInterval] = useState(false)

  const loadSettings = async () => {
    try {
      // 載入 scrcpy 系統信息
      const systemInfo = await scrcpyApi.getSystemInfo()
      setScrcpySystemInfo(systemInfo)

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-xl text-foreground">載入中…</div>
      </div>
    )
  }

  return (
    <QuestPageShell title="Quest 系統設定" subtitle="偏好、監控與 Scrcpy 的設定總覽" maxWidth="md">
      <div className="space-y-6">
        {/* 設備狀態設定 */}
        <div className="surface-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">設備狀態</h2>

          {preference && (
            <div className="space-y-4">
              <div className="surface-panel p-4">
                <p className="mb-3 font-semibold text-foreground">狀態更新間隔</p>
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
                <p className="mt-2 text-xs text-foreground/50">
                  設定設備頁自動更新設備狀態的時間間隔（5–300 秒）
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="mb-3 font-semibold text-foreground">批次數量</p>
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
                <p className="mt-2 text-xs text-foreground/50">每次批次查詢的設備數量（1–50 台）</p>
              </div>

              <div className="surface-panel p-4">
                <p className="mb-3 font-semibold text-foreground">最大併發</p>
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
                <p className="mt-2 text-xs text-foreground/50">
                  同時查詢設備狀態的最大並行數（1–20 個）
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="mb-3 font-semibold text-foreground">自動重連冷卻</p>
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
                <p className="mt-2 text-xs text-foreground/50">
                  設備離線後，兩次自動重連嘗試之間的等待時間（5–3600 秒）
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="mb-3 font-semibold text-foreground">自動重連上限</p>
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
                <p className="mt-2 text-xs text-foreground/50">
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
                      : "cursor-not-allowed bg-muted/50 text-foreground/50"
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
          <h2 className="mb-4 text-xl font-bold text-foreground">網路監控服務</h2>

          <div className="space-y-4">
            <div className="surface-panel p-4">
              <p className="mb-2 font-semibold text-foreground">說明</p>
              <p className="text-sm text-foreground/70">
                監控的啟動/停止與手動執行已移至 Quest 總覽頁，此頁僅保留監控相關設定。
              </p>
            </div>

            <div className="surface-panel p-4">
              <p className="mb-3 font-semibold text-foreground">監控間隔</p>
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
              <p className="mt-2 text-xs text-foreground/50">
                設定監控服務檢查設備連線狀態的時間間隔（1–300 秒）
              </p>
            </div>
          </div>
        </div>

        {/* Scrcpy 螢幕鏡像設定 */}
        <div className="surface-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">Scrcpy 螢幕鏡像</h2>

          {/* 系統檢查區塊 */}
          {scrcpySystemInfo && (
            <div
              className={`mb-6 rounded-xl p-4 ${
                scrcpySystemInfo.installed
                  ? "border border-success/60 bg-success/10"
                  : "border border-border/70 bg-surface/60"
              }`}
            >
              {scrcpySystemInfo.installed ? (
                <div>
                  <p className="mb-1 font-semibold text-success">✓ Scrcpy 已安裝</p>
                  <p className="text-sm text-success">版本: {scrcpySystemInfo.version}</p>
                  <p className="mt-1 text-xs text-success">路徑: {scrcpySystemInfo.path}</p>
                </div>
              ) : (
                <div>
                  <p className="mb-2 font-semibold text-foreground">✗ Scrcpy 未安裝</p>
                  <p className="mb-3 text-sm text-foreground/70">
                    {scrcpySystemInfo.error_message}
                  </p>
                  <a
                    href="https://github.com/Genymobile/scrcpy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline hover:text-blue-700"
                  >
                    前往 Scrcpy GitHub 頁面查看安裝指引 →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 配置表單 */}
          {scrcpyConfig && (
            <div>
              <ScrcpyConfigForm
                value={scrcpyConfig}
                onChange={handleScrcpyConfigChange}
                disabled={!scrcpySystemInfo?.installed}
              />

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSaveScrcpyConfig}
                  disabled={
                    !scrcpyConfigChanged || !scrcpySystemInfo?.installed || savingScrcpyConfig
                  }
                  loading={savingScrcpyConfig}
                  className={`ui-btn ui-btn-md transition-colors ${
                    scrcpyConfigChanged && scrcpySystemInfo?.installed
                      ? "ui-btn-primary"
                      : "cursor-not-allowed bg-muted/50 text-foreground/50"
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
          <h2 className="mb-4 text-xl font-bold text-foreground">系統資訊</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-foreground/70">API 端點:</span>
              <span className="font-mono text-foreground">/api</span>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-foreground/70">Socket 連線埠範圍:</span>
              <span className="font-mono text-foreground">3000-3100</span>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-foreground/70">資料儲存:</span>
              <span className="font-mono text-foreground">JSON 檔案</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-foreground/70">前端更新間隔:</span>
              <span className="font-mono text-foreground">5 秒</span>
            </div>
          </div>
        </div>

        {/* 關於 */}
        <div className="surface-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">關於</h2>
          <p className="mb-2 text-foreground/70">
            Quest 設備管理模組提供完整的 Meta Quest 設備管理功能，包括：
          </p>
          <ul className="ml-4 list-inside list-disc space-y-1 text-foreground/70">
            <li>設備連線與狀態監控</li>
            <li>房間管理與 Socket Server</li>
            <li>動作執行與批次操作</li>
            <li>自動化網絡監控</li>
            <li>ADB 命令整合</li>
          </ul>
        </div>
      </div>
    </QuestPageShell>
  )
}
