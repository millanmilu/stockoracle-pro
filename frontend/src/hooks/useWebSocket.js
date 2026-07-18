import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = API.replace(/^https?:\/\//, '') || window.location.host
    const url  = `${protocol}://${host}/ws/prices`

    const connect = () => {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen  = () => setConnected(true)
      ws.onclose = () => { setConnected(false); setTimeout(connect, 4000) }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        try { onMessage(JSON.parse(e.data)) } catch (_) {}
      }
    }

    connect()
    return () => { wsRef.current?.close() }
  }, [])

  return connected
}
