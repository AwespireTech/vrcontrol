import { Link } from "react-router-dom"
import type { IconType } from "react-icons"
import { LuChevronDown } from "react-icons/lu"

type SidebarNavItemProps = {
  label: string
  caption: string
  to?: string
  icon: IconType
  active: boolean
  collapsed: boolean
  disabled?: boolean
  badge?: string
  expandable?: boolean
  expanded?: boolean
  onClick?: () => void
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
  expandable,
  expanded,
  onClick,
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
          <span className="flex items-center justify-between gap-3">
            <span className="console-sidebar-item__text">{combinedLabel}</span>
            {expandable && !collapsed ? (
              <LuChevronDown
                className={`h-4 w-4 shrink-0 text-text-quiet transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            ) : null}
          </span>
        )}
      </span>
    </>
  )

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        className={itemClassName}
        title={collapsed ? combinedLabel : label}
        onClick={onClick}
        aria-expanded={expandable ? expanded : undefined}
      >
        {body}
      </button>
    )
  }

  if (disabled || !to) {
    return <div className={itemClassName}>{body}</div>
  }

  return (
    <Link to={to || "/"} className={itemClassName} title={collapsed ? combinedLabel : label}>
      {body}
    </Link>
  )
}