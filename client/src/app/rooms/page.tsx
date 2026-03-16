import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { roomApi, deviceApi } from "@/services/quest-api"
import type { QuestRoom } from "@/services/quest-types"
import { getDisplayName } from "@/lib/utils/device"
import QuestPageShell from "@/components/quest/quest-page-shell"
import Button from "@/components/button"

export default function RoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<QuestRoom[]>([])
  const [deviceNameMap, setDeviceNameMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const [roomPending, setRoomPending] = useState<Record<string, "delete">>({})

  const loadData = async () => {
    try {
      const [roomsData, devicesData] = await Promise.all([roomApi.getAll(), deviceApi.getAll()])
      setRooms(roomsData)

      // 建立設備 ID 到名稱的映射
      const nameMap = new Map<string, string>()
      devicesData.forEach((device) => {
        nameMap.set(device.device_id, getDisplayName(device))
      })
      setDeviceNameMap(nameMap)
    } catch (error) {
      console.error("Failed to load rooms:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          loadData()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  const handleDelete = async (roomId: string) => {
    if (!confirm("確定要刪除這個房間嗎？")) return
    if (roomPending[roomId]) return
    setRoomPending((prev) => ({ ...prev, [roomId]: "delete" }))
    try {
      await roomApi.delete(roomId)
      await loadData()
    } catch (error) {
      console.error("Failed to delete room:", error)
      alert("刪除失敗，請稍後再試")
    } finally {
      setRoomPending((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-xl text-foreground">載入中…</div>
      </div>
    )
  }

  return (
    <QuestPageShell
      title="房間管理"
      subtitle={`下次更新 ${countdown} 秒`}
      actions={
        <button
          onClick={() => navigate("/rooms/new")}
          className="ui-btn ui-btn-md ui-btn-primary"
        >
          + 建立房間
        </button>
      }
    >
      {rooms.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <div className="text-5xl">🏠</div>
          <div className="mt-4 text-lg font-semibold text-foreground">尚無房間</div>
          <div className="mt-2 text-sm text-foreground/70">點擊上方按鈕建立第一個房間</div>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/50 px-4 py-3 text-xs text-foreground/60">
            <div className="col-span-4">房間</div>
            <div className="col-span-4">設備</div>
            <div className="col-span-1">數量</div>
            <div className="col-span-3 text-right">操作</div>
          </div>
          {rooms.map((room) => (
            <div
              key={room.room_id}
              className="grid grid-cols-12 items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface/40"
            >
              <div className="col-span-4">
                <div className="font-semibold text-foreground">{room.name}</div>
                <div className="font-mono text-xs text-foreground/50">{room.room_id}</div>
                {room.description ? (
                  <div className="mt-1 text-xs text-foreground/70">{room.description}</div>
                ) : null}
              </div>
              <div className="col-span-4">
                {room.device_ids.length === 0 ? (
                  <div className="text-xs text-foreground/50">尚未分配設備</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {room.device_ids.slice(0, 3).map((deviceId) => (
                      <span key={deviceId} className="ui-badge ui-badge-primary">
                        {deviceNameMap.get(deviceId) || deviceId}
                      </span>
                    ))}
                    {room.device_ids.length > 3 && (
                      <span className="ui-badge ui-badge-muted">
                        +{room.device_ids.length - 3} 更多
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-1 text-sm text-foreground/80">{room.device_ids.length}</div>
              <div className="col-span-3 flex flex-wrap items-start justify-end gap-2">
                <button
                  onClick={() => navigate(`/rooms/${room.room_id}/control`)}
                  className="ui-btn ui-btn-xs ui-btn-primary"
                >
                  控制
                </button>
                <button
                  onClick={() => navigate(`/rooms/${room.room_id}/devices`)}
                  className="ui-btn ui-btn-xs ui-btn-muted"
                >
                  管理設備
                </button>
                <button
                  onClick={() => navigate(`/rooms/${room.room_id}`)}
                  className="ui-btn ui-btn-xs ui-btn-muted"
                >
                  編輯
                </button>
                <Button
                  onClick={() => handleDelete(room.room_id)}
                  className="ui-btn-xs ui-btn-danger"
                  loading={roomPending[room.room_id] === "delete"}
                  disabled={!!roomPending[room.room_id]}
                >
                  刪除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </QuestPageShell>
  )
}
