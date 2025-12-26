import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./app/page"
import RoomState from "./app/[roomID]/page"
import "./app/globals.css"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:roomID" element={<RoomState />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
