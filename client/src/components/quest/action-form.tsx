'use client'

import { useState } from 'react'
import type { QuestAction } from '@/services/quest-types'
import { QUEST_ACTION_TYPES } from '@/services/quest-types'

interface ActionFormProps {
  action?: QuestAction
  onSubmit: (action: Partial<QuestAction>) => Promise<void>
  onCancel: () => void
}

export default function ActionForm({ action, onSubmit, onCancel }: ActionFormProps) {
  const [formData, setFormData] = useState({
    name: action?.name || '',
    description: action?.description || '',
    action_type: action?.action_type || QUEST_ACTION_TYPES.WAKE_UP,
    parameters: action?.parameters ? JSON.stringify(action.parameters, null, 2) : '{}',
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
        action_type: formData.action_type,
        parameters,
      })
    } catch (error) {
      console.error('Failed to submit form:', error)
      alert('提交失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const getParameterTemplate = (actionType: string) => {
    switch (actionType) {
      case QUEST_ACTION_TYPES.LAUNCH_APP:
        return JSON.stringify(
          {
            package_name: 'com.example.app',
            activity: '.MainActivity',
          },
          null,
          2,
        )
      case QUEST_ACTION_TYPES.STOP_APP:
      case QUEST_ACTION_TYPES.RESTART_APP:
        return JSON.stringify(
          {
            package_name: 'com.example.app',
          },
          null,
          2,
        )
      case QUEST_ACTION_TYPES.KEEP_AWAKE:
        return JSON.stringify(
          {
            duration_seconds: 3600,
          },
          null,
          2,
        )
      case QUEST_ACTION_TYPES.SEND_KEY:
        return JSON.stringify(
          {
            keycode: 26,
          },
          null,
          2,
        )
      case QUEST_ACTION_TYPES.INSTALL_APK:
        return JSON.stringify(
          {
            apk_path: '/path/to/app.apk',
          },
          null,
          2,
        )
      default:
        return '{}'
    }
  }

  const handleActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value
    setFormData((prev) => ({
      ...prev,
      action_type: newType,
      parameters: getParameterTemplate(newType),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          動作名稱 *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例如: 喚醒所有設備"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          動作類型 *
        </label>
        <select
          name="action_type"
          value={formData.action_type}
          onChange={handleActionTypeChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={QUEST_ACTION_TYPES.WAKE_UP}>☀️ 喚醒設備</option>
          <option value={QUEST_ACTION_TYPES.SLEEP}>🌙 休眠設備</option>
          <option value={QUEST_ACTION_TYPES.LAUNCH_APP}>🚀 啟動應用</option>
          <option value={QUEST_ACTION_TYPES.STOP_APP}>⏹️ 停止應用</option>
          <option value={QUEST_ACTION_TYPES.RESTART_APP}>🔄 重啟應用</option>
          <option value={QUEST_ACTION_TYPES.KEEP_AWAKE}>⏰ 保持喚醒</option>
          <option value={QUEST_ACTION_TYPES.SEND_KEY}>⌨️ 發送按鍵</option>
          <option value={QUEST_ACTION_TYPES.INSTALL_APK}>📦 安裝 APK</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          動作描述
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="描述這個動作的用途..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          參數配置 (JSON)
        </label>
        <textarea
          name="parameters"
          value={formData.parameters}
          onChange={handleChange}
          rows={8}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder='{"key": "value"}'
        />
        <p className="text-xs text-gray-500 mt-1">
          根據動作類型輸入對應的參數，系統會自動提供模板
        </p>
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
          {submitting ? '提交中...' : action ? '更新' : '創建'}
        </button>
      </div>
    </form>
  )
}
