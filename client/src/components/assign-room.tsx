import { useState } from "react"
import Button from "./button"

export const AssignRoom = ({
  player,
  options,
  onClick,
}: {
  player: string
  options: string[]
  onClick: (player: string, roomId: string, seq: number) => void
}) => {
  const [selectedOption, setSelectedOption] = useState("")
  const [numberInput, setNumberInput] = useState(0)

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setNumberInput(isNaN(value) ? 0 : value)
  }

  return (
    <div className="grid grid-cols-4 items-center gap-2 p-2 font-medium text-foreground/80">
      <span> {player} </span>
      <select
        id="mySelect"
        className={`mx-2 place-self-center max-h-40 overflow-y-auto rounded-xl border border-border/70 bg-background/40 px-2 py-1 text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 ${
          selectedOption === "" ? "text-foreground/50" : ""
        }`}
        value={selectedOption}
        onChange={(e) => setSelectedOption(e.target.value)}
      >
        <option value="" className="text-foreground/50">
          Select...
        </option>
        {options.map((option, index) => (
          <option key={index} value={option} className="text-foreground">
            {option}
          </option>
        ))}
      </select>

      <input
        type="number"
        className="w-12 place-self-center rounded-xl border border-border/70 bg-background/40 px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
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
