import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DEFAULT_POLL_INTERVAL_SECONDS, SERVER } from '@/environment'
import Button from '@/components/button'
import PlayerInfo from '@/components/player-info'
import { controlApi, deviceApi, roomApi, scrcpyApi, simpleApi } from '@/services/quest-api'
import { QUEST_DEVICE_STATUS, type QuestDevice } from '@/services/quest-types'
import { getDisplayName } from '@/lib/utils/device'
import type { PlayerData, RoomInfoData } from '@/interfaces/room.interface'
import QuestPageShell from '@/components/quest/quest-page-shell'

const TotalChapters = 11

export default function RoomControlPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const roomId = id || ''

  const wsProtocol = SERVER.startsWith('https') ? 'wss' : 'ws'
  const host = SERVER.replace(/^https?:\/\//, '')

  const [playerData, setPlayerData] = useState<PlayerData[]>([])
  const [deviceMap, setDeviceMap] = useState<Map<string, QuestDevice>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting',
  )
  const [selectedOption, setSelectedOption] = useState('')
  const [moveState, setMoveState] = useState('')
  const [countdown, setCountdown] = useState(DEFAULT_POLL_INTERVAL_SECONDS)

  const [forceMovePending, setForceMovePending] = useState(false)
  const [sequencePendingIds, setSequencePendingIds] = useState<Set<string>>(new Set())
  const [deviceActionPending, setDeviceActionPending] = useState<
    Record<string, 'connect' | 'disconnect' | 'monitor'>
  >({})

  const [roomList, setRoomList] = useState<{ value: string; label: string }[]>([])


  const sortedRoomPlayers = useMemo(() => {
    return playerData.slice().sort((a, b) => (a.sequence >= b.sequence ? 1 : -1))
  }, [playerData])

  const currentRoomName = useMemo(() => {
    const found = roomList.find((room) => room.value === roomId)
    return found?.label || roomId
  }, [roomId, roomList])

  const loadControlData = async () => {
    try {
      const [questRooms, devices] = await Promise.all([
        roomApi.getAll(),
        deviceApi.getAll(),
      ])
      const roomOptions = questRooms
        .map((room) => ({ value: room.room_id, label: room.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setRoomList(roomOptions)
      setDeviceMap(new Map(devices.map((device) => [device.device_id, device])))
    } catch (error) {
      console.error('Failed to load control data:', error)
    }
  }

  const refreshDeviceStatuses = async () => {
    try {
      const devices = await deviceApi.getAll()
      setDeviceMap(new Map(devices.map((device) => [device.device_id, device])))
    } catch (error) {
      console.error('Failed to refresh device statuses:', error)
    }
  }

  useEffect(() => {
    loadControlData()
  }, [])

  useEffect(() => {
    if (!roomId) return

    refreshDeviceStatuses()
    const interval = setInterval(() => {
      if (document.hidden) return
      refreshDeviceStatuses()
      setCountdown(DEFAULT_POLL_INTERVAL_SECONDS)
    }, DEFAULT_POLL_INTERVAL_SECONDS * 1000)

    const countdownInterval = setInterval(() => {
      if (document.hidden) return
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(countdownInterval)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return

    const ws = new WebSocket(`${wsProtocol}://${host}/api/quest/ws/control/${roomId}`)
    setConnectionStatus('connecting')

    ws.onopen = () => {
      setConnectionStatus('connected')
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
    }

    ws.onerror = () => {
      setConnectionStatus('disconnected')
    }

    ws.onmessage = (event) => {
      const data: RoomInfoData = JSON.parse(event.data)
      setPlayerData(data.players)
    }

    return () => {
      ws.close()
    }
  }, [roomId, host, wsProtocol])

  useEffect(() => {
    if (moveState !== '') {
      const timer = setTimeout(() => {
        setMoveState('')
        setSelectedOption('')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [moveState])

  const handleChangeSequence = async (player: string, seq: number) => {
    if (!roomId) return
    setSequencePendingIds((prev) => {
      const next = new Set(prev)
      next.add(player)
      return next
    })
    try {
      await controlApi.assignSeq(roomId, player, seq)
    } catch (error) {
      console.error('Failed to assign sequence:', error)
    } finally {
      setSequencePendingIds((prev) => {
        const next = new Set(prev)
        next.delete(player)
        return next
      })
    }
  }

  const handleForceAllMove = async () => {
    if (!roomId || selectedOption === '') return
    setForceMovePending(true)
    try {
      await simpleApi.forceAllMove(roomId, selectedOption)
      setMoveState('success')
    } catch (error) {
      console.error('Failed to send move command:', error)
      setMoveState('failed')
    } finally {
      setForceMovePending(false)
    }
  }

  const handleConnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: 'connect' }))
    try {
      await deviceApi.connect(deviceId)
      await loadControlData()
    } catch (error) {
      console.error('Failed to connect device:', error)
      alert('連線失敗，請稍後再試')
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleDisconnect = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: 'disconnect' }))
    try {
      await deviceApi.disconnect(deviceId)
      await loadControlData()
    } catch (error) {
      console.error('Failed to disconnect device:', error)
      alert('斷開失敗，請稍後再試')
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const handleMonitor = async (deviceId: string) => {
    if (deviceActionPending[deviceId]) return
    setDeviceActionPending((prev) => ({ ...prev, [deviceId]: 'monitor' }))
    try {
      await scrcpyApi.start(deviceId)
      alert('已啟動監看視窗')
    } catch (error: unknown) {
      console.error('Failed to start scrcpy:', error)
      const message = error instanceof Error ? error.message : ''
      alert(message || '啟動監看失敗，請稍後再試')
    } finally {
      setDeviceActionPending((prev) => {
        const next = { ...prev }
        delete next[deviceId]
        return next
      })
    }
  }

  const getAdbStatusText = (status?: QuestDevice['status']) => {
    switch (status) {
      case QUEST_DEVICE_STATUS.ONLINE:
        return '在線'
      case QUEST_DEVICE_STATUS.OFFLINE:
        return '離線'
      case QUEST_DEVICE_STATUS.CONNECTING:
        return '連線中'
      case QUEST_DEVICE_STATUS.ERROR:
        return '錯誤'
      case QUEST_DEVICE_STATUS.DISCONNECTED:
        return '手動斷開'
      default:
        return '未知'
    }
  }

  const getAdbStatusBadgeClass = (status?: QuestDevice['status']) => {
    switch (status) {
      case QUEST_DEVICE_STATUS.ONLINE:
        return 'ui-badge-success'
      case QUEST_DEVICE_STATUS.CONNECTING:
        return 'ui-badge-warning'
      case QUEST_DEVICE_STATUS.ERROR:
        return 'ui-badge-danger'
      case QUEST_DEVICE_STATUS.OFFLINE:
      case QUEST_DEVICE_STATUS.DISCONNECTED:
      default:
        return 'ui-badge-muted'
    }
  }

  type AdbStatus = (typeof QUEST_DEVICE_STATUS)[keyof typeof QUEST_DEVICE_STATUS]

  const isQuestDeviceStatus = (status?: string): status is AdbStatus => {
    return !!status && (Object.values(QUEST_DEVICE_STATUS) as string[]).includes(status)
  }

  const options = Array.from({ length: TotalChapters }, (_, i) => i.toString())

  if (!roomId) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-danger">房間不存在</div>
      </div>
    )
  }

  return (
    <QuestPageShell
      title="房間控制"
      subtitle={`房間: ${currentRoomName}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`ui-badge text-xs font-semibold ${
              connectionStatus === 'connected'
                ? 'ui-badge-success'
                : connectionStatus === 'connecting'
                  ? 'ui-badge-muted'
                  : 'ui-badge-danger'
            }`}
          >
            {connectionStatus === 'connected'
              ? '已連線'
              : connectionStatus === 'connecting'
                ? '連線中'
                : '已中斷'}
          </span>
          <button
            onClick={() => navigate('/quest/rooms')}
            className="ui-btn ui-btn-md ui-btn-muted"
          >
            返回房間列表
          </button>
          <button
            onClick={() => navigate(`/quest/rooms/${roomId}`)}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            編輯房間
          </button>
          <button
            onClick={() => navigate(`/quest/rooms/${roomId}/devices`)}
            className="ui-btn ui-btn-md ui-btn-accent"
          >
            前往設備
          </button>
        </div>
      }
    >
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
            <div className="surface-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">強制移動</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground/70">Force all move to chapter</span>
                <select
                  id="moveSelect"
                  className={`mx-2 place-self-center max-h-40 overflow-y-auto ui-select px-2 py-1 text-center ${
                    selectedOption === '' ? 'text-foreground/50' : ''
                  }`}
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                >
                  <option value="" className="text-foreground/50"></option>
                  {options.map((option, index) => (
                    <option key={index} value={option} className="text-foreground">
                      {option}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={selectedOption === ''}
                  loading={forceMovePending}
                  onClick={handleForceAllMove}
                >
                  Go
                </Button>
                {moveState === 'success' && <span className="text-success">已送出指令</span>}
                {moveState === 'failed' && (
                  <span className="text-danger">送出失敗，請稍後再試</span>
                )}
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">房間內玩家</h2>
                <span className="ui-badge ui-badge-muted text-xs">
                  下次更新 {countdown} 秒
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {sortedRoomPlayers.map((player) => {
                  const device = deviceMap.get(player.device_id)
                  const alias = device ? getDisplayName(device) : player.device_id
                  const adbStatus = isQuestDeviceStatus(device?.status) ? device?.status : undefined
                  const isAdbOnline = adbStatus === QUEST_DEVICE_STATUS.ONLINE
                  const isAdbConnecting = adbStatus === QUEST_DEVICE_STATUS.CONNECTING
                  const devicePendingAction = deviceActionPending[player.device_id]
                  const isDevicePending = !!devicePendingAction
                  const batteryText = isAdbOnline && device?.battery !== undefined && device?.battery !== null
                    ? `${device.battery}%`
                    : '—'
                  const temperatureText = isAdbOnline && device?.temperature !== undefined && device?.temperature !== null
                    ? `${device.temperature}°C`
                    : '—'

                  return (
                    <div key={player.device_id + player.sequence} className="surface-panel p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">{alias}</div>
                          <div className="text-xs text-foreground/50 font-mono">
                            {player.device_id}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                          <span className="uppercase tracking-wide">電量</span>
                          <span className="font-semibold text-foreground">{batteryText}</span>
                          <span className="text-foreground/40">|</span>
                          <span className="uppercase tracking-wide">溫度</span>
                          <span className="font-semibold text-foreground">{temperatureText}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`ui-badge ${getAdbStatusBadgeClass(adbStatus)}`}>
                            ADB {getAdbStatusText(adbStatus)}
                          </span>
                          {!isAdbOnline && !isAdbConnecting && (
                            <Button
                              onClick={() => handleConnect(player.device_id)}
                              className="ui-btn-xs ui-btn-primary"
                              loading={devicePendingAction === 'connect'}
                              disabled={isDevicePending}
                            >
                              連線
                            </Button>
                          )}
                          {isAdbOnline && (
                            <>
                              <Button
                                onClick={() => handleDisconnect(player.device_id)}
                                className="ui-btn-xs ui-btn-danger"
                                loading={devicePendingAction === 'disconnect'}
                                disabled={isDevicePending}
                              >
                                斷開
                              </Button>
                              <Button
                                onClick={() => handleMonitor(player.device_id)}
                                className="ui-btn-xs ui-btn-accent"
                                loading={devicePendingAction === 'monitor'}
                                disabled={isDevicePending}
                              >
                                監看
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <PlayerInfo
                          player={player}
                          handleChangeSequence={handleChangeSequence}
                          displayName={alias}
                          adbStatus={adbStatus}
                          sequenceLoading={sequencePendingIds.has(player.device_id)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

      </div>
    </QuestPageShell>
  )
}
