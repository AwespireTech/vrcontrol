import { FiRefreshCcw } from "react-icons/fi"

import { SERVER } from "@/../environment"

import AssignRoom from "./assign-room"

const PlayerList = ({
  playerList,
  roomList,
  countdown,
  refresh,
}: {
  playerList: string[]
  roomList: string[]
  countdown: number
  refresh: () => void
}) => {
  async function assignPlayer(player: string, roomId: string, seq: number) {
    console.log("assignPlayer", player, roomId, seq)
    fetch(`${SERVER}/control/assignroomandseq/${player}/${roomId}/${seq}`, {
      method: "POST",
    }).then((r) => console.log(r.status, r.statusText))
  }

  return (
    <div className="w-full">
      <div className="flex w-full place-items-center justify-between py-2">
        <span className="title">Player List :</span>
        <div className="flex place-items-center">
          <span className="pr-1 text-xs text-white/50">Refreshing in {countdown} seconds</span>
          <FiRefreshCcw className="hover:cursor-pointer hover:opacity-50" onClick={refresh} />
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-2 border-b p-2 font-medium text-white/50">
        <span>Player ID</span>
        <span className="text-center">Room ID</span>
        <span className="text-center">Seq</span>
        <span className="text-center"></span>
      </div>
      {playerList.length > 0 &&
        playerList.map((player) => {
          return (
            <div key={player}>
              <AssignRoom player={player} options={roomList} onClick={assignPlayer} />
            </div>
          )
        })}
    </div>
  )
}

export default PlayerList
