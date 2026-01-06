import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deviceApi, roomApi, actionApi, monitoringApi } from '@/services/quest-api'
import type { QuestDevice, QuestRoom, QuestAction } from '@/services/quest-types'

export default function QuestPage() {
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [rooms, setRooms] = useState<QuestRoom[]>([])
  const [actions, setActions] = useState<QuestAction[]>([])
  const [monitoringRunning, setMonitoringRunning] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const loadData = async () => {
    try {
      const [devicesData, roomsData, actionsData, monitoringStatus] = await Promise.all([
        deviceApi.getAll(),
        roomApi.getAll(),
        actionApi.getAll(),
        monitoringApi.getStatus(),
      ])
      setDevices(devicesData)
      setRooms(roomsData)
      setActions(actionsData)
      setMonitoringRunning(monitoringStatus.running)
    } catch (error) {
      console.error('Failed to load Quest data:', error)
    }
  }

  useEffect(() => {
    loadData()

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          loadData()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  const toggleMonitoring = async () => {
    try {
      if (monitoringRunning) {
        await monitoringApi.stop()
      } else {
        await monitoringApi.start()
      }
      setMonitoringRunning(!monitoringRunning)
    } catch (error) {
      console.error('Failed to toggle monitoring:', error)
    }
  }

  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const totalDevices = devices.length

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* 頁面標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Quest 設備管理</h1>
          <p className="text-foreground/70 mt-2">管理 Meta Quest 設備、房間和動作</p>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">設備總數</p>
                <p className="text-3xl font-bold text-foreground">{totalDevices}</p>
              </div>
              <div className="text-4xl">📱</div>
            </div>
          </div>

          <div className="bg-surface rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">在線設備</p>
                <p className="text-3xl font-bold text-success">{onlineDevices}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-surface rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">房間數量</p>
                <p className="text-3xl font-bold text-foreground">{rooms.length}</p>
              </div>
              <div className="text-4xl">🏠</div>
            </div>
          </div>

          <div className="bg-surface rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70">動作數量</p>
                <p className="text-3xl font-bold text-foreground">{actions.length}</p>
              </div>
              <div className="text-4xl">⚡</div>
            </div>
          </div>
        </div>

        {/* 功能區塊 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            to="/quest/devices"
            className="bg-surface rounded-lg p-8 border border-border hover:border-primary transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-xl font-bold text-foreground mb-2">設備管理</h2>
            <p className="text-foreground/70">添加、編輯和管理 Quest 設備，查看設備狀態</p>
          </Link>

          <Link
            to="/quest/rooms"
            className="bg-surface rounded-lg p-8 border border-border hover:border-primary transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">🏠</div>
            <h2 className="text-xl font-bold text-foreground mb-2">房間管理</h2>
            <p className="text-foreground/70">創建房間，分配設備，管理 Socket 連接</p>
          </Link>

          <Link
            to="/quest/actions"
            className="bg-surface rounded-lg p-8 border border-border hover:border-primary transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">⚡</div>
            <h2 className="text-xl font-bold text-foreground mb-2">動作管理</h2>
            <p className="text-foreground/70">創建和執行設備動作，批量操作設備</p>
          </Link>
        </div>

        {/* 監控控制 */}
        <div className="bg-surface rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">網絡監控服務</h3>
              <p className="text-sm text-foreground/70 mt-1">
                自動監控設備連接狀態 · 下次更新: {countdown} 秒
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/quest/settings"
                className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-semibold"
              >
                ⚙️ 系統設置
              </Link>
              <button
                onClick={toggleMonitoring}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  monitoringRunning
                    ? 'bg-danger hover:bg-danger/80 text-foreground'
                    : 'bg-success hover:bg-success/80 text-foreground'
                }`}
              >
                {monitoringRunning ? '停止監控' : '啟動監控'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
