"use client"

import { useState } from "react"
import type { QuestRoom } from "@/services/quest-types"
import Button from "@/components/button"

interface RoomFormProps {
  room?: QuestRoom
  onSubmit: (room: Partial<QuestRoom>) => Promise<void>
  onCancel: () => void
}

export default function RoomForm({ room, onSubmit, onCancel }: RoomFormProps) {
  const [formData, setFormData] = useState({
    name: room?.name || "",
    description: room?.description || "",
    parameters: room?.parameters ? JSON.stringify(room.parameters, null, 2) : "{}",
  })
  const assignedSequences = room?.assigned_sequences || {}
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // 解析 parameters JSON
      let parameters = {}
      try {
        parameters = JSON.parse(formData.parameters)
      } catch {
        alert("參數格式錯誤，請輸入有效的 JSON")
        setSubmitting(false)
        return
      }

      await onSubmit({
        name: formData.name,
        description: formData.description,
        parameters,
      })
    } catch (error) {
      console.error("Failed to submit form:", error)
      alert("提交失敗，請稍後再試")
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
        <label className="mb-2 block text-sm font-semibold text-foreground">房間名稱 *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="ui-input w-full px-4 py-2"
          placeholder="例如: VR Room 1"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">房間描述</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="ui-input w-full px-4 py-2"
          placeholder="描述這個房間的用途..."
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">參數配置 (JSON)</label>
        <textarea
          name="parameters"
          value={formData.parameters}
          onChange={handleChange}
          rows={6}
          className="ui-input w-full px-4 py-2 font-mono text-sm"
          placeholder='{"key": "value"}'
        />
        <p className="mt-1 text-xs text-foreground/50">
          輸入 JSON 格式的參數，將會同步到 Socket Server 的所有客戶端
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">
          Assigned Sequences (唯讀)
        </label>
        <textarea
          value={JSON.stringify(assignedSequences, null, 2)}
          readOnly
          rows={6}
          className="ui-input w-full bg-muted/30 px-4 py-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-foreground/50">
          由控制流程寫入，作為目前房間的玩家序號對應。
        </p>
      </div>

      <div className="flex justify-end gap-3 border-t border-border/70 pt-4">
        <button type="button" onClick={onCancel} className="ui-btn ui-btn-md ui-btn-muted">
          取消
        </button>
        <Button
          type="submit"
          disabled={submitting}
          loading={submitting}
          className="ui-btn-md ui-btn-primary"
        >
          {room ? "更新" : "建立"}
        </Button>
      </div>
    </form>
  )
}
