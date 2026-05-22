import type { ButtonHTMLAttributes } from "react"

const SIZE_CLASS_PATTERN = /\bui-btn-(xs|sm|md|lg)\b/
const VARIANT_CLASS_PATTERN = /\bui-btn-(primary|danger|accent|outline|muted|success|warning)\b/

export const Button = ({
  className,
  type,
  disabled,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}) => {
  const mergedClassName = [
    "ui-btn",
    SIZE_CLASS_PATTERN.test(className ?? "") ? "" : "ui-btn-sm",
    VARIANT_CLASS_PATTERN.test(className ?? "") ? "" : "ui-btn-primary",
    "inline-flex items-center justify-center gap-2",
    className ?? "",
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
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      <span className={loading ? "opacity-80" : ""}>{children}</span>
    </button>
  )
}

export default Button
