import type { ReactNode } from "react"

type PageShellProps = {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl"
  headerVariant?: "card" | "plain"
  titleVariant?: "default" | "compact"
}

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-[1400px]",
}

export default function PageShell({
  title,
  subtitle,
  eyebrow = "VR Control Console",
  actions,
  children,
  maxWidth = "lg",
  headerVariant = "card",
  titleVariant = "default",
}: PageShellProps) {
  const headerClassName =
    headerVariant === "plain"
      ? `relative flex flex-col ${titleVariant === "compact" ? "gap-3 px-1 py-1" : "gap-4 px-1 py-2"} xl:flex-row xl:items-end xl:justify-between`
      : "console-page__header"

  const contentClassName = "relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
  const titleClassName =
    titleVariant === "compact"
      ? eyebrow
        ? "console-page__title console-page__title--compact mt-2"
        : "console-page__title console-page__title--compact"
      : eyebrow
        ? "console-page__title mt-3"
        : "console-page__title"
  const subtitleClassName =
    titleVariant === "compact"
      ? "console-page__subtitle console-page__subtitle--compact mt-1.5"
      : "console-page__subtitle mt-2"

  return (
    <div className="console-page">
      <div className={`console-page__inner ${maxWidthMap[maxWidth]}`}>
        <header className={headerClassName}>
          <div className={contentClassName}>
            <div>
              {eyebrow ? <div className="console-page__eyebrow">{eyebrow}</div> : null}
              <h1 className={titleClassName}>{title}</h1>
              {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
            </div>
            {actions ? <div className="console-toolbar xl:justify-end">{actions}</div> : null}
          </div>
        </header>
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </div>
  )
}
