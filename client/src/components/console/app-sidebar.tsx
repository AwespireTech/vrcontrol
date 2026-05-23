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
    `group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition duration-200 ${
      active
        ? "bg-msg-primary/16 text-text-primary shadow-[inset_0_0_0_1px_rgba(109,125,228,0.36)] shadow-active"
        : "text-text-secondary hover:bg-bg-panel/86 hover:text-text-primary"
    }`

  const labelClass = `flex-1 overflow-hidden transition-all duration-200 ${
    collapsed ? "max-w-0 opacity-0" : "max-w-[220px] opacity-100"
  }`

  return (
    <aside
      className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-border-subtle/85 bg-bg-shell/94 text-text-primary backdrop-blur ${
        dragging ? "" : "transition-[width] duration-200"
      }`}
      style={{ width: sidebarWidth }}
      aria-label="主導覽"
    >
      <div className="flex h-16 items-center justify-start px-4 pt-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-text-secondary transition hover:border-border-subtle hover:bg-bg-panel/85 hover:text-text-primary"
          aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
          title={collapsed ? "展開側邊欄" : "收合側邊欄"}
        >
          {collapsed ? <LuPanelLeftOpen className="h-4 w-4" /> : <LuPanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 pb-6 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border-subtle/90 bg-bg-panel/90 text-base font-semibold tracking-[0.18em] text-msg-primary shadow-panel">
            VR
          </div>
          <div
            className={`overflow-hidden transition-[opacity,width] duration-200 ${
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}
          >
            <div className="whitespace-nowrap text-xs uppercase leading-none tracking-[0.26em] text-text-muted">
              VR Control
            </div>
            <div className="mt-1 whitespace-nowrap font-display text-[1.65rem] font-semibold leading-none tracking-[-0.05em] text-msg-primary">
              Console
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {sections.map((section) => (
          <div key={section.label} className="space-y-2">
            <div
              className={`px-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-text-quiet transition-opacity duration-200 ${
                collapsed ? "opacity-0" : "opacity-100"
              }`}
            >
              {section.label}
            </div>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const active = isItemActive(item)
                const sharedClass = getItemClass(active)
                const Icon = item.icon

                if (item.disabled) {
                  return (
                    <div key={item.label} className={`${sharedClass} cursor-not-allowed overflow-hidden opacity-70`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-panel/80 text-text-secondary transition group-hover:text-text-primary">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className={labelClass}>
                        <span className="flex items-center justify-between gap-3">
                          <span>
                            <span className="block whitespace-nowrap font-semibold leading-none text-text-primary">
                              {item.label}
                            </span>
                            <span className="mt-1 block whitespace-nowrap text-[11px] leading-none text-text-muted">
                              {item.caption}
                            </span>
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
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        active ? "bg-msg-primary/14 text-msg-primary" : "bg-bg-panel/75 text-text-secondary group-hover:text-text-primary"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className={labelClass}>
                      <span className="block whitespace-nowrap font-semibold leading-none text-current">
                        {item.label}
                      </span>
                      <span className="mt-1 block whitespace-nowrap text-[11px] leading-none text-text-muted">
                        {item.caption}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={`px-4 pb-6 transition-[opacity,height] duration-200 ${
          collapsed ? "h-0 overflow-hidden opacity-0" : "opacity-100"
        }`}
      >
        <div className="rounded-[22px] border border-border-subtle/85 bg-bg-panel/82 p-4 shadow-panel">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-text-muted">
            Phase 1
          </div>
          <div className="mt-2 font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">
            Shared System
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            先完成共用視覺骨架，再逐步套用到各頁面。
          </p>
        </div>
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
