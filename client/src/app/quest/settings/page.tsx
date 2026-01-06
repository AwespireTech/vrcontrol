import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { monitoringApi } from '@/services/quest-api'

export default function QuestSettingsPage() {
  const navigate = useNavigate()
  const [monitoringRunning, setMonitoringRunning] = useState(false)
  const [monitoringInterval, setMonitoringInterval] = useState(10)
  const [loading, setLoading] = useState(true)

  const loadSettings = async () => {
    try {
      const status = await monitoringApi.getStatus()
      setMonitoringRunning(status.running)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const toggleMonitoring = async () => {
    try {
      if (monitoringRunning) {
        await monitoringApi.stop()
        alert('監控服務已停止')
      } else {
        await monitoringApi.start()
        alert('監控服務已啟動')
      }
      await loadSettings()
    } catch (error) {
      console.error('Failed to toggle monitoring:', error)
      alert('操作失敗')
    }
  }

  const handleSetInterval = async () => {
    try {
      await monitoringApi.setInterval(monitoringInterval)
      alert(`監控間隔已設置為 ${monitoringInterval} 秒`)
    } catch (error) {
      console.error('Failed to set interval:', error)
      alert('設置失敗')
    }
  }

  const handleRunOnce = async () => {
    try {
      await monitoringApi.runOnce()
      alert('手動監控已執行')
    } catch (error) {
      console.error('Failed to run monitoring:', error)
      alert('執行失敗')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">加載中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:text-blue-600 mb-4"
        >
          ← 返回
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Quest 系統設置</h1>

        <div className="space-y-6">
          {/* 監控服務設置 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">網絡監控服務</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">監控狀態</p>
                  <p className="text-sm text-gray-600">
                    {monitoringRunning ? '服務正在運行' : '服務已停止'}
                  </p>
                </div>
                <button
                  onClick={toggleMonitoring}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    monitoringRunning
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {monitoringRunning ? '停止監控' : '啟動監控'}
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900 mb-3">監控間隔</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={monitoringInterval}
                    onChange={(e) => setMonitoringInterval(parseInt(e.target.value) || 10)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">秒</span>
                  <button
                    onClick={handleSetInterval}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    應用
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  設置監控服務檢查設備連接狀態的時間間隔 (1-300 秒)
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900 mb-2">手動監控</p>
                <p className="text-sm text-gray-600 mb-3">
                  立即執行一次設備狀態檢查，不影響定時監控設置
                </p>
                <button
                  onClick={handleRunOnce}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  立即執行監控
                </button>
              </div>
            </div>
          </div>

          {/* 系統信息 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">系統信息</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">API 端點:</span>
                <span className="font-mono text-gray-900">/api/quest</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Socket 端口範圍:</span>
                <span className="font-mono text-gray-900">3000-3100</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">數據存儲:</span>
                <span className="font-mono text-gray-900">JSON 文件</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">前端更新間隔:</span>
                <span className="font-mono text-gray-900">5 秒</span>
              </div>
            </div>
          </div>

          {/* 關於 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">關於</h2>
            <p className="text-gray-600 mb-2">
              Quest 設備管理模組提供了完整的 Meta Quest 設備管理功能，包括：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
              <li>設備連接和狀態監控</li>
              <li>房間管理和 Socket Server</li>
              <li>動作執行和批量操作</li>
              <li>自動化網絡監控</li>
              <li>ADB 命令集成</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
