'use client'

import { useState } from 'react'
import type { QuestDevice } from '@/services/quest-types'

interface DeviceFormProps {
  device?: QuestDevice
  onSubmit: (device: Partial<QuestDevice>) => Promise<void>
  onCancel: () => void
}

export default function DeviceForm({ device, onSubmit, onCancel }: DeviceFormProps) {
  const [formData, setFormData] = useState({
    alias: device?.alias || '',
    name: device?.name || '',
    ip: device?.ip || '',
    port: device?.port || 5555,
    sort_order: device?.sort_order || 0,
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Failed to submit form:', error)
      alert('提交失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          顯示名稱 *
        </label>
        <input
          type="text"
          name="alias"
          value={formData.alias}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例如: Quest 1"
        />
        <p className="text-xs text-foreground/50 mt-1">設備的自訂顯示名稱</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          原始設備名稱
        </label>
        <div className="w-full px-4 py-2 border border-border rounded-lg bg-muted/30 text-foreground/70">
          {device?.name || '(連接設備後自動填入)'}
        </div>
        <p className="text-xs text-foreground/50 mt-1">由 ADB 自動獲取的設備名稱，不可編輯</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          IP 地址 *
        </label>
        <input
          type="text"
          name="ip"
          value={formData.ip}
          onChange={handleChange}
          required
          pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例如: 192.168.1.100"
        />
        <p className="text-xs text-foreground/50 mt-1">請輸入有效的 IPv4 地址</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          ADB 端口
        </label>
        <input
          type="number"
          name="port"
          value={formData.port}
          onChange={handleChange}
          min="1"
          max="65535"
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-foreground/50 mt-1">預設: 5555</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          排序順序
        </label>
        <input
          type="number"
          name="sort_order"
          value={formData.sort_order}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-foreground/50 mt-1">數字越小越靠前</p>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/50 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '提交中...' : device ? '更新' : '創建'}
        </button>
      </div>
    </form>
  )
}
