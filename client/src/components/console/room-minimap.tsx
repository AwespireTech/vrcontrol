import type { RoomMinimapConfig } from "@/lib/room-minimap/config"
import type { RoomMinimapDisplayMarker } from "@/lib/room-minimap/display"
import { getAdbStatusBadgeClass, getWsStatusBadgeClass } from "@/lib/utils/device-status"

type RoomMinimapProps = {
  config: RoomMinimapConfig
  markers: RoomMinimapDisplayMarker[]
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
  title?: string
  subtitle?: string
}

function formatMarkerLabel(marker: RoomMinimapDisplayMarker) {
  return marker.shortLabel
}

function getMarkerColorClass(marker: RoomMinimapDisplayMarker) {
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
  selectedDeviceId,
  onSelectDevice,
  title = "房間平面圖",
  subtitle = "固定 6 x 6 俯視圖，中心點為原點",
}: RoomMinimapProps) {
  const gridColumns = Math.max(1, Math.round(config.width))
  const gridRows = Math.max(1, Math.round(config.depth))
  const readyCount = markers.filter((marker) => marker.readyToMove && !marker.isStale).length
  const staleCount = markers.filter((marker) => marker.isStale).length
  const outOfBoundsCount = markers.filter((marker) => marker.position.isOutOfBounds).length

  return (
    <section className="surface-panel overflow-hidden p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-foreground/55">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-badge ui-badge-muted text-[11px]">{markers.length} 位玩家</span>
          {readyCount > 0 && (
            <span className="ui-badge ui-badge-success text-[11px]">{readyCount} Ready</span>
          )}
          {staleCount > 0 && (
            <span className="ui-badge ui-badge-warning text-[11px]">{staleCount} Stale</span>
          )}
          {outOfBoundsCount > 0 && (
            <span className="ui-badge ui-badge-danger text-[11px]">{outOfBoundsCount} Out</span>
          )}
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
                  const isSelected = selectedDeviceId === marker.deviceId

                  return (
                    <g
                      key={marker.deviceId}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      className="cursor-pointer outline-none"
                      onClick={() => onSelectDevice?.(marker.deviceId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onSelectDevice?.(marker.deviceId)
                        }
                      }}
                    >
                      <title>{`${marker.displayName} (${marker.secondaryLabel})`}</title>
                      {isSelected && (
                        <circle
                          cx={x}
                          cy={y}
                          r="6.1"
                          className="fill-primary/10 stroke-primary"
                          strokeWidth="1.1"
                        />
                      )}
                      {marker.heading && (
                        <line
                          x1={x}
                          y1={y}
                          x2={headingX}
                          y2={headingY}
                          className={
                            isSelected
                              ? "stroke-primary"
                              : marker.isStale
                                ? "stroke-muted/80"
                                : "stroke-foreground/80"
                          }
                          strokeWidth={isSelected ? "1.8" : "1.4"}
                          strokeLinecap="round"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r="2.7"
                        className={`${markerColorClass} ${marker.position.isOutOfBounds ? "opacity-70" : ""}`}
                        strokeWidth={isSelected ? "1.8" : "1.25"}
                      />
                      {marker.position.isOutOfBounds && (
                        <circle
                          cx={x}
                          cy={y}
                          r="4.4"
                          className="fill-transparent stroke-danger/80"
                          strokeWidth="0.9"
                          strokeDasharray="1.2 1.2"
                        />
                      )}
                      {config.display.showPlayerLabels && (
                        <text
                          x={x}
                          y={Math.max(5, y - 4)}
                          textAnchor="middle"
                          className={
                            isSelected
                              ? "fill-primary text-[4px] font-semibold tracking-[0.18em]"
                              : "fill-foreground text-[4px] font-semibold tracking-[0.18em]"
                          }
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
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-dashed border-danger" />
                <span>位置超出 6 x 6 邊界</span>
              </div>
              <div className="text-foreground/50">方向箭頭使用 head_forward 的 x/z 投影。</div>
            </div>
          </div>

          <div className="surface-panel p-3">
            <div className="text-[11px] uppercase tracking-wide text-foreground/45">設備對照</div>
            <div className="mt-2 space-y-2 text-xs text-foreground/70">
              {markers.length === 0 ? (
                <div className="text-foreground/50">等待房間 WebSocket 回傳玩家資料。</div>
              ) : (
                markers.map((marker) => (
                  <button
                    key={marker.deviceId}
                    type="button"
                    aria-pressed={selectedDeviceId === marker.deviceId}
                    onClick={() => onSelectDevice?.(marker.deviceId)}
                    className={`selection-surface w-full rounded-xl px-3 py-2 text-left ${
                      selectedDeviceId === marker.deviceId
                        ? "selection-surface-selected"
                        : "selection-surface-interactive"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{marker.displayName}</div>
                      <div className="truncate font-mono text-[11px] text-foreground/45">
                        {marker.secondaryLabel}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-foreground/50">
                      <div>
                        {marker.position.worldX.toFixed(2)}, {marker.position.worldZ.toFixed(2)}
                      </div>
                        <div>{marker.isStale ? "stale" : marker.readyToMove ? "ready" : "tracking"}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {marker.isStale ? (
                        <span className="ui-badge ui-badge-warning">stale</span>
                      ) : marker.readyToMove ? (
                        <span className="ui-badge ui-badge-success">ready</span>
                      ) : (
                        <span className="ui-badge ui-badge-primary">tracking</span>
                      )}
                      {marker.position.isOutOfBounds && (
                        <span className="ui-badge ui-badge-danger">out of bounds</span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-foreground/55">
                      <div>
                        <span className="text-foreground/40">Chapter</span>
                        <div className="mt-1 text-foreground/75">{marker.chapter}</div>
                      </div>
                      <div>
                        <span className="text-foreground/40">狀態</span>
                        <div className="mt-1 text-foreground/75">{marker.readyText}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`ui-badge ${getAdbStatusBadgeClass(marker.adbStatus)}`}>
                        ADB {marker.adbStatusText}
                      </span>
                      <span className={`ui-badge ${getWsStatusBadgeClass(marker.wsStatus)}`}>
                        WS {marker.wsStatusText}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}