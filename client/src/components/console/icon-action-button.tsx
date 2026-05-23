import type { ButtonHTMLAttributes, ReactNode } from "react"

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  danger?: boolean
  loading?: boolean
}

export default function IconActionButton({
  className,
  type,
  disabled,
  loading,
  danger,
  children,
  ...props
}: IconActionButtonProps) {
  const mergedClassName = [
    "console-icon-button",
    danger ? "console-icon-button--danger" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <button
      type={type ?? "button"}
      className={mergedClassName}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : children}
    </button>
  )
}