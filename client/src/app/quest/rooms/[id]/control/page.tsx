import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SERVER } from '@/environment'
import Button from '@/components/button'
import PlayerInfo from '@/components/player-info'
import AssignRoom from '@/components/assign-room'
import { controlApi, roomApi, simpleApi } from '@/services/quest-api'
import type { PlayerData, RoomInfoData } from '@/interfaces/room.interface'

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
  const [roomList, setRoomList] = useState<string[]>([])
  const [countdown, setCountdown] = useState(5)

  const [createRoomName, setCreateRoomName] = useState('')
  const [createRoomError, setCreateRoomError] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)

  const sortedRoomPlayers = useMemo(() => {
    return playerData.slice().sort((a, b) => (a.sequence >= b.sequence ? 1 : -1))
  }, [playerData])

  const loadControlData = async () => {
    try {
      const [players, questRooms, controlRooms] = await Promise.all([
        controlApi.getPlayerList(),
        roomApi.getAll(),
        controlApi.getRoomList(),
      ])
      setPlayerList(players.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
      const questRoomIds = questRooms.map((room) => room.room_id)
      const mergedRooms = questRoomIds.length > 0
        ? Array.from(new Set([...questRoomIds, ...controlRooms]))
        : controlRooms
      setRoomList(mergedRooms.slice().sort((a, b) => a.localeCompare(b)))
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

    const ws = new WebSocket(`${wsProtocol}://${host}/api/quest/socket/control/${roomId}`)
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

  const handleAssignRoomAndSeq = async (player: string, targetRoomId: string, seq: number) => {
    try {
      await controlApi.assignRoomAndSeq(player, targetRoomId, seq)
      await loadControlData()
    } catch (error) {
      console.error('Failed to assign room and sequence:', error)
    }
  }

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

  const handleCreateRoomChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const regex = /^[a-zA-Z0-9]*$/

    if (!regex.test(value)) {
      setCreateRoomError('Letters and numbers only')
    } else if (value.length > 10) {
      setCreateRoomError('Max 10 characters')
    } else {
      setCreateRoomError('')
    }

    setCreateRoomName(value.slice(0, 11))
  }

  const handleCreateRoom = async () => {
    if (!createRoomName || createRoomError) return

    try {
      setCreatingRoom(true)
      await controlApi.createRoom(createRoomName)
      setCreateRoomName('')
      await loadControlData()
    } catch (error) {
      console.error('Failed to create room:', error)
    } finally {
      setCreatingRoom(false)
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <button
                onClick={() => navigate('/quest/rooms')}
                className="text-primary hover:text-primary/80"
              >
                ← 返回
              </button>
              <button
                onClick={() => navigate(`/quest/rooms/${roomId}/devices`)}
                className="text-primary hover:text-primary/80"
              >
                前往設備
              </button>
              <button
                onClick={() => navigate(`/quest/rooms/${roomId}`)}
                className="text-primary hover:text-primary/80"
              >
                編輯房間
              </button>
            </div>
            <h1 className="text-3xl font-bold text-foreground">房間控制</h1>
            <p className="text-foreground/70 mt-2">房間: {roomId}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-foreground/70">連線狀態</span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                connectionStatus === 'connected'
                  ? 'bg-success/20 text-success'
                  : connectionStatus === 'connecting'
                    ? 'bg-muted text-foreground'
                    : 'bg-danger/20 text-danger'
              }`}
            >
              {connectionStatus === 'connected'
                ? '已連線'
                : connectionStatus === 'connecting'
                  ? '連線中'
                  : '已中斷'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface rounded-lg border border-border p-6">
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

            <div className="bg-surface rounded-lg border border-border p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">強制移動</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground/70">Force all move to chapter</span>
                <select
                  id="moveSelect"
                  className={`mx-2 place-self-center overflow-y-auto rounded border border-border bg-surface px-2 py-1 text-center text-foreground ${selectedOption === '' && 'text-foreground/50'}`}
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

            <div className="bg-surface rounded-lg border border-border p-6">
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
            <div className="bg-surface rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">未分配玩家</h2>
                <div className="text-xs text-foreground/60">Refreshing in {countdown}s</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-2 border-b border-border p-2 text-xs font-medium text-foreground/60">
                <span>Player ID</span>
                <span className="text-center">Room ID</span>
                <span className="text-center">Seq</span>
                <span></span>
              </div>
              <div className="space-y-2">
                {playerList.map((player) => (
                  <AssignRoom
                    key={player}
                    player={player}
                    options={roomList}
                    onClick={handleAssignRoomAndSeq}
                  />
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">控制房間清單</h2>
                <button
                  onClick={loadControlData}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  重新整理
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {roomList.map((room) => (
                  <Button
                    key={room}
                    onClick={() => navigate(`/quest/rooms/${room}/control`)}
                    className="w-28"
                  >
                    {room}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">建立控制房間</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="flex-1 min-w-[140px] rounded border border-border bg-surface px-2 py-1 text-foreground"
                  value={createRoomName}
                  onChange={handleCreateRoomChange}
                  placeholder="Enter room ID"
                />
                <Button onClick={handleCreateRoom} disabled={!createRoomName || !!createRoomError || creatingRoom}>
                  {creatingRoom ? 'Creating...' : 'Create'}
                </Button>
              </div>
              {createRoomError && <div className="mt-2 text-danger text-sm">{createRoomError}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
