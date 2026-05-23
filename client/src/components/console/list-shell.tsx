import type { ReactNode } from "react"

type ListShellProps = {
  title: string
  description?: string
  toolbar?: ReactNode
  columns?: ReactNode
  className?: string
  shellClassName?: string
  headerClassName?: string
  headerVariant?: "default" | "compact"
  headingVariant?: "default" | "compact"
  actionsAlign?: "start" | "end"
  emptyState?: ReactNode
  children?: ReactNode
  variant?: "default" | "ghost" | "compact"
}

export default function ListShell({
  title,
  description,
  toolbar,
  columns,
  className,
  shellClassName,
  headerClassName,
  headerVariant = "default",
  headingVariant = "default",
  actionsAlign = "end",
  emptyState,
  children,
  variant = "default",
}: ListShellProps) {
  const defaultShellClassName =
    variant === "ghost"
      ? "console-list-shell console-list-shell--ghost"
      : variant === "compact"
        ? "console-list-shell console-list-shell--compact"
        : "console-list-shell"
  const defaultHeaderClassName =
    headerVariant === "compact"
      ? "console-list-header console-list-header--compact"
      : "console-list-header"
  const mergedSectionClassName = ["console-section", className].filter(Boolean).join(" ")
  const mergedShellClassName = [defaultShellClassName, shellClassName].filter(Boolean).join(" ")
  const mergedHeaderClassName = [defaultHeaderClassName, headerClassName].filter(Boolean).join(" ")
  const titleClassName =
    headingVariant === "compact"
      ? "console-section__title console-section__title--compact"
      : "console-section__title"
  const descriptionClassName =
    headingVariant === "compact"
      ? "console-section__description console-section__description--compact mt-1"
      : "console-section__description mt-1"

  return (
    <section className={mergedSectionClassName}>
      <div className="console-section__heading">
        <div>
          <h2 className={titleClassName}>{title}</h2>
          {description ? <p className={descriptionClassName}>{description}</p> : null}
        </div>
        {toolbar ? (
          <div className={`console-toolbar ${actionsAlign === "end" ? "justify-end" : "justify-start"}`}>
            {toolbar}
          </div>
        ) : null}
      </div>

      <div className={mergedShellClassName}>
        {columns ? <div className={mergedHeaderClassName}>{columns}</div> : null}
        {children ? children : emptyState ? <div className="p-5">{emptyState}</div> : null}
      </div>
    </section>
  )
}