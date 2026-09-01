import { useState, useEffect, useRef } from 'react';
import { getWsUrl } from '../utils/api';

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef = useRef(onMessage)
  const retryDelayRef = useRef(1000)
  const pingIntervalRef = useRef(null)

  // Keep callback ref fresh without triggering useEffect re-runs
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let active = true
    const url  = getWsUrl();

    const connect = () => {
      if (!active) return
      try {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          if (!active) {
            ws.close()
            return
          }
          setConnected(true)
          retryDelayRef.current = 1000 // Reset backoff upon successful connection

          // Keep-alive heartbeat ping every 25 seconds
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try { ws.send(JSON.stringify({ type: 'ping' })) } catch (_) {}
            }
          }, 25000)
        }

        ws.onclose = () => {
          setConnected(false)
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
          if (active) {
            const nextDelay = Math.min(retryDelayRef.current * 1.5, 15000)
            retryDelayRef.current = nextDelay
            setTimeout(connect, nextDelay)
          }
        }

        ws.onerror = () => ws.close()

        ws.onmessage = (e) => {
          if (!active) return
          try {
            const data = JSON.parse(e.data)
            if (data && data.type !== 'pong') {
              onMessageRef.current(data)
            }
          } catch (_) {}
        }
      } catch (err) {
        if (active) {
          setTimeout(connect, retryDelayRef.current)
        }
      }
    }

    connect()
    return () => {
      active = false
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      wsRef.current?.close()
    }
  }, [])

  return connected
}
