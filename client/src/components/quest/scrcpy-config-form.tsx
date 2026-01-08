import { useState, useEffect } from 'react'
import type { ScrcpyConfig } from '@/services/quest-types'

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
    const numValue = stringValue === '' ? undefined : parseInt(stringValue)
    handleChange(field, numValue)
  }

  return (
    <div className="space-y-6">
      {/* 視訊品質設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">視訊品質</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">位元率</label>
            <select
              value={config.bitrate}
              onChange={(e) => handleChange('bitrate', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="2M">2M (低畫質)</option>
              <option value="4M">4M (中畫質)</option>
              <option value="8M">8M (標準)</option>
              <option value="16M">16M (高畫質)</option>
              <option value="32M">32M (超高畫質)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">最大解析度 (px)</label>
            <input
              type="number"
              value={config.max_size}
              onChange={(e) => handleChange('max_size', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
              min="720"
              max="2560"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">最大幀率 (FPS)</label>
            <input
              type="number"
              value={config.max_fps}
              onChange={(e) => handleChange('max_fps', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
              min="15"
              max="120"
            />
          </div>
        </div>
      </div>

      {/* 視窗設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">視窗設定</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">視窗寬度 (選填)</label>
            <input
              type="number"
              value={config.window_width ?? ''}
              onChange={(e) => handleNumberChange('window_width', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="自動"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">視窗高度 (選填)</label>
            <input
              type="number"
              value={config.window_height ?? ''}
              onChange={(e) => handleNumberChange('window_height', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="自動"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">視窗 X 位置 (選填)</label>
            <input
              type="number"
              value={config.window_x ?? ''}
              onChange={(e) => handleNumberChange('window_x', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="自動"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">視窗 Y 位置 (選填)</label>
            <input
              type="number"
              value={config.window_y ?? ''}
              onChange={(e) => handleNumberChange('window_y', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="自動"
            />
          </div>
        </div>
      </div>

      {/* 顯示選項 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">顯示選項</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.fullscreen}
              onChange={(e) => handleChange('fullscreen', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span className="text-sm">全螢幕模式</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.always_on_top}
              onChange={(e) => handleChange('always_on_top', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span className="text-sm">視窗置頂</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.show_touches}
              onChange={(e) => handleChange('show_touches', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span className="text-sm">顯示觸控點</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.turn_screen_off}
              onChange={(e) => handleChange('turn_screen_off', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span className="text-sm">關閉設備螢幕</span>
          </label>
        </div>
      </div>

      {/* 設備選項 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">設備選項</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.stay_awake}
              onChange={(e) => handleChange('stay_awake', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span className="text-sm">保持設備清醒</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enable_audio}
              onChange={(e) => handleChange('enable_audio', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span className="text-sm">啟用音訊轉發</span>
          </label>
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ 建議關閉「啟用音訊轉發」以保留 Quest 設備的內建音訊功能
          </p>
        </div>
      </div>

      {/* 進階設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">進階設定</h3>
        
        <div>
          <label className="block text-sm font-medium mb-1">渲染驅動 (選填)</label>
          <input
            type="text"
            value={config.render_driver}
            onChange={(e) => handleChange('render_driver', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="預設 (opengl, metal, direct3d)"
          />
          <p className="text-xs text-foreground/50 mt-1">
            留空使用系統預設，Windows 可選 direct3d，macOS 可選 metal
          </p>
        </div>
      </div>
    </div>
  )
}
