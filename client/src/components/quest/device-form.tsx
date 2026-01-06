'use client'

import { useState, useEffect } from 'react'
import type { QuestDevice } from '@/services/quest-types'

interface DeviceFormProps {
  device?: QuestDevice
  onSubmit: (device: Partial<QuestDevice>) => Promise<void>
  onCancel: () => void
}

export default function DeviceForm({ device, onSubmit, onCancel }: DeviceFormProps) {
  const [formData, setFormData] = useState({
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
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          設備名稱 *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例如: Quest 1"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          IP 地址 *
        </label>
        <input
          type="text"
          name="ip"
          value={formData.ip}
          onChange={handleChange}
          required
          pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例如: 192.168.1.100"
        />
        <p className="text-xs text-gray-500 mt-1">請輸入有效的 IPv4 地址</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          ADB 端口
        </label>
        <input
          type="number"
          name="port"
          value={formData.port}
          onChange={handleChange}
          min="1"
          max="65535"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">預設: 5555</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          排序順序
        </label>
        <input
          type="number"
          name="sort_order"
          value={formData.sort_order}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">數字越小越靠前</p>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '提交中...' : device ? '更新' : '創建'}
        </button>
      </div>
    </form>
  )
}
