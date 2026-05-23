import type { ReactNode } from "react"

type PageShellProps = {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl"
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
}: PageShellProps) {
  return (
    <div className="console-page">
      <div className={`console-page__inner ${maxWidthMap[maxWidth]}`}>
        <header className="console-page__header">
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="console-page__eyebrow">{eyebrow}</div>
              <h1 className="console-page__title mt-3">{title}</h1>
              {subtitle ? <p className="console-page__subtitle mt-3">{subtitle}</p> : null}
            </div>
            {actions ? <div className="console-toolbar xl:justify-end">{actions}</div> : null}
          </div>
        </header>
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </div>
  )
}
