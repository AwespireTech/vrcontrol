import type { ReactNode } from "react"

type QuestPageShellProps = {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl"
}

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
}

export default function QuestPageShell({
  title,
  subtitle,
  eyebrow = "Quest Console",
  actions,
  children,
  maxWidth = "lg",
}: QuestPageShellProps) {
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className={`mx-auto flex w-full flex-col gap-8 ${maxWidthMap[maxWidth]}`}>
        <header className="surface-card p-6 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-foreground/50">
                {eyebrow}
              </div>
              <h1 className="mt-2 text-3xl font-bold text-foreground">{title}</h1>
              {subtitle ? <p className="mt-2 text-sm text-foreground/70">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
