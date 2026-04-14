import { useEffect, useMemo, useRef, useState } from "react"
import Button from "@/components/button"
import { webrtcApi } from "@/services/api"
import type { WebRTCSignalMessage, WebRTCStreamStatus } from "@/services/api-types"

interface LiveStreamPlayerProps {
  deviceId: string
  title: string
  subtitle?: string
  onClose?: () => void
  compact?: boolean
}

type DiagnosticsState = {
  websocketState: string
  signalingState: string
  connectionState: string
  iceConnectionState: string
  iceGatheringState: string
  trackReceived: boolean
  trackMuted: boolean | null
  videoReadyState: number
  videoWidth: number
  videoHeight: number
  packetsReceived: number | null
  bytesReceived: number | null
  framesDecoded: number | null
  framesPerSecond: number | null
  keyFramesDecoded: number | null
  decoderImplementation: string
  offerToAnswerMs: number | null
  trackToFirstFrameMs: number | null
  connectToFirstFrameMs: number | null
  waitingForFirstFrameMs: number | null
  lastErrorSource: string
  lastSignalError: string
  lastEvent: string
}

type LifecycleTimestamps = {
  connectStartedAt: number | null
  socketOpenedAt: number | null
  answerReceivedAt: number | null
  trackReceivedAt: number | null
  firstFrameAt: number | null
}

function formatDurationMs(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-"
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(1)} s`
}

const statusBadgeClass: Record<WebRTCStreamStatus, string> = {
  idle: "ui-badge-muted",
  connecting: "ui-badge-warning",
  live: "ui-badge-success",
  stalled: "ui-badge-warning",
  error: "ui-badge-danger",
  closed: "ui-badge-muted",
}

const statusLabel: Record<WebRTCStreamStatus, string> = {
  idle: "待命",
  connecting: "連線中",
  live: "直播中",
  stalled: "已中斷",
  error: "連線失敗",
  closed: "已關閉",
}

export default function LiveStreamPlayer({
  deviceId,
  title,
  subtitle,
  onClose,
  compact = false,
}: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const closedRef = useRef(false)
  const hasTrackRef = useRef(false)
  const lifecycleRef = useRef<LifecycleTimestamps>({
    connectStartedAt: null,
    socketOpenedAt: null,
    answerReceivedAt: null,
    trackReceivedAt: null,
    firstFrameAt: null,
  })
  const terminalErrorSourceRef = useRef("")
  const lastSignalErrorRef = useRef("")
  const [status, setStatus] = useState<WebRTCStreamStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [attempt, setAttempt] = useState(0)
  const hasRenderedFrameRef = useRef(false)
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false)
  const [hasTrack, setHasTrack] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    websocketState: "idle",
    signalingState: "stable",
    connectionState: "new",
    iceConnectionState: "new",
    iceGatheringState: "new",
    trackReceived: false,
    trackMuted: null,
    videoReadyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    packetsReceived: null,
    bytesReceived: null,
    framesDecoded: null,
    framesPerSecond: null,
    keyFramesDecoded: null,
    decoderImplementation: "",
    offerToAnswerMs: null,
    trackToFirstFrameMs: null,
    connectToFirstFrameMs: null,
    waitingForFirstFrameMs: null,
    lastErrorSource: "",
    lastSignalError: "",
    lastEvent: "init",
  })
  const isSupported = useMemo(() => {
    return typeof window !== "undefined" && "RTCPeerConnection" in window
  }, [])

  const layoutClassName = compact ? "aspect-video" : "aspect-[16/9] min-h-[320px]"
  const isLive = status === "live"
  const shouldShowVideo = isLive || hasTrack
  const waitingForFirstFrame = hasTrack && !hasRenderedFrame && status !== "error" && status !== "closed"
  const canRetry = status === "error" || status === "stalled" || status === "closed"
  const waitedForFirstFrameSeconds =
    diagnostics.waitingForFirstFrameMs === null
      ? null
      : Math.max(0, Math.floor(diagnostics.waitingForFirstFrameMs / 1000))
  const statusText = useMemo(() => {
    if (waitingForFirstFrame && status === "connecting") return "等待首幀"
    if (waitingForFirstFrame && status === "stalled") return "首幀逾時"
    return statusLabel[status]
  }, [status, waitingForFirstFrame])

  const panelMessage = useMemo(() => {
    if (waitingForFirstFrame && status === "stalled") {
      return "已收到視訊軌道，但第一個可解碼畫面等待過久。可以重試，或查看診斷資訊確認 keyframe 是否到達。"
    }
    if (waitingForFirstFrame) {
      const waitedText =
        waitedForFirstFrameSeconds === null ? "" : ` 目前已等待 ${waitedForFirstFrameSeconds} 秒。`
      return `已建立連線，正在等待第一個 keyframe，收到後才會開始顯示畫面。${waitedText}`
    }
    if (status === "connecting") return "正在建立 WebRTC 連線…"
    if (status === "stalled") return errorMessage || "串流已中斷，可以重新嘗試連線。"
    if (status === "error") return errorMessage || "即時畫面連線失敗。"
    if (status === "closed") return "即時畫面已關閉。"
    return "等待畫面串流。"
  }, [errorMessage, status, waitedForFirstFrameSeconds, waitingForFirstFrame])

  useEffect(() => {
    if (!isSupported) {
      setStatus("error")
      setErrorMessage("目前瀏覽器不支援 WebRTC。")
      return
    }

    let mounted = true
    let stallTimer: number | null = null
    let statsInterval: number | null = null
    const pendingSignals: WebRTCSignalMessage[] = []
    const pendingRemoteCandidates: RTCIceCandidateInit[] = []

    const resetLifecycle = () => {
      lifecycleRef.current = {
        connectStartedAt: null,
        socketOpenedAt: null,
        answerReceivedAt: null,
        trackReceivedAt: null,
        firstFrameAt: null,
      }
      terminalErrorSourceRef.current = ""
      lastSignalErrorRef.current = ""
    }

    const updateDiagnostics = (partial: Partial<DiagnosticsState>) => {
      if (!mounted) return
      setDiagnostics((current) => ({ ...current, ...partial }))
    }

    const updateTimingDiagnostics = () => {
      const now = performance.now()
      const { connectStartedAt, answerReceivedAt, trackReceivedAt, firstFrameAt } = lifecycleRef.current
      updateDiagnostics({
        offerToAnswerMs:
          connectStartedAt !== null && answerReceivedAt !== null
            ? Math.max(0, answerReceivedAt - connectStartedAt)
            : null,
        trackToFirstFrameMs:
          trackReceivedAt !== null && firstFrameAt !== null
            ? Math.max(0, firstFrameAt - trackReceivedAt)
            : null,
        connectToFirstFrameMs:
          connectStartedAt !== null && firstFrameAt !== null
            ? Math.max(0, firstFrameAt - connectStartedAt)
            : null,
        waitingForFirstFrameMs:
          trackReceivedAt !== null && firstFrameAt === null ? Math.max(0, now - trackReceivedAt) : null,
      })
    }

    const applyErrorState = (message: string, source: string) => {
      terminalErrorSourceRef.current = source
      const nextSignalError = source.startsWith("signal") ? message : lastSignalErrorRef.current
      lastSignalErrorRef.current = nextSignalError
      updateDiagnostics({
        lastErrorSource: source,
        lastSignalError: nextSignalError,
      })
      setStatus("error")
      setErrorMessage(message)
    }

    const applyStalledState = (message: string, source: string) => {
      updateDiagnostics({ lastErrorSource: source })
      setStatus("stalled")
      setErrorMessage(message)
    }

    const markFirstFrame = (eventName: string) => {
      if (lifecycleRef.current.firstFrameAt === null) {
        lifecycleRef.current.firstFrameAt = performance.now()
      }
      hasRenderedFrameRef.current = true
      setHasRenderedFrame(true)
      updateDiagnostics({
        videoReadyState: videoRef.current?.readyState ?? 0,
        videoWidth: videoRef.current?.videoWidth ?? 0,
        videoHeight: videoRef.current?.videoHeight ?? 0,
        lastEvent: eventName,
      })
      updateTimingDiagnostics()
      if (mounted && !closedRef.current) {
        setStatus("live")
      }
    }

    const updatePeerDiagnostics = (peer: RTCPeerConnection) => {
      updateDiagnostics({
        signalingState: peer.signalingState,
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        iceGatheringState: peer.iceGatheringState,
      })
    }

    const cleanup = () => {
      closedRef.current = true
      hasTrackRef.current = false
      hasRenderedFrameRef.current = false
      setHasRenderedFrame(false)
      setHasTrack(false)

      if (statsInterval) {
        window.clearInterval(statsInterval)
        statsInterval = null
      }

      if (stallTimer) {
        window.clearTimeout(stallTimer)
        stallTimer = null
      }

      const socket = socketRef.current
      socketRef.current = null
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "close" satisfies WebRTCSignalMessage["type"] }))
      }
      updateDiagnostics({ websocketState: socket ? String(socket.readyState) : "closed" })
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close()
      }

      const peer = peerRef.current
      peerRef.current = null
      if (peer) {
        peer.ontrack = null
        peer.onicecandidate = null
        peer.onconnectionstatechange = null
        peer.oniceconnectionstatechange = null
        peer.close()
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.onloadedmetadata = null
        videoRef.current.onloadeddata = null
        videoRef.current.oncanplay = null
        videoRef.current.onplaying = null
        videoRef.current.srcObject = null
      }

      resetLifecycle()
    }

    const sendSignal = (message: WebRTCSignalMessage) => {
      const socket = socketRef.current
      if (!socket || closedRef.current) return

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
        return
      }

      pendingSignals.push(message)
    }

    const flushSignals = () => {
      const socket = socketRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return

      while (pendingSignals.length > 0) {
        const message = pendingSignals.shift()
        if (message) {
          socket.send(JSON.stringify(message))
        }
      }
    }

    const attachTrack = (event: RTCTrackEvent) => {
      if (!videoRef.current) return

      const remoteStream = event.streams?.[0] ?? new MediaStream([event.track])
      lifecycleRef.current.trackReceivedAt = lifecycleRef.current.trackReceivedAt ?? performance.now()
      hasTrackRef.current = true
      setHasTrack(true)
      updateDiagnostics({
        trackReceived: true,
        trackMuted: event.track.muted,
        lastEvent: `track:${event.track.kind}`,
      })
      updateTimingDiagnostics()
      streamRef.current = remoteStream
      videoRef.current.srcObject = remoteStream
      void videoRef.current.play().catch(() => undefined)

      event.track.onunmute = () => {
        hasTrackRef.current = true
        setHasTrack(true)
        updateDiagnostics({ trackMuted: false, lastEvent: "track:unmute" })
        updateTimingDiagnostics()
      }

      event.track.onended = () => {
        updateDiagnostics({ trackMuted: true, lastEvent: "track:ended" })
        if (mounted && !closedRef.current) {
          applyStalledState(
            hasRenderedFrameRef.current
              ? "串流已中斷，可以重新嘗試連線。"
              : "視訊軌道已結束，尚未收到可顯示的首幀。",
            "track:ended",
          )
        }
      }
    }

    const startStatsPolling = (peer: RTCPeerConnection) => {
      statsInterval = window.setInterval(async () => {
        const video = videoRef.current
        updatePeerDiagnostics(peer)
        updateDiagnostics({
          videoReadyState: video?.readyState ?? 0,
          videoWidth: video?.videoWidth ?? 0,
          videoHeight: video?.videoHeight ?? 0,
        })
        updateTimingDiagnostics()

        try {
          const stats = await peer.getStats()
          for (const report of stats.values()) {
            if (report.type === "inbound-rtp" && report.kind === "video") {
              updateDiagnostics({
                packetsReceived:
                  typeof report.packetsReceived === "number" ? report.packetsReceived : null,
                bytesReceived:
                  typeof report.bytesReceived === "number" ? report.bytesReceived : null,
                framesDecoded:
                  typeof report.framesDecoded === "number" ? report.framesDecoded : null,
                framesPerSecond:
                  typeof report.framesPerSecond === "number" ? report.framesPerSecond : null,
                keyFramesDecoded:
                  typeof report.keyFramesDecoded === "number" ? report.keyFramesDecoded : null,
              })
            }

            if (report.type === "codec" && report.mimeType) {
              updateDiagnostics({ decoderImplementation: report.mimeType })
            }
          }
        } catch {
          updateDiagnostics({ lastEvent: "stats:error" })
        }
      }, 1000)
    }

    const flushRemoteCandidates = async () => {
      const peer = peerRef.current
      if (!peer || !peer.remoteDescription) return

      while (pendingRemoteCandidates.length > 0) {
        const candidate = pendingRemoteCandidates.shift()
        if (!candidate) continue

        try {
          await peer.addIceCandidate(candidate)
        } catch {
          if (mounted) {
            applyErrorState("ICE 候選套用失敗。", "signal:ice")
          }
        }
      }
    }

    const start = async () => {
      cleanup()
      closedRef.current = false
      hasRenderedFrameRef.current = false
      resetLifecycle()
      lifecycleRef.current.connectStartedAt = performance.now()
      setHasRenderedFrame(false)
      setStatus("connecting")
      setErrorMessage("")
      setDiagnostics({
        websocketState: "idle",
        signalingState: "stable",
        connectionState: "new",
        iceConnectionState: "new",
        iceGatheringState: "new",
        trackReceived: false,
        trackMuted: null,
        videoReadyState: 0,
        videoWidth: 0,
        videoHeight: 0,
        packetsReceived: null,
        bytesReceived: null,
        framesDecoded: null,
        framesPerSecond: null,
        keyFramesDecoded: null,
        decoderImplementation: "",
        offerToAnswerMs: null,
        trackToFirstFrameMs: null,
        connectToFirstFrameMs: null,
        waitingForFirstFrameMs: null,
        lastErrorSource: "",
        lastSignalError: "",
        lastEvent: "connect:start",
      })

      const peer = new RTCPeerConnection()
      peerRef.current = peer
      peer.ontrack = attachTrack
      updatePeerDiagnostics(peer)
      startStatsPolling(peer)

      peer.onicecandidate = (event) => {
        const message: WebRTCSignalMessage = {
          type: "ice",
          candidate: event.candidate?.toJSON(),
        }
        sendSignal(message)
      }

      peer.onconnectionstatechange = () => {
        if (!mounted || closedRef.current) return
        updatePeerDiagnostics(peer)

        switch (peer.connectionState) {
          case "connected":
            setStatus((current) =>
              hasRenderedFrameRef.current || current === "live" ? "live" : "connecting",
            )
            break
          case "disconnected":
            setStatus((current) => (current === "live" ? "stalled" : current === "error" ? current : "connecting"))
            break
          case "failed":
            applyErrorState("WebRTC 連線失敗。", "peer")
            break
          case "closed":
            setStatus("closed")
            break
        }
      }

      peer.oniceconnectionstatechange = () => {
        if (!mounted || closedRef.current) return
        updatePeerDiagnostics(peer)

        switch (peer.iceConnectionState) {
          case "connected":
          case "completed":
            setStatus((current) =>
              hasRenderedFrameRef.current || current === "live" ? "live" : "connecting",
            )
            break
          case "disconnected":
            setStatus((current) => (current === "live" ? "stalled" : current === "error" ? current : "connecting"))
            break
          case "failed":
            applyErrorState("ICE 連線失敗。", "ice")
            break
          case "closed":
            setStatus("closed")
            break
        }
      }

      const socket = new WebSocket(webrtcApi.getSignalUrl(deviceId))
      socketRef.current = socket
      updateDiagnostics({ websocketState: String(socket.readyState), lastEvent: "ws:init" })

      socket.onmessage = async (event) => {
        let message: WebRTCSignalMessage
        try {
          message = JSON.parse(event.data) as WebRTCSignalMessage
        } catch {
          if (mounted) {
            applyErrorState("收到無法解析的即時畫面訊號。", "signal:parse")
          }
          return
        }

        try {
          if (message.type === "answer" && message.sdp) {
            lifecycleRef.current.answerReceivedAt = lifecycleRef.current.answerReceivedAt ?? performance.now()
            updateDiagnostics({ lastEvent: "signal:answer" })
            updateTimingDiagnostics()
            await peer.setRemoteDescription({ type: "answer", sdp: message.sdp })
            await flushRemoteCandidates()
            return
          }

          if (message.type === "ice") {
            updateDiagnostics({ lastEvent: "signal:ice" })
            if (!message.candidate) {
              if (peer.remoteDescription) {
                await peer.addIceCandidate(null)
              }
              return
            }

            if (peer.remoteDescription) {
              await peer.addIceCandidate(message.candidate)
            } else {
              pendingRemoteCandidates.push(message.candidate)
            }
            return
          }

          if (message.type === "error") {
            if (mounted) {
              updateDiagnostics({ lastEvent: `signal:error:${message.error || "unknown"}` })
              applyErrorState(webrtcApi.getErrorMessage(message.error), `signal:${message.error || "unknown"}`)
            }
          }
        } catch (error) {
          if (mounted) {
            applyErrorState(
              error instanceof Error ? error.message : "即時畫面協商失敗。",
              "signal:negotiation",
            )
          }
        }
      }

      socket.onerror = () => {
        if (!mounted || closedRef.current) return
        updateDiagnostics({ websocketState: "error", lastEvent: "ws:error" })
        applyErrorState("即時畫面 WebSocket 連線失敗。", "ws")
      }

      socket.onclose = () => {
        if (!mounted || closedRef.current) return
        updateDiagnostics({ websocketState: "closed", lastEvent: "ws:close" })
        setStatus((current) => {
          if (current === "error") return current
          if (current === "live") return "stalled"
          if (hasTrackRef.current && !hasRenderedFrameRef.current) return "stalled"
          if (terminalErrorSourceRef.current !== "") return current
          return "closed"
        })
      }

      socket.onopen = async () => {
        try {
          lifecycleRef.current.socketOpenedAt = lifecycleRef.current.socketOpenedAt ?? performance.now()
          updateDiagnostics({ websocketState: "open", lastEvent: "ws:open" })
          updateTimingDiagnostics()
          flushSignals()
          const offer = await peer.createOffer({ offerToReceiveVideo: true })
          await peer.setLocalDescription(offer)
          const message: WebRTCSignalMessage = {
            type: "offer",
            sdp: peer.localDescription?.sdp || offer.sdp,
          }
          sendSignal(message)
        } catch (error) {
          if (!mounted) return
          applyErrorState(
            error instanceof Error ? error.message : "無法建立即時畫面請求。",
            "offer",
          )
        }
      }

      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => markFirstFrame("video:loadedmetadata")
        videoRef.current.onloadeddata = () => markFirstFrame("video:loadeddata")
        videoRef.current.oncanplay = () => markFirstFrame("video:canplay")
        videoRef.current.onplaying = () => markFirstFrame("video:playing")
      }

      stallTimer = window.setTimeout(() => {
        if (!mounted || closedRef.current || hasRenderedFrameRef.current) {
          return
        }
        if (hasTrackRef.current) {
          applyStalledState("已收到視訊軌道，但第一個可解碼畫面遲遲未出現。", "first-frame-timeout")
          return
        }
        applyStalledState("已建立連線，但尚未收到可播放的畫面。", "stream-timeout")
      }, 15000)
    }

    void start()

    return () => {
      mounted = false
      cleanup()
    }
  }, [attempt, deviceId, isSupported])

  const handleRetry = () => {
    setAttempt((value) => value + 1)
  }

  const handleClose = () => {
    setStatus("closed")
    onClose?.()
  }

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle ? <div className="text-xs text-foreground/60">{subtitle}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowDiagnostics((value) => !value)} className="ui-btn-xs ui-btn-outline">
            {showDiagnostics ? "隱藏診斷" : "顯示診斷"}
          </Button>
          <span className={`ui-badge ${statusBadgeClass[status]}`}>{statusText}</span>
          {canRetry ? (
            <Button onClick={handleRetry} className="ui-btn-xs ui-btn-muted">
              重試
            </Button>
          ) : null}
          {onClose ? (
            <Button onClick={handleClose} className="ui-btn-xs ui-btn-danger">
              關閉
            </Button>
          ) : null}
        </div>
      </div>

      <div className={`relative bg-black ${layoutClassName}`}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-contain ${shouldShowVideo ? "opacity-100" : "opacity-40"}`}
        />

        {!shouldShowVideo || waitingForFirstFrame ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              {status === "connecting" ? (
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : null}
              <div className="text-sm font-semibold text-white">{panelMessage}</div>
              {waitingForFirstFrame ? (
                <div className="mt-2 text-xs text-white/70">
                  目前已收到視訊軌道，但瀏覽器還在等第一個可解碼的關鍵幀。
                  {diagnostics.waitingForFirstFrameMs !== null
                    ? ` 已等待 ${formatDurationMs(diagnostics.waitingForFirstFrameMs)}。`
                    : ""}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showDiagnostics ? (
        <div className="border-t border-border/70 bg-background/80 px-4 py-3 text-xs text-foreground/70">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3 xl:grid-cols-4">
            <div>WS: {diagnostics.websocketState}</div>
            <div>PC: {diagnostics.connectionState}</div>
            <div>ICE: {diagnostics.iceConnectionState}</div>
            <div>Signal: {diagnostics.signalingState}</div>
            <div>Gathering: {diagnostics.iceGatheringState}</div>
            <div>Track: {diagnostics.trackReceived ? "yes" : "no"}</div>
            <div>Track muted: {diagnostics.trackMuted === null ? "n/a" : diagnostics.trackMuted ? "yes" : "no"}</div>
            <div>Offer to answer: {formatDurationMs(diagnostics.offerToAnswerMs)}</div>
            <div>Track to first frame: {formatDurationMs(diagnostics.trackToFirstFrameMs)}</div>
            <div>Connect to first frame: {formatDurationMs(diagnostics.connectToFirstFrameMs)}</div>
            <div>Waiting first frame: {formatDurationMs(diagnostics.waitingForFirstFrameMs)}</div>
            <div>Video readyState: {diagnostics.videoReadyState}</div>
            <div>Video size: {diagnostics.videoWidth}x{diagnostics.videoHeight}</div>
            <div>Packets: {diagnostics.packetsReceived ?? "-"}</div>
            <div>Bytes: {diagnostics.bytesReceived ?? "-"}</div>
            <div>Frames decoded: {diagnostics.framesDecoded ?? "-"}</div>
            <div>FPS: {diagnostics.framesPerSecond ?? "-"}</div>
            <div>Key frames: {diagnostics.keyFramesDecoded ?? "-"}</div>
            <div>Codec: {diagnostics.decoderImplementation || "-"}</div>
            <div>Error source: {diagnostics.lastErrorSource || "-"}</div>
            <div>Signal error: {diagnostics.lastSignalError || "-"}</div>
            <div>Last event: {diagnostics.lastEvent}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}