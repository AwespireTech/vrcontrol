import { BrowserRouter, Routes, Route } from "react-router-dom"
import QuestPage from "./app/page"
import QuestDevicesPage from "./app/devices/page"
import QuestNewDevicePage from "./app/devices/new/page"
import QuestEditDevicePage from "./app/devices/[id]/page"
import QuestRoomsPage from "./app/rooms/page"
import QuestNewRoomPage from "./app/rooms/new/page"
import QuestEditRoomPage from "./app/rooms/[id]/page"
import QuestRoomDevicesPage from "./app/rooms/[id]/devices/page"
import QuestRoomControlPage from "./app/rooms/[id]/control/page"
import QuestActionsPage from "./app/actions/page"
import QuestNewActionPage from "./app/actions/new/page"
import QuestEditActionPage from "./app/actions/[id]/page"
import QuestMonitoringPage from "./app/monitoring/page"
import QuestSettingsPage from "./app/settings/page"
import QuestLayout from "./components/quest/quest-layout"
import "./app/globals.css"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<QuestLayout />}>
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
