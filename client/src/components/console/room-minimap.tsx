import type { RoomMinimapConfig } from "@/lib/room-minimap/config"
import type { RoomMinimapMarker } from "@/lib/room-minimap/mappers"

type RoomMinimapProps = {
  config: RoomMinimapConfig
  markers: RoomMinimapMarker[]
  title?: string
  subtitle?: string
}

function formatMarkerLabel(marker: RoomMinimapMarker) {
  if (marker.sequence > 0) {
    return `P${marker.sequence}`
  }

  return marker.deviceId.slice(-4).toUpperCase()
}

function getMarkerColorClass(marker: RoomMinimapMarker) {
  if (marker.isStale) {
    return "fill-muted stroke-border/70"
  }

  if (marker.readyToMove) {
    return "fill-success stroke-success"
  }

  return "fill-primary stroke-primary"
}

export default function RoomMinimap({
  config,
  markers,
  title = "房間平面圖",
  subtitle = "固定 6 x 6 俯視圖，中心點為原點",
}: RoomMinimapProps) {
  const gridColumns = Math.max(1, Math.round(config.width))
  const gridRows = Math.max(1, Math.round(config.depth))

  return (
    <section className="surface-panel overflow-hidden p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-foreground/55">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="ui-badge ui-badge-muted text-[11px]">{markers.length} 位玩家</span>
          <span className="ui-badge ui-badge-primary text-[11px]">
            Origin ({config.origin.x}, {config.origin.z})
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="surface-panel relative overflow-hidden border border-border/60 bg-background/30 p-3">
          <div className="aspect-square w-full">
            {markers.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/20 p-6 text-center text-sm text-foreground/55">
                目前沒有玩家座標資料。
              </div>
            ) : (
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <defs>
                  <linearGradient id="roomMinimapGlow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(96,165,250,0.16)" />
                    <stop offset="100%" stopColor="rgba(158,116,255,0.04)" />
                  </linearGradient>
                </defs>

                <rect x="0" y="0" width="100" height="100" rx="10" fill="url(#roomMinimapGlow)" />

                {config.display.showGrid &&
                  Array.from({ length: gridColumns - 1 }, (_, index) => {
                    const x = ((index + 1) * 100) / gridColumns
                    return (
                      <line
                        key={`grid-x-${index}`}
                        x1={x}
                        y1="0"
                        x2={x}
                        y2="100"
                        className="stroke-border/25"
                        strokeWidth="0.5"
                      />
                    )
                  })}

                {config.display.showGrid &&
                  Array.from({ length: gridRows - 1 }, (_, index) => {
                    const y = ((index + 1) * 100) / gridRows
                    return (
                      <line
                        key={`grid-y-${index}`}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        className="stroke-border/25"
                        strokeWidth="0.5"
                      />
                    )
                  })}

                {config.display.showCenterCrosshair && (
                  <>
                    <line
                      x1="50"
                      y1="0"
                      x2="50"
                      y2="100"
                      className="stroke-accent/50"
                      strokeWidth="0.75"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="0"
                      y1="50"
                      x2="100"
                      y2="50"
                      className="stroke-accent/50"
                      strokeWidth="0.75"
                      strokeDasharray="2 2"
                    />
                  </>
                )}

                <rect
                  x="0.75"
                  y="0.75"
                  width="98.5"
                  height="98.5"
                  rx="10"
                  className="fill-transparent stroke-border/70"
                  strokeWidth="1.5"
                />

                {markers.map((marker) => {
                  const x = marker.position.normalizedX * 100
                  const y = marker.position.normalizedY * 100
                  const headingX = marker.heading ? x + marker.heading.dx * 100 : x
                  const headingY = marker.heading ? y + marker.heading.dy * 100 : y
                  const markerColorClass = getMarkerColorClass(marker)
                  const label = formatMarkerLabel(marker)

                  return (
                    <g key={marker.deviceId}>
                      {marker.heading && (
                        <line
                          x1={x}
                          y1={y}
                          x2={headingX}
                          y2={headingY}
                          className={marker.isStale ? "stroke-muted/80" : "stroke-foreground/80"}
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r="2.7"
                        className={`${markerColorClass} ${marker.position.isOutOfBounds ? "opacity-70" : ""}`}
                        strokeWidth="1.25"
                      />
                      {config.display.showPlayerLabels && (
                        <text
                          x={x}
                          y={Math.max(5, y - 4)}
                          textAnchor="middle"
                          className="fill-foreground text-[4px] font-semibold tracking-[0.18em]"
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="surface-panel p-3">
            <div className="text-[11px] uppercase tracking-wide text-foreground/45">說明</div>
            <div className="mt-2 space-y-2 text-xs text-foreground/70">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span>玩家在線</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                <span>Ready to move</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                <span>資料過舊</span>
              </div>
              <div className="text-foreground/50">方向箭頭使用 head_forward 的 x/z 投影。</div>
            </div>
          </div>

          <div className="surface-panel p-3">
            <div className="text-[11px] uppercase tracking-wide text-foreground/45">玩家摘要</div>
            <div className="mt-2 space-y-2 text-xs text-foreground/70">
              {markers.length === 0 ? (
                <div className="text-foreground/50">等待房間 WebSocket 回傳玩家資料。</div>
              ) : (
                markers.map((marker) => (
                  <div key={marker.deviceId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{formatMarkerLabel(marker)}</div>
                      <div className="truncate font-mono text-[11px] text-foreground/45">
                        {marker.deviceId}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-foreground/50">
                      <div>
                        {marker.position.worldX.toFixed(2)}, {marker.position.worldZ.toFixed(2)}
                      </div>
                      <div>{marker.isStale ? "stale" : marker.readyToMove ? "ready" : "tracking"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}