import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SERVER } from '@/environment'
import Button from '@/components/button'
import PlayerInfo from '@/components/player-info'
import { controlApi, roomApi, simpleApi } from '@/services/quest-api'
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
  const [webSocketData, setWebSocketData] = useState<RoomInfoData | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting',
  )
  const [selectedOption, setSelectedOption] = useState('')
  const [moveState, setMoveState] = useState('')

  const [playerList, setPlayerList] = useState<string[]>([])
  const [roomList, setRoomList] = useState<{ value: string; label: string }[]>([])
  const [countdown, setCountdown] = useState(5)


  const sortedRoomPlayers = useMemo(() => {
    return playerData.slice().sort((a, b) => (a.sequence >= b.sequence ? 1 : -1))
  }, [playerData])

  const currentRoomName = useMemo(() => {
    const found = roomList.find((room) => room.value === roomId)
    return found?.label || roomId
  }, [roomId, roomList])

  const loadControlData = async () => {
    try {
      const [players, questRooms] = await Promise.all([
        controlApi.getPlayerList(),
        roomApi.getAll(),
      ])
      setPlayerList(players.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
      const roomOptions = questRooms
        .map((room) => ({ value: room.room_id, label: room.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setRoomList(roomOptions)
    } catch (error) {
      console.error('Failed to load control data:', error)
    }
  }

  useEffect(() => {
    loadControlData()

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          loadControlData()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [])

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
      setWebSocketData(data)
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

    try {
      await controlApi.assignSeq(roomId, player, seq)
    } catch (error) {
      console.error('Failed to assign sequence:', error)
    }
  }

  const handleForceAllMove = async () => {
    if (!roomId || selectedOption === '') return

    try {
      await simpleApi.forceAllMove(roomId, selectedOption)
      setMoveState('success')
    } catch (error) {
      console.error('Failed to send move command:', error)
      setMoveState('failed')
    }
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
            回到房間列表
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="surface-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">即時狀態</h2>
                  <p className="text-foreground/70">
                    {webSocketData
                      ? `Player Count: ${webSocketData.player_count}`
                      : 'No data available'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/70">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Ready</span>
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span>Not Ready</span>
                </div>
              </div>
            </div>

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
                <Button disabled={selectedOption === ''} onClick={handleForceAllMove}>
                  Go
                </Button>
                {moveState === 'success' && <span className="text-success">Move command sent!</span>}
                {moveState === 'failed' && (
                  <span className="text-danger">Failed to send move command.</span>
                )}
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">房間內玩家</h2>
              <div className="flex flex-wrap gap-4 py-1">
                {sortedRoomPlayers.map((player) => (
                  <PlayerInfo
                    key={player.device_id + player.sequence}
                    player={player}
                    handleChangeSequence={handleChangeSequence}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">未分配玩家</h2>
                <div className="text-xs text-foreground/60">Refreshing in {countdown}s</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-foreground/70">
                請先至「房間 → 管理設備」將設備加入房間，再回來使用序列指派。
              </div>
              <div className="mt-4 grid grid-cols-2 items-center gap-2 border-b border-border p-2 text-xs font-medium text-foreground/60">
                <span>Player ID</span>
                <span className="text-right">狀態</span>
              </div>
              <div className="space-y-2">
                {playerList.length === 0 ? (
                  <div className="py-4 text-center text-foreground/50">目前沒有未分配玩家</div>
                ) : (
                  playerList.map((player) => (
                    <div key={player} className="flex items-center justify-between px-2 py-1 text-sm">
                      <span className="font-mono text-foreground/80">{player}</span>
                      <span className="text-foreground/50">待指派</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
      </div>
    </QuestPageShell>
  )
}
