import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import type { IconType } from "react-icons"
import {
  LuBookOpenText,
  LuHouse,
  LuLayoutDashboard,
  LuMonitorPlay,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuSettings2,
  LuSparkles,
  LuSmartphone,
} from "react-icons/lu"
import SidebarNavItem from "@/components/console/sidebar-nav-item"
import { roomApi } from "@/services/api"
import type { Room } from "@/services/api-types"

type NavItem = {
  label: string
  caption: string
  to?: string
  icon: IconType
  exact?: boolean
  disabled?: boolean
  badge?: string
}

type NavSection = {
  label: string
  items: NavItem[]
}

const buildSections = (): NavSection[] => [
  {
    label: "Console",
    items: [
      { label: "Dashboard", caption: "總覽", to: "/", icon: LuLayoutDashboard, exact: true },
      { label: "Devices", caption: "裝置", to: "/devices", icon: LuSmartphone },
      { label: "Groups", caption: "群組", to: "/rooms", icon: LuHouse },
      { label: "Monitor", caption: "監控", to: "/monitoring", icon: LuMonitorPlay },
      { label: "Actions", caption: "動作", to: "/actions", icon: LuSparkles },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", caption: "設定", to: "/settings", icon: LuSettings2 },
      {
        label: "Manual",
        caption: "文件入口",
        icon: LuBookOpenText,
        disabled: true,
        badge: "Soon",
      },
    ],
  },
]

type SidebarProps = {
  width: number
  collapsedWidth: number
  collapsed: boolean
  dragging: boolean
  onToggleCollapsed: () => void
  onResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}

export default function AppSidebar({
  width,
  collapsedWidth,
  collapsed,
  dragging,
  onToggleCollapsed,
  onResizePointerDown,
}: SidebarProps) {
  const location = useLocation()
  const sections = useMemo(buildSections, [])
  const [rooms, setRooms] = useState<Room[]>([])

  const sidebarWidth = collapsed ? collapsedWidth : width

  useEffect(() => {
    let active = true

    void roomApi
      .getAll()
      .then((data) => {
        if (!active) {
          return
        }

        setRooms(data)
      })
      .catch((error) => {
        console.error("Failed to load sidebar rooms:", error)
      })

    return () => {
      active = false
    }
  }, [])

  const roomControlItems = useMemo(() => {
    return [...rooms].sort((left, right) => left.name.localeCompare(right.name))
  }, [rooms])

  const isItemActive = (item: NavItem) => {
    if (!item.to) return false
    if (item.exact) return location.pathname === item.to
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-border-subtle/85 bg-bg-rail/96 text-text-primary backdrop-blur ${
        dragging ? "" : "transition-[width] duration-200"
      }`}
      style={{ width: sidebarWidth }}
      aria-label="主導覽"
    >
      <div className={`flex items-center ${collapsed ? "justify-center px-3 pt-4" : "justify-start px-5 pt-4"}`}>
        {!collapsed ? (
          <div className="font-display text-[2.1rem] font-semibold tracking-[-0.06em] text-msg-primary">
            AweLink XR
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border-subtle/80 bg-bg-panel/90 font-display text-sm font-semibold tracking-[0.16em] text-msg-primary shadow-panel">
            XR
          </div>
        )}
      </div>

      <div className={`${collapsed ? "h-5" : "px-5 pb-5 pt-2"}`}>
        {!collapsed ? <div className="text-sm text-text-secondary">VR console control center</div> : null}
      </div>

      <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-3 pb-4 pt-2" : "px-3 pb-6 pt-2"}`}>
        {sections.map((section) => (
          <div key={section.label} className={`${collapsed ? "space-y-2" : "space-y-2.5"} ${section.label === "System" ? (collapsed ? "mt-4" : "mt-6") : ""}`}>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const active = isItemActive(item)
                return (
                  <div key={item.label} className="space-y-2">
                    <SidebarNavItem
                      label={item.label}
                      caption={item.caption}
                      to={item.to || "/"}
                      icon={item.icon}
                      active={active}
                      collapsed={collapsed}
                      disabled={item.disabled}
                      badge={item.badge}
                    />
                    {!collapsed && item.label === "Groups" && roomControlItems.length > 0 ? (
                      <div className="ml-5 space-y-1.5 border-l border-border-subtle/70 pl-3">
                        {roomControlItems.map((room) => {
                          const roomActive = location.pathname === `/rooms/${room.room_id}/control`
                          return (
                            <Link
                              key={room.room_id}
                              to={`/rooms/${room.room_id}/control`}
                              className={`flex items-center justify-between rounded-[14px] px-3 py-2 text-sm transition ${
                                roomActive
                                  ? "bg-bg-panel text-text-primary shadow-panel"
                                  : "text-text-secondary hover:bg-bg-panel/70 hover:text-text-primary"
                              }`}
                            >
                              <span className="truncate">{room.name}</span>
                              <span className="text-[11px] uppercase tracking-[0.14em] text-text-quiet">
                                Ctrl
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`border-t border-border-subtle/70 ${collapsed ? "px-3 py-4" : "px-5 py-4"}`}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`group flex items-center rounded-full border border-border-subtle/70 bg-bg-panel/78 text-text-secondary transition hover:border-border-subtle hover:bg-bg-shell hover:text-text-primary ${
            collapsed ? "mx-auto h-12 w-12 justify-center" : "h-11 gap-2.5 px-4"
          }`}
          aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
          title={collapsed ? "展開側邊欄" : "收合側邊欄"}
        >
          {collapsed ? <LuPanelLeftOpen className="h-4 w-4" /> : <LuPanelLeftClose className="h-4 w-4" />}
          {!collapsed ? <span className="text-sm font-medium">收合導覽</span> : null}
        </button>
      </div>

      <div
        role="presentation"
        onPointerDown={onResizePointerDown}
        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize ${
          collapsed ? "pointer-events-none opacity-0" : "opacity-40 hover:opacity-100"
        }`}
        style={{ minWidth: 6 }}
        aria-hidden="true"
      />
    </aside>
  )
}
