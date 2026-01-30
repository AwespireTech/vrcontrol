import dayjs from "dayjs"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"

import { PlayerData } from "../interfaces/room.interface"
import { useState } from "react"
import Button from "./button"

const PlayerInfo = ({
  player,
  handleChangeSequence,
  displayName,
  adbStatus,
  sequenceLoading,
}: {
  player: PlayerData
  handleChangeSequence: (player: string, seq: number) => void
  displayName?: string
  adbStatus?: "online" | "offline" | "connecting" | "error" | "disconnected"
  sequenceLoading?: boolean
}) => {
  dayjs.extend(isSameOrBefore)

  const [numberInput, setNumberInput] = useState(player.sequence)

  const lastUpdateTime = dayjs(player.last_update)

  const currTime = dayjs()

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setNumberInput(isNaN(value) ? 0 : value)
  }

  const isStale = lastUpdateTime.isSameOrBefore(currTime.subtract(5, "second"))

  return (
    <div
      className="px-4 py-3"
      aria-label={`${displayName || player.device_id} 玩家資訊`}
      data-adb-status={adbStatus || "unknown"}
    >
      <div className="grid grid-cols-1 gap-4 text-xs text-foreground/70 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-foreground/50">玩家狀態</div>
          <div className="mt-1 flex items-center leading-5">
            <span
              className={`ui-badge ${player.ready_to_move ? "ui-badge-success" : "ui-badge-muted"}`}
            >
              {player.ready_to_move ? "Ready" : "Not Ready"}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-foreground/50">Chapter</div>
          <div className="mt-1 text-sm font-semibold leading-5 text-foreground">
            {player.chapter}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-foreground/50">Sequence</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{player.sequence}</span>
            <span className="text-foreground/40">→</span>
            <input
              type="number"
              className="ui-input w-14 px-2 py-1 text-xs"
              value={numberInput}
              onChange={handleNumberChange}
              min={0}
            />
            <Button
              className="ml-1"
              loading={sequenceLoading}
              onClick={() => handleChangeSequence(player.device_id, numberInput)}
            >
              指派
            </Button>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-foreground/50">
            Head Position
          </div>
          <div className="mt-1 font-mono leading-5 text-foreground/70">
            ({player.head_position.x}, {player.head_position.y}, {player.head_position.z})
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-foreground/50">最後更新</div>
          <div
            className={`mt-1 leading-5 ${isStale ? "font-semibold text-danger" : "text-foreground/60"}`}
          >
            {lastUpdateTime.format("YYYY/MM/DD HH:mm:ss")}
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <div className="text-[11px] uppercase tracking-wide text-foreground/50">Message</div>
          <div className="mt-1 text-foreground/80">{player.message || "—"}</div>
        </div>
      </div>
    </div>
  )
}

export default PlayerInfo
