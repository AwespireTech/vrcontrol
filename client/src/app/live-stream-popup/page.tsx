import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import type { LiveStreamLayout } from "@/components/console/live-stream-stage"

export default function LiveStreamPopupPage() {
  const [searchParams] = useSearchParams()
  const initialLayout = searchParams.get("layout") === "stack" ? "stack" : "grid"
  const [layout, setLayout] = useState<LiveStreamLayout>(initialLayout)

  const sourceLabel = useMemo(() => {
    const source = searchParams.get("source")
    const roomId = searchParams.get("roomId")

    if (source === "rooms") {
      return roomId ? `來源房間：${roomId}` : "來源頁面：房間控制"
    }

    if (source === "devices") {
      return "來源頁面：設備管理"
    }

    return "來源頁面：即時串流"
  }, [searchParams])

  return (
    <div className="live-stream-popup-page">
      <div className="live-stream-popup-page__inner">
        <header className="surface-card live-stream-popup-page__hero">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-foreground/50">
              VR Control Console
            </div>
            <h1 className="mt-2 text-3xl font-bold text-foreground">即時串流外部視窗</h1>
            <p className="mt-2 text-sm text-foreground/70">
              目前為 MVP 骨架模式，下一批會接上主頁即時串流資料同步。
            </p>
          </div>
          <div className="live-stream-popup-page__hero-actions">
            <span className="ui-badge ui-badge-primary">MVP 骨架</span>
            <button type="button" onClick={() => window.close()} className="ui-btn ui-btn-sm ui-btn-muted">
              關閉視窗
            </button>
          </div>
        </header>

        <section className="surface-card p-4 md:p-6">
          <div className="live-stream-section__header">
            <div>
              <h2 className="text-xl font-bold text-foreground">即時串流</h2>
              <p className="text-sm text-foreground/60">{sourceLabel}</p>
            </div>
            <div className="live-stream-section__toolbar">
              <span className="ui-badge ui-badge-muted">尚未接收資料</span>
              <div className="live-stream-layout-toggle" role="group" aria-label="即時串流排版">
                <button
                  type="button"
                  onClick={() => setLayout("stack")}
                  className={`ui-btn ui-btn-xs ${layout === "stack" ? "ui-btn-primary" : "ui-btn-muted"}`}
                >
                  堆疊
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("grid")}
                  className={`ui-btn ui-btn-xs ${layout === "grid" ? "ui-btn-primary" : "ui-btn-muted"}`}
                >
                  網格
                </button>
              </div>
            </div>
          </div>

          <div className="live-stream-popup-notice">
            新視窗已可正常開啟。下一批會把主頁的即時串流清單與版型同步到這裡。
          </div>

          <div className="live-stream-empty-state">
            目前尚未接收即時串流資料。請回到主頁繼續操作，下一批將接上跨視窗同步。
          </div>
        </section>
      </div>
    </div>
  )
}