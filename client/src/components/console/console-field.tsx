import type { ReactNode } from "react"

type ConsoleFieldProps = {
  label: ReactNode
  htmlFor?: string
  className?: string
  labelClassName?: string
  children: ReactNode
}

export default function ConsoleField({
  label,
  htmlFor,
  className,
  labelClassName,
  children,
}: ConsoleFieldProps) {
  const wrapperClassName = ["console-field", className].filter(Boolean).join(" ")
  const mergedLabelClassName = ["console-field__label", labelClassName].filter(Boolean).join(" ")

  return (
    <div className={wrapperClassName}>
      <label htmlFor={htmlFor} className={mergedLabelClassName}>
        {label}
      </label>
      {children}
    </div>
  )
}