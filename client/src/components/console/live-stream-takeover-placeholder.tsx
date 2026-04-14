type LiveStreamTakeoverPlaceholderProps = {
  title?: string
  description: string
  onFocusPopup: () => void
  onReturnInline: () => void
}

export default function LiveStreamTakeoverPlaceholder({
  title = "即時串流已由外部視窗接管",
  description,
  onFocusPopup,
  onReturnInline,
}: LiveStreamTakeoverPlaceholderProps) {
  return (
    <div className="live-stream-takeover-placeholder">
      <div>
        <div className="live-stream-takeover-placeholder__eyebrow">External Window Active</div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-foreground/65">{description}</p>
      </div>
      <div className="live-stream-takeover-placeholder__actions">
        <button type="button" onClick={onFocusPopup} className="ui-btn ui-btn-sm ui-btn-outline">
          重新聚焦外部視窗
        </button>
        <button type="button" onClick={onReturnInline} className="ui-btn ui-btn-sm ui-btn-primary">
          回到本頁顯示
        </button>
      </div>
    </div>
  )
}