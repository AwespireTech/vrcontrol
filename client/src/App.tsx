import { BrowserRouter, Routes, Route } from "react-router-dom"
import DashboardPage from "./app/page"
import DevicesPage from "./app/devices/page"
import NewDevicePage from "./app/devices/new/page"
import EditDevicePage from "./app/devices/[id]/page"
import RoomsPage from "./app/rooms/page"
import NewRoomPage from "./app/rooms/new/page"
import EditRoomPage from "./app/rooms/[id]/page"
import RoomDevicesPage from "./app/rooms/[id]/devices/page"
import RoomControlPage from "./app/rooms/[id]/control/page"
import ActionsPage from "./app/actions/page"
import NewActionPage from "./app/actions/new/page"
import EditActionPage from "./app/actions/[id]/page"
import MonitoringPage from "./app/monitoring/page"
import SettingsPage from "./app/settings/page"
import AppLayout from "./components/console/app-layout"
import "./app/globals.css"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="devices/new" element={<NewDevicePage />} />
            <Route path="devices/:id" element={<EditDevicePage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="rooms/new" element={<NewRoomPage />} />
            <Route path="rooms/:id" element={<EditRoomPage />} />
            <Route path="rooms/:id/devices" element={<RoomDevicesPage />} />
            <Route path="rooms/:id/control" element={<RoomControlPage />} />
            <Route path="actions" element={<ActionsPage />} />
            <Route path="actions/new" element={<NewActionPage />} />
            <Route path="actions/:id" element={<EditActionPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
