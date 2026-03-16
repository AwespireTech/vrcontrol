import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { actionApi, deviceApi, roomApi } from "@/services/api"
import type { Action, Device, Room } from "@/services/api-types"
import { useMonitoringStatus } from "@/hooks/useMonitoringStatus"
import PageShell from "@/components/console/page-shell"

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const monitoring = useMonitoringStatus()

  const loadData = async () => {
    try {
      const [devicesData, roomsData, actionsData] = await Promise.all([
        deviceApi.getAll(),
        roomApi.getAll(),
        actionApi.getAll(),
      ])
      setDevices(devicesData)
      setRooms(roomsData)
      setActions(actionsData)
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const onlineDevices = devices.filter((d) => d.status === "online").length
  const totalDevices = devices.length

  return (
    <PageShell
      title="設備控制台"
      subtitle="管理 VR 設備、房間與動作"
      actions={
        <Link
          to="/settings"
          className="ui-btn ui-btn-md ui-btn-outline inline-flex items-center gap-2"
        >
          ⚙️ 系統設定
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "設備總數", value: totalDevices, icon: "📱" },
          { label: "在線設備", value: onlineDevices, icon: "✅", accent: "text-success" },
          { label: "房間數量", value: rooms.length, icon: "🏠" },
          { label: "動作數量", value: actions.length, icon: "⚡" },
        ].map((item) => (
          <div key={item.label} className="surface-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground/60">{item.label}</p>
                <p className={`text-3xl font-bold ${item.accent ?? "text-foreground"}`}>
                  {item.value}
                </p>
              </div>
              <div className="text-4xl">{item.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          {
            to: "/devices",
            icon: "📱",
            title: "設備管理",
            desc: "建立、編輯與管理設備，查看設備狀態",
          },
          {
            to: "/rooms",
            icon: "🏠",
            title: "房間管理",
            desc: "建立房間，分配設備並管理 Socket 連線",
          },
          {
            to: "/actions",
            icon: "⚡",
            title: "動作管理",
            desc: "建立與執行設備動作，支援批次操作",
          },
          {
            to: "/monitoring",
            icon: "🛰️",
            title: "網絡監控",
            desc: "背景監控會定期 Ping 設備 IP，並在設備恢復可達時嘗試 ADB 重連",
            meta: `目前狀態：${
              !monitoring.known ? "未知" : monitoring.running ? "運行中" : "已停止"
            }（詳情與控制請到監控頁）`,
          },
        ].map((item) => (
          <Link
            key={item.title}
            to={item.to}
            className="group rounded-2xl border border-border/70 bg-surface/50 p-6 transition hover:border-primary/60 hover:bg-surface/70"
          >
            <div className="text-4xl">{item.icon}</div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm text-foreground/70">{item.desc}</p>
            {item.meta ? <p className="mt-3 text-xs text-foreground/50">{item.meta}</p> : null}
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
