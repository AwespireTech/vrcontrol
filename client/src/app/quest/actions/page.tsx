import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { actionApi, deviceApi } from '@/services/quest-api'
import type { QuestAction, QuestDevice } from '@/services/quest-types'
import ActionCard from '@/components/quest/action-card'

export default function ActionsPage() {
  const navigate = useNavigate()
  const [actions, setActions] = useState<QuestAction[]>([])
  const [devices, setDevices] = useState<QuestDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const [showExecuteModal, setShowExecuteModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState<QuestAction | null>(null)
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])

  const loadData = async () => {
    try {
      const [actionsData, devicesData] = await Promise.all([
        actionApi.getAll(),
        deviceApi.getAll(),
      ])
      setActions(actionsData)
      setDevices(devicesData)
    } catch (error) {
      console.error('Failed to load actions:', error)
    } finally {
      setLoading(false)
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

  const handleExecute = (actionId: string) => {
    const action = actions.find((a) => a.action_id === actionId)
    if (action) {
      setSelectedAction(action)
      setShowExecuteModal(true)
    }
  }

  const handleConfirmExecute = async () => {
    if (!selectedAction || selectedDevices.length === 0) return

    try {
      const result = await actionApi.executeBatch({
        action_id: selectedAction.action_id,
        device_ids: selectedDevices,
        max_workers: 5,
      })

      alert(
        `批量執行完成\n成功: ${result.success_count}\n失敗: ${result.failed_count}`,
      )

      setShowExecuteModal(false)
      setSelectedAction(null)
      setSelectedDevices([])
      await loadData()
    } catch (error) {
      console.error('Failed to execute action:', error)
      alert('執行失敗')
    }
  }

  const handleDelete = async (actionId: string) => {
    if (!confirm('確定要刪除這個動作嗎？')) return

    try {
      await actionApi.delete(actionId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete action:', error)
      alert('刪除失敗')
    }
  }

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId],
    )
  }

  const selectAllDevices = () => {
    const onlineDevices = devices.filter((d) => d.status === 'online')
    setSelectedDevices(onlineDevices.map((d) => d.device_id))
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
      <div className="max-w-7xl mx-auto">
        {/* 頁面標題和操作 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-blue-500 hover:text-blue-600 mb-2"
            >
              ← 返回
            </button>
            <h1 className="text-3xl font-bold text-gray-900">動作管理</h1>
            <p className="text-gray-600 mt-2">下次更新: {countdown} 秒</p>
          </div>
          <button
            onClick={() => navigate('/quest/actions/new')}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            + 創建動作
          </button>
        </div>

        {/* 動作列表 */}
        {actions.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="text-6xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">還沒有動作</h3>
            <p className="text-gray-600 mb-4">點擊上方按鈕創建您的第一個動作</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {actions.map((action) => (
              <ActionCard
                key={action.action_id}
                action={action}
                onExecute={handleExecute}
                onDelete={handleDelete}
                onEdit={(actionId) => navigate(`/quest/actions/${actionId}/edit`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 執行動作模態框 */}
      {showExecuteModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              執行動作: {selectedAction.name}
            </h2>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  選擇要執行的設備 ({selectedDevices.length} 個已選)
                </p>
                <button
                  onClick={selectAllDevices}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  全選在線設備
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded p-2">
                {devices.map((device) => (
                  <label
                    key={device.device_id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                      device.status !== 'online' ? 'opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDevices.includes(device.device_id)}
                      onChange={() => toggleDeviceSelection(device.device_id)}
                      disabled={device.status !== 'online'}
                      className="w-4 h-4"
                    />
                    <span className="flex-1 text-sm">
                      {device.name} ({device.ip})
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        device.status === 'online'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {device.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExecuteModal(false)
                  setSelectedAction(null)
                  setSelectedDevices([])
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmExecute}
                disabled={selectedDevices.length === 0}
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                執行 ({selectedDevices.length} 個設備)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
