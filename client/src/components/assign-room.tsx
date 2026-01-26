import { useState } from "react"
import Button from "./button"

type RoomOption = { value: string; label: string }

export const AssignRoom = ({
  player,
  options,
  onClick,
}: {
  player: string
  options: Array<string | RoomOption>
  onClick: (player: string, roomId: string, seq: number) => void
}) => {
  const [selectedOption, setSelectedOption] = useState("")
  const [numberInput, setNumberInput] = useState(0)

  const normalizedOptions: RoomOption[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  )

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setNumberInput(isNaN(value) ? 0 : value)
  }

  return (
    <div className="grid grid-cols-4 items-center gap-2 p-2 font-medium text-foreground/80">
      <span> {player} </span>
      <select
        id="mySelect"
        className={`mx-2 place-self-center max-h-40 overflow-y-auto ui-select px-2 py-1 text-center ${
          selectedOption === "" ? "text-foreground/50" : ""
        }`}
        value={selectedOption}
        onChange={(e) => setSelectedOption(e.target.value)}
      >
        <option value="" className="text-foreground/50">
          Select...
        </option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value} className="text-foreground">
            {option.label}
          </option>
        ))}
      </select>

      <input
        type="number"
        className="w-12 place-self-center ui-input px-2 py-1"
        value={numberInput}
        onChange={handleNumberChange}
        min={0}
      />

      <Button
        className="m-2"
        disabled={selectedOption === ""}
        onClick={() => onClick(player, selectedOption, numberInput)}
      >
        Assign
      </Button>
    </div>
  )
}

export default AssignRoom
