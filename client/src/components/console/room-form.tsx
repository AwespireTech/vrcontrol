"use client"

import { useEffect, useState } from "react"
import { actionApi } from "@/services/api"
import { ACTION_TYPES, type Action, type Room } from "@/services/api-types"
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
    batchActionIds: profile?.batch_action_ids || [],
    launchActionId: profile?.launch_action_id || "",
    stopActionId: profile?.stop_action_id || "",
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
    launchActionId: initialProfile.launchActionId,
    stopActionId: initialProfile.stopActionId,
    allowActivityNameOverride: initialProfile.allowActivityNameOverride,
    allowSeedOverride: initialProfile.allowSeedOverride,
  })
  const assignedSequences = room?.assigned_sequences || {}
  const [submitting, setSubmitting] = useState(false)
  const [actions, setActions] = useState<Action[]>([])
  const [actionsLoading, setActionsLoading] = useState(true)

  useEffect(() => {
    const loadActions = async () => {
      try {
        const actionsData = await actionApi.getAll()
        setActions(actionsData)
      } catch (error) {
        console.error("Failed to load actions:", error)
        setActions([])
      } finally {
        setActionsLoading(false)
      }
    }

    void loadActions()
  }, [])

  useEffect(() => {
    if (actions.length === 0) {
      return
    }

    setFormData((prev) => {
      if ((prev.launchActionId && prev.stopActionId) || prev.batchActionIds.length === 0) {
        return prev
      }

      const selectedActions = actions.filter((action) => prev.batchActionIds.includes(action.action_id))
      const nextLaunchActionId =
        prev.launchActionId ||
        selectedActions.find((action) => action.action_type === ACTION_TYPES.LAUNCH_APP)?.action_id ||
        ""
      const nextStopActionId =
        prev.stopActionId ||
        selectedActions.find((action) => action.action_type === ACTION_TYPES.STOP_APP)?.action_id ||
        ""

      if (nextLaunchActionId === prev.launchActionId && nextStopActionId === prev.stopActionId) {
        return prev
      }

      return {
        ...prev,
        launchActionId: nextLaunchActionId,
        stopActionId: nextStopActionId,
      }
    })
  }, [actions])

  const launchActions = actions.filter((action) => action.action_type === ACTION_TYPES.LAUNCH_APP)
  const stopActions = actions.filter((action) => action.action_type === ACTION_TYPES.STOP_APP)

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
          batch_action_ids: [],
          launch_action_id: formData.launchActionId || undefined,
          stop_action_id: formData.stopActionId || undefined,
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
            每個 room 固定維護一組可重複執行的 activity 預設，以及開啟 / 關閉 app 動作設定。
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
          <label className="mb-2 block text-sm font-semibold text-foreground">開啟 app 動作</label>
          {actionsLoading ? (
            <div className="text-sm text-foreground/60">讀取動作中…</div>
          ) : launchActions.length === 0 ? (
            <div className="text-sm text-foreground/60">尚無可選的開啟 app 動作，請先到動作管理建立。</div>
          ) : (
            <select
              value={formData.launchActionId}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, launchActionId: event.target.value }))
              }
              className="ui-select w-full px-4 py-2"
            >
              <option value="">未指定</option>
              {launchActions.map((action) => (
                <option key={action.action_id} value={action.action_id}>
                  {action.name}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-foreground/50">控制頁批次與單機的「開啟 APP」會使用這個動作。</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">關閉 app 動作</label>
          {actionsLoading ? (
            <div className="text-sm text-foreground/60">讀取動作中…</div>
          ) : stopActions.length === 0 ? (
            <div className="text-sm text-foreground/60">尚無可選的關閉 app 動作，請先到動作管理建立。</div>
          ) : (
            <select
              value={formData.stopActionId}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, stopActionId: event.target.value }))
              }
              className="ui-select w-full px-4 py-2"
            >
              <option value="">未指定</option>
              {stopActions.map((action) => (
                <option key={action.action_id} value={action.action_id}>
                  {action.name}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-foreground/50">控制頁批次與單機的「關閉 APP」會使用這個動作。</p>
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
