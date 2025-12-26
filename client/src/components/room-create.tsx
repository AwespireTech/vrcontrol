import { useState } from "react"
import { SERVER } from "@/../environment"
import Button from "./button"

const RoomCreate = () => {
  const [roomName, setRoomName] = useState("")
  const [error, setError] = useState("")

  const createRoom = async (roomId: string) => {
    fetch(`${SERVER}/control/createroom/${roomId}`, {
      method: "POST",
    }).then((r) => {
      if (!r.ok) {
        r.json().then((j) => setError(j.error))
      }
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    const regex = /^[a-zA-Z0-9]*$/

    if (!regex.test(value)) {
      setError("Letters and numbers only")
    } else if (value.length > 10) {
      setError("Max 10 characters")
    } else {
      setError("")
    }

    setRoomName(value.slice(0, 11))
  }

  const handleCreate = () => {
    if (roomName && !error) {
      createRoom(roomName)
      setRoomName("")
    }
  }

  return (
    <div className="w-full">
      <div className="flex w-full justify-between py-2">
        <div className="title">Create Room : </div>
      </div>

      <input
        type="text"
        className="mr-3 rounded px-2 py-1 text-gray"
        value={roomName}
        onChange={handleChange}
        placeholder="Enter room ID"
      />
      <Button className="my-3" onClick={handleCreate} disabled={!roomName || !!error}>
        Create
      </Button>
      {error && <div style={{ color: "red", marginTop: "4px" }}>{error}</div>}
    </div>
  )
}

export default RoomCreate
