import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./app/page"
import RoomState from "./app/[roomID]/page"
import QuestPage from "./app/quest/page"
import QuestDevicesPage from "./app/quest/devices/page"
import QuestNewDevicePage from "./app/quest/devices/new/page"
import QuestRoomsPage from "./app/quest/rooms/page"
import QuestActionsPage from "./app/quest/actions/page"
import QuestSettingsPage from "./app/quest/settings/page"
import "./app/globals.css"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:roomID" element={<RoomState />} />
          <Route path="/quest" element={<QuestPage />} />
          <Route path="/quest/devices" element={<QuestDevicesPage />} />
          <Route path="/quest/devices/new" element={<QuestNewDevicePage />} />
          <Route path="/quest/rooms" element={<QuestRoomsPage />} />
          <Route path="/quest/actions" element={<QuestActionsPage />} />
          <Route path="/quest/settings" element={<QuestSettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
