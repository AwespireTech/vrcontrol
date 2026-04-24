import type { ButtonHTMLAttributes } from "react"

export const Button = ({
  className,
  disabled,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}) => {
  return (
    <button
      className={`ui-btn ui-btn-sm ui-btn-primary inline-flex items-center justify-center gap-2 ${className ?? ""}`}
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
