import { useMemo } from "react"
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
      { label: "Groups", caption: "群組 / 房間", to: "/rooms", icon: LuHouse },
      { label: "Actions", caption: "動作", to: "/actions", icon: LuSparkles },
      { label: "Monitor", caption: "監控", to: "/monitoring", icon: LuMonitorPlay },
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

  const sidebarWidth = collapsed ? collapsedWidth : width

  const isItemActive = (item: NavItem) => {
    if (!item.to) return false
    if (item.exact) return location.pathname === item.to
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

  const getItemClass = (active: boolean) =>
    `group flex items-center rounded-[18px] border text-sm transition duration-200 ${
      collapsed
        ? "mx-auto min-h-14 w-14 justify-center px-0 py-3"
        : "min-h-13 gap-3.5 px-4 py-3"
    } ${
      active
        ? "border-transparent bg-bg-elevated text-text-primary shadow-[inset_0_0_0_1px_rgba(109,125,228,0.24)] shadow-active"
        : "border-transparent text-text-secondary hover:bg-bg-panel/86 hover:text-text-primary"
    }`

  const labelClass = `flex-1 overflow-hidden transition-all duration-200 ${
    collapsed ? "max-w-0 opacity-0" : "max-w-[220px] opacity-100"
  }`

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
                const sharedClass = getItemClass(active)
                const Icon = item.icon
                const combinedLabel = `${item.label} ${item.caption}`

                if (item.disabled) {
                  return (
                    <div key={item.label} className={`${sharedClass} cursor-not-allowed overflow-hidden opacity-70`}>
                      <span className="flex items-center justify-center text-current transition group-hover:text-text-primary">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className={labelClass}>
                        <span className="flex items-center justify-between gap-3">
                          <span className="block whitespace-nowrap font-semibold leading-none text-text-primary">
                            {combinedLabel}
                          </span>
                          {item.badge ? <span className="ui-badge ui-badge-muted">{item.badge}</span> : null}
                        </span>
                      </span>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.label}
                    to={item.to || "/"}
                    className={`${sharedClass} overflow-hidden`}
                    title={collapsed ? `${item.label} ${item.caption}` : item.label}
                  >
                    <span className="flex items-center justify-center text-current transition group-hover:text-text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className={labelClass}>
                      <span className="block whitespace-nowrap font-semibold leading-none text-current">
                        {combinedLabel}
                      </span>
                    </span>
                  </Link>
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
