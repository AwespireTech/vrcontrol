import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { LuMonitorPlay, LuPencilLine, LuPlus, LuSmartphone, LuTrash2 } from "react-icons/lu"
import { roomApi, deviceApi } from "@/services/api"
import type { Room } from "@/services/api-types"
import { getDisplayName } from "@/lib/utils/device"
import {
  MONITORING_WINDOW_BLOCKED_MESSAGE,
  openRoomMonitoringWindow,
} from "@/lib/utils/monitoring-window"
import PageShell from "@/components/console/page-shell"
import ListShell from "@/components/console/list-shell"
import ConsoleListRow from "@/components/console/console-list-row"
import IconActionButton from "@/components/console/icon-action-button"
import Button from "@/components/button"
import { DEFAULT_POLL_INTERVAL_SECONDS } from "@/environment"

export default function RoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [deviceNameMap, setDeviceNameMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)
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
          return DEFAULT_POLL_INTERVAL_SECONDS
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

  const handleOpenMonitoring = (roomId: string) => {
    const popup = openRoomMonitoringWindow(roomId, { display: "wall", layout: "grid" })

    if (!popup) {
      alert(MONITORING_WINDOW_BLOCKED_MESSAGE)
    }
  }

  const sortedRooms = useMemo(
    () => rooms.slice().sort((left, right) => left.name.localeCompare(right.name)),
    [rooms],
  )

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-foreground text-xl">載入中…</div>
      </div>
    )
  }

  return (
    <PageShell
      title="Groups 群組管理"
      subtitle={`下次更新 ${countdown} 秒`}
      eyebrow=""
      maxWidth="lg"
      headerVariant="plain"
      titleVariant="compact"
      actions={
        <Button
          onClick={() => navigate("/rooms/new")}
          className="ui-btn-sm ui-btn-primary px-5 whitespace-nowrap"
        >
          <LuPlus className="h-4 w-4" />
          Add Group 新增群組
        </Button>
      }
    >
      <ListShell
        title="群組列表"
        className="gap-2"
        variant="compact"
        headerVariant="compact"
        headingVariant="compact"
        columns={
          sortedRooms.length > 0 ? (
            <>
              <div className="col-span-3">Name 名稱</div>
              <div className="col-span-5">Devices 裝置</div>
              <div className="col-span-4">Active 動作</div>
            </>
          ) : undefined
        }
        emptyState={
          <div className="console-empty-state">
            <div className="console-empty-state__title">尚無群組</div>
            <p className="console-empty-state__description">
              點擊右上角按鈕建立第一個群組，之後即可分配裝置並進入控制流程。
            </p>
          </div>
        }
      >
        {sortedRooms.length > 0
          ? sortedRooms.map((room) => {
              const isDeleting = roomPending[room.room_id] === "delete"

              return (
                <ConsoleListRow
                  key={room.room_id}
                  variant="compact"
                  className="grid-cols-12 items-start"
                >
                  <div className="col-span-3">
                    <div className="console-table-title">{room.name}</div>
                    <div className="console-meta mt-1">{room.room_id}</div>
                    {room.description ? (
                      <div className="console-meta text-text-secondary mt-1">
                        {room.description}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-span-5 pt-0.5">
                    {room.device_ids.length === 0 ? (
                      <div className="console-meta pt-1">尚未分配裝置</div>
                    ) : (
                      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                        {room.device_ids.slice(0, 6).map((deviceId) => (
                          <div
                            key={deviceId}
                            className="text-text-primary flex items-center gap-2 text-sm"
                          >
                            <LuSmartphone className="text-text-muted h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {deviceNameMap.get(deviceId) || deviceId}
                            </span>
                          </div>
                        ))}
                        {room.device_ids.length > 6 ? (
                          <div className="console-meta">+{room.device_ids.length - 6} 更多</div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="console-action-stack console-action-stack--fit col-span-4">
                    <div className="console-action-stack__controls console-action-stack__controls--fit">
                      <Button
                        onClick={() => navigate(`/rooms/${room.room_id}/control`)}
                        className="console-button-pill console-button-pill--fit ui-btn-sm ui-btn-primary"
                      >
                        進入控制頁
                      </Button>
                      <Button
                        onClick={() => handleOpenMonitoring(room.room_id)}
                        className="console-button-pill console-button-pill--fit ui-btn-sm ui-btn-primary"
                        title="開新監控視窗"
                      >
                        <LuMonitorPlay className="h-4 w-4" />
                        開啟監控
                      </Button>
                    </div>

                    <div className="console-action-stack__icons">
                      <IconActionButton
                        onClick={() => navigate(`/rooms/${room.room_id}`)}
                        disabled={isDeleting}
                        aria-label={`編輯 ${room.name}`}
                        title="編輯"
                      >
                        <LuPencilLine className="h-4 w-4" />
                      </IconActionButton>
                      <IconActionButton
                        onClick={() => handleDelete(room.room_id)}
                        danger
                        loading={isDeleting}
                        disabled={isDeleting}
                        aria-label={`刪除 ${room.name}`}
                        title="刪除"
                      >
                        <LuTrash2 className="h-4 w-4" />
                      </IconActionButton>
                    </div>
                  </div>
                </ConsoleListRow>
              )
            })
          : null}
      </ListShell>
    </PageShell>
  )
}
