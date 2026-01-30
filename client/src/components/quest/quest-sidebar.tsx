import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

type NavItem = {
  label: string
  to?: string
  icon: string
  exact?: boolean
}

const buildItems = (): NavItem[] => [
  { label: 'Quest 總覽', to: '/quest', icon: '🧭', exact: true },
  { label: '設備', to: '/quest/devices', icon: '📱' },
  { label: '房間', to: '/quest/rooms', icon: '🏠' },
  { label: '動作', to: '/quest/actions', icon: '⚡' },
  { label: '監控', to: '/quest/monitoring', icon: '🛰️' },
  { label: '設定', to: '/quest/settings', icon: '⚙️' },
]

type QuestSidebarProps = {
  width: number
  collapsedWidth: number
  collapsed: boolean
  dragging: boolean
  onToggleCollapsed: () => void
  onResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}

export default function QuestSidebar({
  width,
  collapsedWidth,
  collapsed,
  dragging,
  onToggleCollapsed,
  onResizePointerDown,
}: QuestSidebarProps) {
  const location = useLocation()
  const items = useMemo(buildItems, [])

  const sidebarWidth = collapsed ? collapsedWidth : width

  const isItemActive = (item: NavItem) => {
    if (!item.to) return false
    if (item.exact) return location.pathname === item.to
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

  const getItemClass = (active: boolean) =>
    `flex h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
      active
        ? 'bg-primary/15 text-foreground shadow-[0_0_0_1px_rgba(99,102,241,0.25)]'
        : 'text-foreground/80 hover:bg-muted/40 hover:text-foreground'
    }`

  const labelClass = `flex-1 overflow-hidden transition-opacity duration-200 ${
    collapsed ? 'opacity-0' : 'opacity-100'
  }`

  return (
    <aside
      className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-border bg-surface/80 text-foreground backdrop-blur ${
        dragging ? '' : 'transition-[width] duration-200'
      }`}
      style={{ width: sidebarWidth }}
      aria-label="Quest 導覽"
    >
      <div className="flex h-14 items-center justify-start px-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="group flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-foreground/80 transition hover:bg-muted/30"
          aria-label={collapsed ? '展開側邊欄' : '收合側邊欄'}
          title={collapsed ? '展開側邊欄' : '收合側邊欄'}
        >
          <span className="relative flex h-4 w-5 items-center justify-center">
            <span
              className={`absolute h-0.5 w-full rounded-full bg-current transition-transform duration-200 ${
                collapsed ? '-translate-y-2' : 'rotate-45'
              }`}
            />
            <span
              className={`absolute h-0.5 w-full rounded-full bg-current transition-opacity duration-200 ${
                collapsed ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <span
              className={`absolute h-0.5 w-full rounded-full bg-current transition-transform duration-200 ${
                collapsed ? 'translate-y-2' : '-rotate-45'
              }`}
            />
          </span>
        </button>
      </div>

      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-2xl">
            🧩
          </div>
          <div
            className={`overflow-hidden transition-[opacity,width] duration-200 ${
              collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
            }`}
          >
            <div className="whitespace-nowrap text-sm uppercase tracking-[0.2em] text-foreground/50 leading-none">Quest</div>
            <div className="whitespace-nowrap text-lg font-semibold text-foreground leading-none">控制中樞</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {items.map((item) => {
          const active = isItemActive(item)
          const sharedClass = getItemClass(active)

          return (
            <Link
              key={item.label}
              to={item.to || '/quest'}
              className={`${sharedClass} overflow-hidden`}
              title={item.label}
            >
              <span className="text-lg">{item.icon}</span>
              <span className={labelClass}>
                <span className="block whitespace-nowrap leading-none">{item.label}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <nav className="px-3 pb-6">
        <Link
          to="/"
          className={`${getItemClass(location.pathname === '/')} overflow-hidden`}
          title="返回首頁"
        >
          <span className="text-lg">🏠</span>
          <span className={labelClass}>
            <span className="block whitespace-nowrap leading-none">返回首頁</span>
          </span>
        </Link>
      </nav>

      <div
        role="presentation"
        onPointerDown={onResizePointerDown}
        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize ${
          collapsed ? 'opacity-0 pointer-events-none' : 'opacity-40 hover:opacity-100'
        }`}
        style={{ minWidth: 6 }}
        aria-hidden="true"
      />
    </aside>
  )
}
