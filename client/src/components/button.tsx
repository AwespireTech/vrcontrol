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
      className={`rounded-lg bg-primary px-2 py-1 text-foreground hover:bg-primary/80 ${className} disabled:bg-muted disabled:opacity-70`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default Button
