import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

import { SERVER } from "@/environment"
import Button from "@/components/button"
import PlayerInfo from "@/components/player-info"
import { PlayerData, RoomInfoData } from "@/interfaces/room.interface"

const TotalChapters = 11

export const RoomState = () => {
  const navigate = useNavigate()
  const { roomID } = useParams<{ roomID: string }>()

  const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
  const host = SERVER.replace(/^https?:\/\//, "")

  const [playerData, setPlayerData] = useState<PlayerData[]>([])
  const [webSocketData, setWebSocketData] = useState<RoomInfoData | null>()
  const [selectedOption, setSelectedOption] = useState("")
  const [moveState, setMoveState] = useState("")

  useEffect(() => {
    const ws = new WebSocket(`${wsProtocol}://${host}/ws/control/${roomID}`)
    ws.onopen = () => {
      console.log("open connection")
    }

    ws.onclose = () => {
      console.log("close connection")
    }

    ws.onmessage = (event) => {
      const data: RoomInfoData = JSON.parse(event.data)
      setWebSocketData(data)
      // console.log(data)
      setPlayerData(data.players)
    }

    return () => {
      ws.close()
    }
  }, [roomID, host, wsProtocol])

  useEffect(() => {
    if (moveState !== "") {
      const timer = setTimeout(() => {
        setMoveState("")
        setSelectedOption("")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [moveState])

  const handleChangeSequence = (player: string, seq: number) => {
    fetch(`${SERVER}/control/assignseq/${roomID}/${player}/${seq}`, {
      method: "POST",
    }).then(() => console.log("assign", player, "to sequence", seq))
  }

  const options = Array.from({ length: TotalChapters }, (_, i) => i.toString())

  return (
    <div className="w-full">
      <div>
        <Button onClick={() => navigate("/")}>&#8249; Back</Button>
      </div>
      <p className="py-3">
        Room ID: <span className="title">{roomID}</span>
      </p>
      <p>{webSocketData ? `Player Count: ${webSocketData.player_count}` : "No data available"}</p>
      <div className="flex items-center justify-start gap-2 py-3">
        <div>Ready to move: &nbsp;</div>
        <div className="w-8 border-b-2 border-b-primary" />
        <div>True &nbsp;</div>
        <div className="w-8 border-b-2 border-b-muted" />
        <div>False</div>
      </div>
      <div className="flex items-center gap-2">
        <span>Force all move to chapter</span>
        <select
          id="mySelect"
          className={`mx-2 place-self-center overflow-y-auto rounded border border-border bg-surface px-2 py-1 text-center text-foreground ${selectedOption === "" && "text-foreground/50"}`}
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
        >
          <option value="" className="text-foreground/50"></option>
          {options.map((option, index) => (
            <option key={index} value={option} className="text-foreground">
              {option}
            </option>
          ))}
        </select>
        <Button
          disabled={selectedOption === ""}
          onClick={() => {
            fetch(`${SERVER}/simple/forceallmove/${roomID}/${selectedOption}`)
              .then((data) => {
                if (data.ok) {
                  setMoveState("success")
                } else {
                  setMoveState("failed")
                }
              })
              .catch(() => {
                console.log("failed to send move command")
                setMoveState("failed")
              })
          }}
        >
          Go
        </Button>
        {moveState === "success" && <span className="text-success">Move command sent!</span>}
        {moveState === "failed" && <span className="text-danger">Failed to send move command.</span>}
      </div>

      {/* <p>Player Info:</p> */}
      <div className="flex flex-wrap gap-4 py-1">
        {playerData
          .slice()
          .sort((a, b) => (a.sequence >= b.sequence ? 1 : -1))
          .map((player) => {
            return (
              <PlayerInfo
                key={player.device_id + player.sequence}
                player={player}
                handleChangeSequence={handleChangeSequence}
              />
            )
          })}
      </div>
    </div>
  )
}

export default RoomState
