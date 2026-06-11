import { useEffect, useState } from "react"
import { LuHouse, LuSmartphone } from "react-icons/lu"
import { deviceApi, roomApi } from "@/services/api"
import type { Device, Room } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"
import DashboardLinkCard from "@/components/console/dashboard-link-card"
import DashboardStatCard from "@/components/console/dashboard-stat-card"

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  const loadData = async () => {
    try {
      const [devicesData, roomsData] = await Promise.all([deviceApi.getAll(), roomApi.getAll()])
      setDevices(devicesData)
      setRooms(roomsData)
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalDevices = devices.length

  const summaryCards = [
    {
      label: "Devices 裝置總數",
      value: totalDevices,
      icon: LuSmartphone,
      tone: "primary",
    },
    {
      label: "Groups 群組總數",
      value: rooms.length,
      icon: LuHouse,
      tone: "default",
    },
  ] as const

  const managementCards = [
    {
      to: "/devices",
      title: "Manage Devices",
      subtitle: "裝置管理 >",
      description: "建立、編輯與管理裝置，查看裝置狀態與裝置配置。",
      icon: LuSmartphone,
    },
    {
      to: "/rooms",
      title: "Manage Groups",
      subtitle: "群組管理 >",
      description: "建立群組，分配裝置並管理後續連線與控制流程。",
      icon: LuHouse,
    },
  ] as const

  return (
    <PageShell
      title="Dashboard 總覽"
      subtitle=""
      eyebrow=""
      maxWidth="md"
      headerVariant="plain"
      titleVariant="compact"
    >
      <div className="max-w-[900px] space-y-5">
        <section className="console-section">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {summaryCards.map((item) => (
              <DashboardStatCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </div>
        </section>

        <section className="console-section">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {managementCards.map((item) => (
              <DashboardLinkCard
                key={item.title}
                to={item.to}
                title={item.title}
                subtitle={item.subtitle}
                description={item.description}
                icon={item.icon}
              />
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
