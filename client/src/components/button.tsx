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
      className={`rounded-lg bg-blue px-2 py-1 hover:bg-blue/80 ${className} disabled:bg-gray disabled:opacity-70`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default Button
