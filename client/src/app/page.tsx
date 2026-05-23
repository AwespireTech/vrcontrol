import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LuArrowRight, LuHouse, LuSmartphone } from "react-icons/lu"
import { deviceApi, roomApi } from "@/services/api"
import type { Device, Room } from "@/services/api-types"
import PageShell from "@/components/console/page-shell"

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
    >
      <div className="max-w-[900px] space-y-5">
        <section className="console-section">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {summaryCards.map((item) => {
              const Icon = item.icon

              return (
                <div key={item.label} className="surface-card rounded-[18px] bg-bg-surface/96 px-6 py-5">
                  <p className="text-sm font-medium text-text-secondary">{item.label}</p>
                  <div className="mt-5 flex items-center gap-4">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${
                        item.tone === "primary"
                          ? "bg-msg-primary/12 text-text-primary"
                          : "bg-bg-panel/80 text-text-primary"
                      }`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <p className="font-display text-5xl font-bold tracking-[-0.05em] text-text-primary">
                      {item.value}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="console-section">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {managementCards.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className="surface-card surface-card-hover group block rounded-[18px] border border-border-accent bg-bg-shell/82 px-6 py-5"
                >
                  <div className="flex h-full flex-col justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-msg-primary/14 text-msg-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xl font-semibold leading-tight text-msg-primary">{item.title}</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-msg-primary">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <p className="max-w-xs text-sm leading-7 text-text-secondary">{item.description}</p>
                      <LuArrowRight className="h-5 w-5 shrink-0 text-msg-primary transition duration-200 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
