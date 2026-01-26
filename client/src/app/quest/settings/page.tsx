import { useEffect, useState } from 'react'
import { monitoringApi, scrcpyApi, preferenceApi } from '@/services/quest-api'
import { ScrcpyConfigForm } from '@/components/quest/scrcpy-config-form'
import type { ScrcpyConfig, ScrcpySystemInfo, UserPreference } from '@/services/quest-types'
import QuestPageShell from '@/components/quest/quest-page-shell'
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_POLL_INTERVAL_SECONDS,
} from '@/environment'

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
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSetInterval = async () => {
    try {
      await monitoringApi.setInterval(monitoringInterval)
      alert(`監控間隔已設置為 ${monitoringInterval} 秒`)
    } catch (error) {
      console.error('Failed to set interval:', error)
      alert('設置失敗')
    }
  }

  const handleScrcpyConfigChange = (config: ScrcpyConfig) => {
    setScrcpyConfig(config)
    setScrcpyConfigChanged(true)
  }

  const handleSaveScrcpyConfig = async () => {
    if (!scrcpyConfig) return
    
    try {
      await scrcpyApi.updateConfig(scrcpyConfig)
      setScrcpyConfigChanged(false)
      alert('Scrcpy 配置已保存')
    } catch (error) {
      console.error('Failed to save scrcpy config:', error)
      alert('保存配置失敗')
    }
  }

  const handlePreferenceChange = (field: keyof UserPreference, value: number) => {
    if (!preference) return
    setPreference({ ...preference, [field]: value })
    setPreferenceChanged(true)
  }

  const handleSavePreference = async () => {
    if (!preference) return
    
    try {
      const updated = await preferenceApi.update(preference)
      setPreference(updated)
      setPreferenceChanged(false)
      alert('設備狀態設定已保存')
    } catch (error) {
      console.error('Failed to save preference:', error)
      alert('保存設定失敗')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-foreground">加載中...</div>
      </div>
    )
  }

  return (
    <QuestPageShell
      title="Quest 系統設置"
      subtitle="偏好、監控與 Scrcpy 設定總覽"
      maxWidth="md"
    >
      <div className="space-y-6">
          {/* 設備狀態設定 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">設備狀態設定</h2>
            
            {preference && (
              <div className="space-y-4">
                <div className="surface-panel p-4">
                  <p className="font-semibold text-foreground mb-3">狀態輪詢間隔</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={preference.poll_interval_sec}
                      onChange={(e) =>
                        handlePreferenceChange(
                          'poll_interval_sec',
                          parseInt(e.target.value) || DEFAULT_POLL_INTERVAL_SECONDS
                        )
                      }
                      className="ui-input w-full px-4 py-2"
                    />
                    <span className="text-foreground/70">秒</span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    設定設備頁自動刷新設備狀態的時間間隔 (5-300 秒)
                  </p>
                </div>

                <div className="surface-panel p-4">
                  <p className="font-semibold text-foreground mb-3">批次大小</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={preference.batch_size}
                      onChange={(e) =>
                        handlePreferenceChange(
                          'batch_size',
                          parseInt(e.target.value) || DEFAULT_BATCH_SIZE
                        )
                      }
                      className="ui-input w-full px-4 py-2"
                    />
                    <span className="text-foreground/70">台</span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    每次批量查詢的設備數量 (1-50 台)
                  </p>
                </div>

                <div className="surface-panel p-4">
                  <p className="font-semibold text-foreground mb-3">最大併發數</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={preference.max_concurrency}
                      onChange={(e) =>
                        handlePreferenceChange(
                          'max_concurrency',
                          parseInt(e.target.value) || DEFAULT_MAX_CONCURRENCY
                        )
                      }
                      className="ui-input w-full px-4 py-2"
                    />
                    <span className="text-foreground/70">個</span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    同時查詢設備狀態的最大並行數 (1-20 個)
                  </p>
                </div>

                <div className="surface-panel p-4">
                  <p className="font-semibold text-foreground mb-3">自動重連冷卻時間</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="5"
                      max="3600"
                      value={preference.reconnect_cooldown_sec}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10)
                        handlePreferenceChange(
                          'reconnect_cooldown_sec',
                          Number.isNaN(next) ? preference.reconnect_cooldown_sec : next
                        )
                      }}
                      className="ui-input w-full px-4 py-2"
                    />
                    <span className="text-foreground/70">秒</span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    設備離線後，兩次自動重連嘗試之間的等待時間 (5-3600 秒)
                  </p>
                </div>

                <div className="surface-panel p-4">
                  <p className="font-semibold text-foreground mb-3">自動重連最大重試次數</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={preference.reconnect_max_retries}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10)
                        handlePreferenceChange(
                          'reconnect_max_retries',
                          Number.isNaN(next) ? preference.reconnect_max_retries : next
                        )
                      }}
                      className="ui-input w-full px-4 py-2"
                    />
                    <span className="text-foreground/70">次</span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    0 代表不進行自動重連；達到上限後會標記為「自動重連已停用」(0-20 次)
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSavePreference}
                    disabled={!preferenceChanged}
                    className={`ui-btn ui-btn-md transition-colors ${
                      preferenceChanged
                        ? 'ui-btn-primary'
                        : 'bg-muted/50 text-foreground/50 cursor-not-allowed'
                    }`}
                  >
                    保存設定
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 監控服務設置 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">網絡監控服務</h2>

            <div className="space-y-4">
              <div className="surface-panel p-4">
                <p className="font-semibold text-foreground mb-2">說明</p>
                <p className="text-sm text-foreground/70">
                  監控的啟動/停止與手動執行已移至 Quest 總覽頁；此頁僅保留監控相關設定。
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="font-semibold text-foreground mb-3">監控間隔</p>
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
                  <button
                    onClick={handleSetInterval}
                    className="ui-btn ui-btn-md ui-btn-primary"
                  >
                    應用
                  </button>
                </div>
                <p className="text-xs text-foreground/50 mt-2">
                  設置監控服務檢查設備連接狀態的時間間隔 (1-300 秒)
                </p>
              </div>
            </div>
          </div>

          {/* Scrcpy 螢幕鏡像設置 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Scrcpy 螢幕鏡像</h2>

            {/* 系統檢查區塊 */}
            {scrcpySystemInfo && (
              <div className={`mb-6 rounded-xl p-4 ${
                scrcpySystemInfo.installed 
                  ? 'bg-success/10 border border-success/60' 
                  : 'bg-surface/60 border border-border/70'
              }`}>
                {scrcpySystemInfo.installed ? (
                  <div>
                    <p className="font-semibold text-success mb-1">✓ Scrcpy 已安裝</p>
                    <p className="text-sm text-success">版本: {scrcpySystemInfo.version}</p>
                    <p className="text-xs text-success mt-1">路徑: {scrcpySystemInfo.path}</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-foreground mb-2">✗ Scrcpy 未安裝</p>
                    <p className="text-sm text-foreground/70 mb-3">
                      {scrcpySystemInfo.error_message}
                    </p>
                    <a
                      href="https://github.com/Genymobile/scrcpy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
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
                  <button
                    onClick={handleSaveScrcpyConfig}
                    disabled={!scrcpyConfigChanged || !scrcpySystemInfo?.installed}
                    className={`ui-btn ui-btn-md transition-colors ${
                      scrcpyConfigChanged && scrcpySystemInfo?.installed
                        ? 'ui-btn-primary'
                        : 'bg-muted/50 text-foreground/50 cursor-not-allowed'
                    }`}
                  >
                    保存配置
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 系統信息 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">系統信息</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-foreground/70">API 端點:</span>
                <span className="font-mono text-foreground">/api/quest</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-foreground/70">Socket 端口範圍:</span>
                <span className="font-mono text-foreground">3000-3100</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-foreground/70">數據存儲:</span>
                <span className="font-mono text-foreground">JSON 文件</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-foreground/70">前端更新間隔:</span>
                <span className="font-mono text-foreground">5 秒</span>
              </div>
            </div>
          </div>

          {/* 關於 */}
          <div className="surface-card p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">關於</h2>
            <p className="text-foreground/70 mb-2">
              Quest 設備管理模組提供了完整的 Meta Quest 設備管理功能，包括：
            </p>
            <ul className="list-disc list-inside text-foreground/70 space-y-1 ml-4">
              <li>設備連接和狀態監控</li>
              <li>房間管理和 Socket Server</li>
              <li>動作執行和批量操作</li>
              <li>自動化網絡監控</li>
              <li>ADB 命令集成</li>
            </ul>
          </div>
      </div>
    </QuestPageShell>
  )
}
