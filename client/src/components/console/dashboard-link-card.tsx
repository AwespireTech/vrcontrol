import type { IconType } from "react-icons"
import { Link } from "react-router-dom"
import { LuArrowRight } from "react-icons/lu"

type DashboardLinkCardProps = {
  to: string
  title: string
  subtitle: string
  description: string
  icon: IconType
}

export default function DashboardLinkCard({
  to,
  title,
  subtitle,
  description,
  icon: Icon,
}: DashboardLinkCardProps) {
  return (
    <Link to={to} className="console-link-card group">
      <div className="console-link-card__layout">
        <div className="console-link-card__header">
          <div className="console-link-card__icon">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="console-link-card__title">{title}</p>
            <p className="console-link-card__subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="console-link-card__footer">
          <p className="console-link-card__description">{description}</p>
          <LuArrowRight className="console-link-card__arrow" />
        </div>
      </div>
    </Link>
  )
}