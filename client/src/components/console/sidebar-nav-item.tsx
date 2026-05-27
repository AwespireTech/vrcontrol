import { Link } from "react-router-dom"
import type { IconType } from "react-icons"

type SidebarNavItemProps = {
  label: string
  caption: string
  to?: string
  icon: IconType
  active: boolean
  collapsed: boolean
  disabled?: boolean
  badge?: string
}

export default function SidebarNavItem({
  label,
  caption,
  to,
  icon: Icon,
  active,
  collapsed,
  disabled,
  badge,
}: SidebarNavItemProps) {
  const itemClassName = [
    "console-sidebar-item group",
    collapsed
      ? "console-sidebar-item--collapsed"
      : "console-sidebar-item--expanded",
    active ? "console-sidebar-item--active" : "console-sidebar-item--idle",
    disabled ? "cursor-not-allowed overflow-hidden opacity-70" : "overflow-hidden",
  ]
    .filter(Boolean)
    .join(" ")

  const labelClassName = [
    "console-sidebar-item__label-wrap",
    collapsed ? "max-w-0 opacity-0" : "max-w-[220px] opacity-100",
  ].join(" ")

  const combinedLabel = `${label} ${caption}`
  const body = (
    <>
      <span className="console-sidebar-item__icon">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className={labelClassName}>
        {badge ? (
          <span className="flex items-center justify-between gap-3">
            <span className="console-sidebar-item__text">{combinedLabel}</span>
            <span className="ui-badge ui-badge-muted">{badge}</span>
          </span>
        ) : (
          <span className="console-sidebar-item__text">{combinedLabel}</span>
        )}
      </span>
    </>
  )

  if (disabled || !to) {
    return <div className={itemClassName}>{body}</div>
  }

  return (
    <Link to={to || "/"} className={itemClassName} title={collapsed ? combinedLabel : label}>
      {body}
    </Link>
  )
}