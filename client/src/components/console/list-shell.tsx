import type { ReactNode } from "react"

type ListShellProps = {
  title: string
  description?: string
  toolbar?: ReactNode
  columns?: ReactNode
  actionsAlign?: "start" | "end"
  emptyState?: ReactNode
  children?: ReactNode
  variant?: "default" | "ghost"
}

export default function ListShell({
  title,
  description,
  toolbar,
  columns,
  actionsAlign = "end",
  emptyState,
  children,
  variant = "default",
}: ListShellProps) {
  const shellClassName =
    variant === "ghost" ? "console-list-shell console-list-shell--ghost" : "console-list-shell"

  return (
    <section className="console-section">
      <div className="console-section__heading">
        <div>
          <h2 className="console-section__title">{title}</h2>
          {description ? <p className="console-section__description mt-1">{description}</p> : null}
        </div>
        {toolbar ? (
          <div className={`console-toolbar ${actionsAlign === "end" ? "justify-end" : "justify-start"}`}>
            {toolbar}
          </div>
        ) : null}
      </div>

      <div className={shellClassName}>
        {columns ? <div className="console-list-header">{columns}</div> : null}
        {children ? children : emptyState ? <div className="p-5">{emptyState}</div> : null}
      </div>
    </section>
  )
}