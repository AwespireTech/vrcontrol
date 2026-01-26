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
      className={`rounded-full bg-primary px-3 py-1 text-sm text-foreground transition hover:bg-primary/80 ${className} disabled:bg-muted disabled:opacity-70`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default Button
