import QuestDeviceSelectionModal, {
  type QuestDeviceSelectionTarget,
} from "@/components/quest/quest-device-selection-modal"

// Backward-compatible alias (legacy name)
export type QuestActionExecuteTarget = QuestDeviceSelectionTarget

// Backward-compatible wrapper (legacy component)
export default function QuestActionExecuteModal({
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
  targets: QuestActionExecuteTarget[]
  selectedIds: string[]
  onSelectedIdsChange: (next: string[]) => void
  confirmPending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <QuestDeviceSelectionModal
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
