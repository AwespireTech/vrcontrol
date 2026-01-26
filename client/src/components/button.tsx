export const Button = ({
  className,
  disabled,
  onClick,
  children,
}: {
  className?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) => {
  return (
    <button
      className={`ui-btn ui-btn-sm ui-btn-primary ${className ?? ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default Button
