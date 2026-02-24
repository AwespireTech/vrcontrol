import { useEffect, useMemo, useRef, useState } from "react"
import { SERVER } from "@/environment"

interface ScrcpyStreamPlayerProps {
  deviceId: string
}

type StreamHeader = {
  type: string
  codec?: string
  width?: number
  height?: number
  fps?: number
  bitrate?: string
}

export function ScrcpyStreamPlayer({ deviceId }: ScrcpyStreamPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [error, setError] = useState<string>("")

  const isSupported = useMemo(() => {
    return typeof window !== "undefined" && "VideoDecoder" in window
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    if (!isSupported) return

    const wsProtocol = SERVER.startsWith("https") ? "wss" : "ws"
    const host = SERVER.replace(/^https?:\/\//, "")
    let ws: WebSocket | null = null
    let decoder: VideoDecoder | null = null
    let header: StreamHeader | null = null
    let buffer = new Uint8Array(0)
    let timestamp = 0
    let frameDuration = 33333
    let decoderConfigKey = ""
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    let sps: Uint8Array | null = null
    let pps: Uint8Array | null = null
    const maxBufferBytes = 32 * 1024 * 1024
    const maxQueueSize = 30

    const resetDecoder = () => {
      if (decoder && decoder.state !== "closed") {
        decoder.close()
      }
      decoder = null
      decoderConfigKey = ""
      timestamp = 0
      buffer = new Uint8Array(0)
      sps = null
      pps = null
    }

    const ensureDecoder = () => {
      if (!header || !ctx) return
      const codec = header.codec || "avc1.42E01E"
      const fps = header.fps && header.fps > 0 ? header.fps : 30
      frameDuration = Math.round(1000000 / fps)
      const nextKey = `${codec}:${fps}`

      if (decoder && decoderConfigKey === nextKey) return
      if (decoder && decoderConfigKey !== nextKey) {
        resetDecoder()
      }

      decoder = new VideoDecoder({
        output: (frame) => {
          if (canvas.width !== frame.codedWidth) {
            canvas.width = frame.codedWidth
          }
          if (canvas.height !== frame.codedHeight) {
            canvas.height = frame.codedHeight
          }
          ctx.drawImage(frame, 0, 0)
          frame.close()
        },
        error: (err) => {
          setError(err.message || "decoder_error")
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close()
          }
          resetDecoder()
        },
      })

      decoder.configure({ codec })
      decoderConfigKey = nextKey
    }

    const appendBuffer = (chunk: ArrayBuffer) => {
      const next = new Uint8Array(buffer.length + chunk.byteLength)
      next.set(buffer)
      next.set(new Uint8Array(chunk), buffer.length)
      buffer = next

      if (buffer.length > maxBufferBytes) {
        const trimIndex = findLastStartCode(buffer)
        buffer = trimIndex >= 0 ? buffer.slice(trimIndex) : new Uint8Array(0)
      }
    }

    const findStartCode = (data: Uint8Array, start: number) => {
      for (let i = start; i + 3 < data.length; i += 1) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) return i
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
          return i
        }
      }
      return -1
    }

    const findLastStartCode = (data: Uint8Array) => {
      for (let i = data.length - 4; i >= 0; i -= 1) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) return i
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
          return i
        }
      }
      return -1
    }

    const extractNalus = () => {
      const nalus: Uint8Array[] = []
      let start = findStartCode(buffer, 0)
      if (start < 0) return nalus

      while (start >= 0) {
        const nextStart = findStartCode(buffer, start + 3)
        if (nextStart < 0) break
        const startCodeSize = buffer[start + 2] === 1 ? 3 : 4
        const nalu = buffer.slice(start + startCodeSize, nextStart)
        if (nalu.length > 0) nalus.push(nalu)
        start = nextStart
      }

      if (start > 0) {
        buffer = buffer.slice(start)
      }

      return nalus
    }

    const makeAnnexBChunk = (nalUnits: Uint8Array[]) => {
      const startCode = new Uint8Array([0, 0, 0, 1])
      const total = nalUnits.reduce((sum, nalu) => sum + startCode.length + nalu.length, 0)
      const out = new Uint8Array(total)
      let offset = 0
      nalUnits.forEach((nalu) => {
        out.set(startCode, offset)
        offset += startCode.length
        out.set(nalu, offset)
        offset += nalu.length
      })
      return out
    }

    const handleNalUnit = (nalu: Uint8Array) => {
      if (!decoder) return
      const nalType = nalu[0] & 0x1f

      if (nalType === 7) {
        sps = nalu
        return
      }
      if (nalType === 8) {
        pps = nalu
        return
      }

      let chunkData: Uint8Array
      let chunkType: EncodedVideoChunkType = "delta"
      if (nalType === 5) {
        chunkType = "key"
        const units = [nalu]
        if (sps && pps) {
          chunkData = makeAnnexBChunk([sps, pps, nalu])
        } else {
          chunkData = makeAnnexBChunk(units)
        }
      } else {
        chunkData = makeAnnexBChunk([nalu])
      }

      const chunk = new EncodedVideoChunk({
        type: chunkType,
        timestamp,
        data: chunkData,
      })
      timestamp += frameDuration

      if (decoder.decodeQueueSize > maxQueueSize && chunkType === "delta") {
        return
      }
      decoder.decode(chunk)
    }

    ws = new WebSocket(`${wsProtocol}://${host}/api/quest/scrcpy/stream/${deviceId}`)
    ws.binaryType = "arraybuffer"

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          header = JSON.parse(event.data) as StreamHeader
          resetDecoder()
          ensureDecoder()
        } catch {
          setError("invalid_header")
        }
        return
      }

      ensureDecoder()
      if (!decoder) return

      appendBuffer(event.data as ArrayBuffer)
      const nalus = extractNalus()
      nalus.forEach(handleNalUnit)
    }

    ws.onerror = () => {
      setError("stream_error")
      resetDecoder()
    }

    ws.onclose = () => {
      resetDecoder()
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close()
      resetDecoder()
    }
  }, [deviceId, isSupported])

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-foreground/60">
        目前瀏覽器不支援 WebCodecs，請改用 Chrome/Edge。
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

  return <canvas ref={canvasRef} className="w-full rounded-lg border border-border/60 bg-muted/10" />
}
