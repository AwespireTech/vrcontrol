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

      {/* 進階設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">進階設定</h3>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Video codec options (選填)
          </label>
          <input
            type="text"
            value={config.video_codec_options}
            onChange={(e) => handleChange("video_codec_options", e.target.value)}
            disabled={disabled}
            className="ui-input w-full px-3 py-2"
            placeholder="例如 i-frame-interval:int=1"
          />
          <p className="mt-1 text-xs text-foreground/50">
            主要影響 WebRTC 即時畫面的首幀等待時間。錯誤值可能導致即時畫面來源啟動失敗。
          </p>
        </div>
      </div>
    </div>
  )
}
