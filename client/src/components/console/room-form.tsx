"use client"

import { useState } from "react"
import type { Room } from "@/services/api-types"
import Button from "@/components/button"

const DEFAULT_ACTIVITY_CONTEXT = {
  mode: "",
  round: 1,
  qa: {
    questionSetId: "",
    questionOrder: [],
    timeLimitSec: 30,
    allowRetry: false,
    scoreMode: "team",
    display: {
      showCountdown: true,
      showResultAfterEachQuestion: true,
    },
    resumePolicy: "from_current_question",
  },
}

function buildInitialOperationProfile(room?: Room) {
  const profile = room?.operation_profile
  return {
    activityName: profile?.activity_defaults?.name || "",
    activitySeed: profile?.activity_defaults?.seed?.toString() || "",
    activityContext: JSON.stringify(
      profile?.activity_defaults?.activity_context || DEFAULT_ACTIVITY_CONTEXT,
      null,
      2,
    ),
    batchActionIds: JSON.stringify(profile?.batch_action_ids || [], null, 2),
    allowActivityNameOverride: profile?.allow_activity_name_override ?? true,
    allowSeedOverride: profile?.allow_seed_override ?? true,
  }
}

interface RoomFormProps {
  room?: Room
  onSubmit: (room: Partial<Room>) => Promise<void>
  onCancel: () => void
}

export default function RoomForm({ room, onSubmit, onCancel }: RoomFormProps) {
  const initialProfile = buildInitialOperationProfile(room)
  const [formData, setFormData] = useState({
    name: room?.name || "",
    description: room?.description || "",
    parameters: room?.parameters ? JSON.stringify(room.parameters, null, 2) : "{}",
    activityName: initialProfile.activityName,
    activitySeed: initialProfile.activitySeed,
    activityContext: initialProfile.activityContext,
    batchActionIds: initialProfile.batchActionIds,
    allowActivityNameOverride: initialProfile.allowActivityNameOverride,
    allowSeedOverride: initialProfile.allowSeedOverride,
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

      let activityContext = {}
      try {
        const parsed = JSON.parse(formData.activityContext)
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          alert("活動預設 context 必須是 JSON 物件")
          setSubmitting(false)
          return
        }
        activityContext = parsed
      } catch {
        alert("活動預設 context 格式錯誤，請輸入有效的 JSON 物件")
        setSubmitting(false)
        return
      }

      let batchActionIds: string[] = []
      try {
        const parsed = JSON.parse(formData.batchActionIds)
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
          alert("固定批次動作必須是字串陣列，例如 [\"ACTION-1\"]")
          setSubmitting(false)
          return
        }
        batchActionIds = parsed
      } catch {
        alert("固定批次動作格式錯誤，請輸入有效的 JSON 陣列")
        setSubmitting(false)
        return
      }

      const seedText = formData.activitySeed.trim()
      const parsedSeed = seedText === "" ? undefined : Number(seedText)
      if (seedText !== "" && !Number.isInteger(parsedSeed)) {
        alert("固定 seed 必須是整數")
        setSubmitting(false)
        return
      }

      await onSubmit({
        name: formData.name,
        description: formData.description,
        parameters,
        operation_profile: {
          activity_defaults: {
            name: formData.activityName.trim(),
            activity_context: activityContext,
            ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
          },
          batch_action_ids: batchActionIds,
          allow_activity_name_override: formData.allowActivityNameOverride,
          allow_seed_override: formData.allowSeedOverride,
        },
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
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
          用於固定房間配置，例如 minimap、空間座標或長期 defaults。操作流程相關設定請放在下方的目前操作設定。
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-surface/30 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">目前操作設定</h3>
          <p className="mt-1 text-xs text-foreground/50">
            每個 room 固定維護一組可重複執行的 activity 預設與批次動作設定。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">預設活動名稱</label>
          <input
            type="text"
            name="activityName"
            value={formData.activityName}
            onChange={handleChange}
            className="ui-input w-full px-4 py-2"
            placeholder="例如: Standard Round"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">固定 Seed</label>
          <input
            type="number"
            name="activitySeed"
            value={formData.activitySeed}
            onChange={handleChange}
            className="ui-input w-full px-4 py-2"
            placeholder="留白表示每次由啟動流程自動產生"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Activity 預設 Context (JSON)
          </label>
          <textarea
            name="activityContext"
            value={formData.activityContext}
            onChange={handleChange}
            rows={10}
            className="ui-input w-full px-4 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            固定批次動作 IDs (JSON array)
          </label>
          <textarea
            name="batchActionIds"
            value={formData.batchActionIds}
            onChange={handleChange}
            rows={4}
            className="ui-input w-full px-4 py-2 font-mono text-sm"
            placeholder='["ACTION-001", "ACTION-002"]'
          />
          <p className="mt-1 text-xs text-foreground/50">
            控制頁會依這份清單顯示固定批次操作按鈕，不再讓操作人員每次重新選 action。
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="allowActivityNameOverride"
            checked={formData.allowActivityNameOverride}
            onChange={handleCheckboxChange}
            className="h-4 w-4"
          />
          控制頁允許臨時覆蓋活動名稱
        </label>

        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="allowSeedOverride"
            checked={formData.allowSeedOverride}
            onChange={handleCheckboxChange}
            className="h-4 w-4"
          />
          控制頁允許臨時覆蓋 seed
        </label>
      </section>

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
