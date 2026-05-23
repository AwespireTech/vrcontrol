import { useEffect, type MouseEvent, type ReactNode } from "react"

type OverlayCardProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  containerClassName?: string
  panelClassName?: string
}

export default function OverlayCard({
  open,
  onClose,
  children,
  containerClassName,
  panelClassName,
}: OverlayCardProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  if (!open) {
    return null
  }

  const handleBackdropClick = () => {
    onClose()
  }

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className={[
          "flex min-h-full p-4 md:p-6",
          containerClassName || "items-center justify-center",
        ].join(" ")}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={[
            "console-control-panel w-full",
            panelClassName || "max-w-lg p-6",
          ].join(" ")}
          onClick={handlePanelClick}
        >
          {children}
        </div>
      </div>
    </div>
  )
}