import DeviceSelectionModal, {
  type DeviceSelectionTarget,
} from "@/components/console/device-selection-modal"

export type ActionExecuteTarget = DeviceSelectionTarget

export default function ActionExecuteModal({
  open,
  actionName,
  targets,
  selectedIds,
  onSelectedIdsChange,
  confirmPending,
  onConfirm,
  onClose,
}: {
  open: boolean
  actionName: string
  targets: ActionExecuteTarget[]
  selectedIds: string[]
  onSelectedIdsChange: (next: string[]) => void
  confirmPending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <DeviceSelectionModal
      open={open}
      title={`執行動作: ${actionName}`}
      confirmText="執行"
      targets={targets}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      confirmPending={confirmPending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
