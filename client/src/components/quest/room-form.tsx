'use client'

import { useState } from 'react'
import type { QuestRoom } from '@/services/quest-types'

interface RoomFormProps {
  room?: QuestRoom
  onSubmit: (room: Partial<QuestRoom>) => Promise<void>
  onCancel: () => void
}

export default function RoomForm({ room, onSubmit, onCancel }: RoomFormProps) {
  const [formData, setFormData] = useState({
    name: room?.name || '',
    description: room?.description || '',
    parameters: room?.parameters ? JSON.stringify(room.parameters, null, 2) : '{}',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // 解析 parameters JSON
      let parameters = {}
      try {
        parameters = JSON.parse(formData.parameters)
      } catch (error) {
        alert('參數格式錯誤，請輸入有效的 JSON')
        setSubmitting(false)
        return
      }

      await onSubmit({
        name: formData.name,
        description: formData.description,
        parameters,
      })
    } catch (error) {
      console.error('Failed to submit form:', error)
      alert('提交失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          房間名稱 *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例如: VR Room 1"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          房間描述
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="描述這個房間的用途..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          參數配置 (JSON)
        </label>
        <textarea
          name="parameters"
          value={formData.parameters}
          onChange={handleChange}
          rows={6}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
          placeholder='{"key": "value"}'
        />
        <p className="text-xs text-foreground/50 mt-1">
          輸入 JSON 格式的參數，將會同步到 Socket Server 的所有客戶端
        </p>
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
          {submitting ? '提交中...' : room ? '更新' : '創建'}
        </button>
      </div>
    </form>
  )
}
