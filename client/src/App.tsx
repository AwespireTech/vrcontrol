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
import QuestRoomControlPage from "./app/quest/rooms/[id]/control/page"
import QuestActionsPage from "./app/quest/actions/page"
import QuestNewActionPage from "./app/quest/actions/new/page"
import QuestEditActionPage from "./app/quest/actions/[id]/page"
import QuestMonitoringPage from "./app/quest/monitoring/page"
import QuestSettingsPage from "./app/quest/settings/page"
import QuestLayout from "./components/quest/quest-layout"
import "./app/globals.css"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:roomID" element={<RoomState />} />
          <Route path="/quest" element={<QuestLayout />}>
            <Route index element={<QuestPage />} />
            <Route path="devices" element={<QuestDevicesPage />} />
            <Route path="devices/new" element={<QuestNewDevicePage />} />
            <Route path="devices/:id" element={<QuestEditDevicePage />} />
            <Route path="rooms" element={<QuestRoomsPage />} />
            <Route path="rooms/new" element={<QuestNewRoomPage />} />
            <Route path="rooms/:id" element={<QuestEditRoomPage />} />
            <Route path="rooms/:id/devices" element={<QuestRoomDevicesPage />} />
            <Route path="rooms/:id/control" element={<QuestRoomControlPage />} />
            <Route path="actions" element={<QuestActionsPage />} />
            <Route path="actions/new" element={<QuestNewActionPage />} />
            <Route path="actions/:id" element={<QuestEditActionPage />} />
            <Route path="monitoring" element={<QuestMonitoringPage />} />
            <Route path="settings" element={<QuestSettingsPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
