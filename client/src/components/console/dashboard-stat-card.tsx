import type { IconType } from "react-icons"

type DashboardStatCardProps = {
  label: string
  value: number | string
  icon: IconType
  tone?: "default" | "primary"
}

export default function DashboardStatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: DashboardStatCardProps) {
  return (
    <div className="console-stat-card">
      <p className="console-stat-card__label">{label}</p>
      <div className="console-stat-card__body">
        <div
          className={`console-stat-card__icon ${
            tone === "primary"
              ? "console-stat-card__icon--primary"
              : "console-stat-card__icon--default"
          }`}
        >
          <Icon className="h-7 w-7" />
        </div>
        <p className="console-stat-card__value">{value}</p>
      </div>
    </div>
  )
}