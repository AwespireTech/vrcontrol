import dayjs from "dayjs"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"

import { PlayerData } from "../interfaces/room.interface"
import { useState } from "react"
import Button from "./button"

const PlayerInfo = ({
  player,
  handleChangeSequence,
}: {
  player: PlayerData
  handleChangeSequence: (player: string, seq: number) => void
}) => {
  dayjs.extend(isSameOrBefore)

  const [numberInput, setNumberInput] = useState(player.sequence)

  const lastUpdateTime = dayjs(player.last_update)

  const currTime = dayjs()

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setNumberInput(isNaN(value) ? 0 : value)
  }

  return (
    <div
      className={`${player.ready_to_move ? "border-blue" : "border-gray"} w-[400px] rounded-lg border-2 p-2`}
    >
      <table className="player-table">
        <tbody>
          <tr>
            <td>
              <strong>Device ID</strong>
            </td>
            <td>{player.device_id}</td>
          </tr>
          <tr>
            <td>
              <strong>Chapter</strong>
            </td>
            <td>{player.chapter}</td>
          </tr>
          <tr>
            <td>
              <strong>Message</strong>
            </td>
            <td>{player.message}</td>
          </tr>
          <tr>
            <td>
              <strong>Sequence</strong>
            </td>
            <td>
              {player.sequence}
              {" ⭢ "}
              <input
                type="number"
                className="border-gray-300 w-14 place-self-center rounded px-2 py-1 text-gray"
                value={numberInput}
                onChange={handleNumberChange}
                min={0}
              />
              <Button
                className="ml-2"
                onClick={() => handleChangeSequence(player.device_id, numberInput)}
              >
                Assign
              </Button>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Ready to Move</strong>
            </td>
            <td>{player.ready_to_move ? "True" : "False"}</td>
          </tr>
          <tr>
            <td>
              <strong>Head Position</strong>
            </td>
            <td>
              ({player.head_position.x}, {player.head_position.y}, {player.head_position.z})
            </td>
          </tr>

          <tr>
            <td>
              <strong>Last Update Time</strong>
            </td>
            <td
              className={`${lastUpdateTime.isSameOrBefore(currTime.subtract(5, "second")) && "font-bold text-red-600"}`}
            >
              {lastUpdateTime.format("YYYY/MM/DD HH:mm:ss")}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default PlayerInfo
