import { useState, useEffect } from "react"
import type { ScrcpyConfig } from "@/services/api-types"

interface ScrcpyConfigFormProps {
  value: ScrcpyConfig
  onChange: (config: ScrcpyConfig) => void
  disabled?: boolean
}

export function ScrcpyConfigForm({ value, onChange, disabled = false }: ScrcpyConfigFormProps) {
  const [config, setConfig] = useState<ScrcpyConfig>(value)

  useEffect(() => {
    setConfig(value)
  }, [value])

  const handleChange = (field: keyof ScrcpyConfig, fieldValue: unknown) => {
    const newConfig = { ...config, [field]: fieldValue }
    setConfig(newConfig)
    onChange(newConfig)
  }

  const handleNumberChange = (field: keyof ScrcpyConfig, stringValue: string) => {
    const numValue = stringValue === "" ? undefined : parseInt(stringValue)
    handleChange(field, numValue)
  }

  return (
    <div className="space-y-6">
      {/* 視訊品質設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">視訊品質</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">位元率</label>
            <select
              value={config.bitrate}
              onChange={(e) => handleChange("bitrate", e.target.value)}
              disabled={disabled}
              className="ui-select w-full px-3 py-2"
            >
              <option value="2M">2M (低畫質)</option>
              <option value="4M">4M (中畫質)</option>
              <option value="8M">8M (標準)</option>
              <option value="16M">16M (高畫質)</option>
              <option value="32M">32M (超高畫質)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              最大解析度 (px)
            </label>
            <input
              type="number"
              value={config.max_size}
              onChange={(e) => handleChange("max_size", parseInt(e.target.value))}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              min="720"
              max="2560"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">最大幀率 (FPS)</label>
            <input
              type="number"
              value={config.max_fps}
              onChange={(e) => handleChange("max_fps", parseInt(e.target.value))}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              min="15"
              max="120"
            />
          </div>
        </div>
      </div>

      {/* 視窗設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">視窗設定</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              視窗寬度 (選填)
            </label>
            <input
              type="number"
              value={config.window_width ?? ""}
              onChange={(e) => handleNumberChange("window_width", e.target.value)}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              placeholder="自動"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              視窗高度 (選填)
            </label>
            <input
              type="number"
              value={config.window_height ?? ""}
              onChange={(e) => handleNumberChange("window_height", e.target.value)}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              placeholder="自動"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              視窗 X 位置 (選填)
            </label>
            <input
              type="number"
              value={config.window_x ?? ""}
              onChange={(e) => handleNumberChange("window_x", e.target.value)}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              placeholder="自動"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              視窗 Y 位置 (選填)
            </label>
            <input
              type="number"
              value={config.window_y ?? ""}
              onChange={(e) => handleNumberChange("window_y", e.target.value)}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              placeholder="自動"
            />
          </div>
        </div>
      </div>

      {/* 顯示選項 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">顯示選項</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-center space-x-2 text-foreground/80">
            <input
              type="checkbox"
              checked={config.fullscreen}
              onChange={(e) => handleChange("fullscreen", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span className="text-sm">全螢幕模式</span>
          </label>

          <label className="flex cursor-pointer items-center space-x-2 text-foreground/80">
            <input
              type="checkbox"
              checked={config.always_on_top}
              onChange={(e) => handleChange("always_on_top", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span className="text-sm">視窗置頂</span>
          </label>

          <label className="flex cursor-pointer items-center space-x-2 text-foreground/80">
            <input
              type="checkbox"
              checked={config.show_touches}
              onChange={(e) => handleChange("show_touches", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span className="text-sm">顯示觸控點</span>
          </label>

          <label className="flex cursor-pointer items-center space-x-2 text-foreground/80">
            <input
              type="checkbox"
              checked={config.turn_screen_off}
              onChange={(e) => handleChange("turn_screen_off", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span className="text-sm">關閉設備螢幕</span>
          </label>
        </div>
      </div>

      {/* 設備選項 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">設備選項</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-center space-x-2 text-foreground/80">
            <input
              type="checkbox"
              checked={config.stay_awake}
              onChange={(e) => handleChange("stay_awake", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span className="text-sm">保持設備清醒</span>
          </label>

          <label className="flex cursor-pointer items-center space-x-2 text-foreground/80">
            <input
              type="checkbox"
              checked={config.enable_audio}
              onChange={(e) => handleChange("enable_audio", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span className="text-sm">啟用音訊轉發</span>
          </label>
        </div>

        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm text-warning">
            ⚠️ 建議關閉「啟用音訊轉發」以保留裝置的內建音訊功能
          </p>
        </div>
      </div>

      {/* 進階設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">進階設定</h3>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">渲染驅動 (選填)</label>
          <input
            type="text"
            value={config.render_driver}
            onChange={(e) => handleChange("render_driver", e.target.value)}
            disabled={disabled}
            className="ui-input w-full px-3 py-2"
            placeholder="預設 (opengl, metal, direct3d)"
          />
          <p className="mt-1 text-xs text-foreground/50">
            留空使用系統預設，Windows 可選 direct3d，macOS 可選 metal
          </p>
        </div>
      </div>
    </div>
  )
}
