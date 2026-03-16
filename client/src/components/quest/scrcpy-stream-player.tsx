import { useEffect, useMemo, useRef, useState } from "react"
import { SERVER } from "@/environment"

interface ScrcpyStreamPlayerProps {
  deviceId: string
}

type SignalMessage = {
  type: "offer" | "answer" | "ice" | "close" | "error"
  sdp?: string
  candidate?: RTCIceCandidateInit
  error?: string
}

export function ScrcpyStreamPlayer({ deviceId }: ScrcpyStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string>("")

  const isSupported = useMemo(() => {
    return typeof window !== "undefined" && "RTCPeerConnection" in window
  }, [])

  useEffect(() => {
    if (!videoRef.current) return
    if (!isSupported) return

    const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
    const host = SERVER.replace(/^https?:\/\//, "")
    const wsUrl = `${wsProtocol}://${host}/api/quest/ws/webrtc/${deviceId}`
    const ws = new WebSocket(wsUrl)
    let pc: RTCPeerConnection | null = null
    let closed = false
    const pendingSignals: SignalMessage[] = []
    const pendingRemoteCandidates: RTCIceCandidateInit[] = []

    const sendSignal = (message: SignalMessage) => {
      if (closed) return
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      } else {
        pendingSignals.push(message)
      }
    }

    const flushSignals = () => {
      if (ws.readyState !== WebSocket.OPEN) return
      while (pendingSignals.length > 0) {
        const message = pendingSignals.shift()
        if (message) ws.send(JSON.stringify(message))
      }
    }

    const attachTrack = (event: RTCTrackEvent) => {
      if (!videoRef.current) return
      if (event.streams && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0]
        return
      }
      const stream = new MediaStream([event.track])
      videoRef.current.srcObject = stream
    }

    const setupPeerConnection = () => {
      pc = new RTCPeerConnection()
      pc.ontrack = attachTrack
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          sendSignal({ type: "ice" })
          return
        }
        sendSignal({ type: "ice", candidate: event.candidate.toJSON() })
      }
      pc.oniceconnectionstatechange = () => {
        console.debug("[WebRTC][client] iceConnectionState:", pc?.iceConnectionState)
      }
      pc.onicegatheringstatechange = () => {
        console.debug("[WebRTC][client] iceGatheringState:", pc?.iceGatheringState)
      }
      pc.onconnectionstatechange = () => {
        console.debug("[WebRTC][client] connectionState:", pc?.connectionState)
      }
    }

    const startOffer = async () => {
      if (!pc) return
      try {
        const offer = await pc.createOffer({ offerToReceiveVideo: true })
        await pc.setLocalDescription(offer)
        if (pc.localDescription) {
          sendSignal({ type: "offer", sdp: pc.localDescription.sdp || "" })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "offer_failed")
      }
    }

    const flushRemoteCandidates = async () => {
      if (!pc || !pc.remoteDescription) return
      while (pendingRemoteCandidates.length > 0) {
        const candidate = pendingRemoteCandidates.shift()
        if (!candidate) continue
        try {
          await pc.addIceCandidate(candidate)
        } catch {
          setError("ice_apply_failed")
        }
      }
    }

    setupPeerConnection()

    ws.onopen = () => {
      flushSignals()
      void startOffer()
    }

    ws.onmessage = async (event) => {
      let message: SignalMessage
      try {
        message = JSON.parse(event.data) as SignalMessage
      } catch {
        setError("invalid_signal")
        return
      }

      if (!pc) return

      switch (message.type) {
        case "answer":
          if (message.sdp) {
            await pc.setRemoteDescription({ type: "answer", sdp: message.sdp })
            await flushRemoteCandidates()
          }
          break
        case "ice":
          if (!message.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(null)
            }
            break
          }

          if (pc.remoteDescription) {
            await pc.addIceCandidate(message.candidate)
          } else {
            pendingRemoteCandidates.push(message.candidate)
          }
          break
        case "error":
          setError(message.error || "stream_error")
          break
      }
    }

    ws.onerror = () => {
      setError("stream_error")
    }

    ws.onclose = () => {
      closed = true
      if (pc) {
        pc.close()
        pc = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "close" satisfies SignalMessage["type"] }))
      }
      closed = true
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      if (pc) {
        pc.close()
        pc = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [deviceId, isSupported])

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-foreground/60">
        目前瀏覽器不支援 WebRTC。
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-foreground/60">
        串流錯誤：{error}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full rounded-lg border border-border/60 bg-muted/10"
    />
  )
}
