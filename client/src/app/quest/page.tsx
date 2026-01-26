import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deviceApi, roomApi, actionApi } from '@/services/quest-api'
import type { QuestDevice, QuestRoom, QuestAction } from '@/services/quest-types'
import { useMonitoringStatus } from '@/hooks/useMonitoringStatus'

export default function QuestPage() {
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [rooms, setRooms] = useState<QuestRoom[]>([])
  const [actions, setActions] = useState<QuestAction[]>([])
  const monitoring = useMonitoringStatus()

  const loadData = async () => {
    try {
      const [devicesData, roomsData, actionsData] = await Promise.all([
        deviceApi.getAll(),
        roomApi.getAll(),
        actionApi.getAll(),
      ])
      setDevices(devicesData)
      setRooms(roomsData)
      setActions(actionsData)
    } catch (error) {
      console.error('Failed to load Quest data:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const totalDevices = devices.length

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* 頁面標題 */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quest 設備管理</h1>
            <p className="text-foreground/70 mt-2">管理 Meta Quest 設備、房間和動作</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/quest/settings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-semibold"
            >
              ⚙️ 系統設置
            </Link>
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

          <Link
            to="/quest/monitoring"
            className="bg-surface rounded-lg p-8 border border-border hover:border-primary transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-4">🛰️</div>
            <h2 className="text-xl font-bold text-foreground mb-2">網絡監控</h2>
            <p className="text-foreground/70">
              背景監控會定期 ping 設備 IP，並在設備恢復可達時嘗試 ADB 重連
            </p>
            <p className="text-xs text-foreground/50 mt-2">
              目前狀態：
              {!monitoring.known ? '未知' : monitoring.running ? '運行中' : '已停止'}（詳情與控制請到監控頁）
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
