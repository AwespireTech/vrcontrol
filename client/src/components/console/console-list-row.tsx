import type { ReactNode } from "react"

type ConsoleListRowProps = {
  children: ReactNode
  className?: string
  variant?: "default" | "compact"
}

export default function ConsoleListRow({
  children,
  className,
  variant = "default",
}: ConsoleListRowProps) {
  const mergedClassName = [
    "console-list-row",
    variant === "compact" ? "console-list-row--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return <div className={mergedClassName}>{children}</div>
}