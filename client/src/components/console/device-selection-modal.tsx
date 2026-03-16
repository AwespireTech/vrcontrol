import Button from "@/components/button"

export type DeviceSelectionTarget = {
  id: string
  label: string
  ip?: string
  status?: string
  isOnline: boolean
}

export default function DeviceSelectionModal({
  open,
  title,
  confirmText,
  targets,
  selectedIds,
  onSelectedIdsChange,
  confirmPending,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  confirmText: string
  targets: DeviceSelectionTarget[]
  selectedIds: string[]
  onSelectedIdsChange: (next: string[]) => void
  confirmPending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null

  const toggleSelection = (id: string) => {
    onSelectedIdsChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    )
  }

  const selectAllOnline = () => {
    onSelectedIdsChange(targets.filter((t) => t.isOnline).map((t) => t.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="surface-card mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6">
        <h2 className="mb-4 text-2xl font-bold text-foreground">{title}</h2>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              選擇設備 ({selectedIds.length} 個已選)
            </p>
            <button onClick={selectAllOnline} className="text-sm text-primary hover:text-primary/80">
              全選在線設備
            </button>
          </div>

          <div className="surface-panel max-h-60 space-y-2 overflow-y-auto p-2">
            {targets.map((target) => (
              <label
                key={target.id}
                className={`flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-surface ${
                  !target.isOnline ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(target.id)}
                  onChange={() => toggleSelection(target.id)}
                  disabled={!target.isOnline}
                  className="h-4 w-4"
                />
                <span className="flex-1 text-sm text-foreground">
                  {target.label} ({target.ip || "—"})
                </span>
                <span
                  className={`ui-badge ${target.isOnline ? "ui-badge-success" : "ui-badge-muted"}`}
                >
                  {target.status || "unknown"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="ui-btn ui-btn-md ui-btn-muted">
            取消
          </button>
          <Button
            onClick={onConfirm}
            disabled={selectedIds.length === 0 || confirmPending}
            loading={confirmPending}
            className="ui-btn-md ui-btn-primary"
          >
            {confirmText} ({selectedIds.length} 個設備)
          </Button>
        </div>
      </div>
    </div>
  )
}
