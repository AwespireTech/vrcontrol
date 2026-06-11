import { useState, useEffect } from "react"
import type { ScrcpyConfig } from "@/services/api-types"

const bitratePresets = ["800k", "1M", "2M", "4M"]

function validateBitrate(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return "位元率不能為空"
  }

  if (!/^\d+(?:[kKmM])?$/.test(trimmed)) {
    return "位元率格式需為整數加上 k 或 M，例如 800k、1M"
  }

  return null
}

interface ScrcpyConfigFormProps {
  value: ScrcpyConfig
  onChange: (config: ScrcpyConfig) => void
  onValidityChange?: (isValid: boolean) => void
  disabled?: boolean
}

export function ScrcpyConfigForm({
  value,
  onChange,
  onValidityChange,
  disabled = false,
}: ScrcpyConfigFormProps) {
  const [config, setConfig] = useState<ScrcpyConfig>(value)
  const [bitrateTouched, setBitrateTouched] = useState(false)
  const bitrateError = validateBitrate(config.bitrate)

  useEffect(() => {
    setConfig(value)
    setBitrateTouched(false)
  }, [value])

  useEffect(() => {
    onValidityChange?.(bitrateError === null)
  }, [bitrateError, onValidityChange])

  const handleChange = (field: keyof ScrcpyConfig, fieldValue: unknown) => {
    const newConfig = { ...config, [field]: fieldValue }
    setConfig(newConfig)
    onChange(newConfig)
  }

  const handleBitrateChange = (nextBitrate: string) => {
    setBitrateTouched(true)
    handleChange("bitrate", nextBitrate)
  }

  const shouldShowBitrateError = bitrateTouched || value.bitrate.trim().length > 0

  return (
    <div className="space-y-6">
      {/* 視訊品質設定 */}
      <div className="space-y-4">
        <h3 className="text-foreground text-lg font-semibold">視訊品質</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="scrcpy-bitrate"
              className="text-foreground mb-1 block text-sm font-medium"
            >
              位元率
            </label>
            <input
              id="scrcpy-bitrate"
              type="text"
              value={config.bitrate}
              onChange={(e) => handleBitrateChange(e.target.value)}
              disabled={disabled}
              className="ui-input w-full px-3 py-2"
              placeholder="例如 800k、1M、2M"
              list="scrcpy-bitrate-presets"
            />
            <datalist id="scrcpy-bitrate-presets">
              {bitratePresets.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
            <div className="mt-2 flex flex-wrap gap-2">
              {bitratePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleBitrateChange(preset)}
                  disabled={disabled}
                  className="ui-btn ui-btn-xs ui-btn-outline"
                >
                  {preset}
                </button>
              ))}
            </div>
            {shouldShowBitrateError && bitrateError ? (
              <p className="mt-2 text-xs text-red-500">{bitrateError}</p>
            ) : (
              <p className="text-foreground/50 mt-2 text-xs">
                建議先從 800k、1M 或 2M 開始，必要時再往上調整。
              </p>
            )}
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
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
            <label className="text-foreground mb-1 block text-sm font-medium">最大幀率 (FPS)</label>
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
        <h3 className="text-foreground text-lg font-semibold">進階設定</h3>

        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">
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
          <p className="text-foreground/50 mt-1 text-xs">
            主要影響 WebRTC 即時畫面的首幀等待時間。錯誤值可能導致即時畫面來源啟動失敗。
          </p>
        </div>
      </div>
    </div>
  )
}
