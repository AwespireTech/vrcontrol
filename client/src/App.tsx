import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./app/page"
import RoomState from "./app/[roomID]/page"
import QuestPage from "./app/quest/page"
import QuestDevicesPage from "./app/quest/devices/page"
import QuestNewDevicePage from "./app/quest/devices/new/page"
import QuestEditDevicePage from "./app/quest/devices/[id]/page"
import QuestRoomsPage from "./app/quest/rooms/page"
import QuestNewRoomPage from "./app/quest/rooms/new/page"
import QuestEditRoomPage from "./app/quest/rooms/[id]/page"
import QuestRoomDevicesPage from "./app/quest/rooms/[id]/devices/page"
import QuestActionsPage from "./app/quest/actions/page"
import QuestNewActionPage from "./app/quest/actions/new/page"
import QuestEditActionPage from "./app/quest/actions/[id]/page"
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
          <Route path="/quest/devices/:id" element={<QuestEditDevicePage />} />
          <Route path="/quest/rooms" element={<QuestRoomsPage />} />
          <Route path="/quest/rooms/new" element={<QuestNewRoomPage />} />
          <Route path="/quest/rooms/:id" element={<QuestEditRoomPage />} />
          <Route path="/quest/rooms/:id/devices" element={<QuestRoomDevicesPage />} />
          <Route path="/quest/actions" element={<QuestActionsPage />} />
          <Route path="/quest/actions/new" element={<QuestNewActionPage />} />
          <Route path="/quest/actions/:id" element={<QuestEditActionPage />} />
          <Route path="/quest/settings" element={<QuestSettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
