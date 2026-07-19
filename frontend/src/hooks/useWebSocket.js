import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef = useRef(onMessage)

  // Keep callback ref fresh without triggering useEffect re-runs
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let active = true
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = API.replace(/^https?:\/\//, '') || window.location.host
    const url  = `${protocol}://${host}/ws/prices`

    const connect = () => {
      if (!active) return
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen  = () => {
        if (!active) {
          ws.close()
          return
        }
        setConnected(true)
      }
      
      ws.onclose = () => {
        setConnected(false)
        if (active) {
          setTimeout(connect, 4000)
        }
      }
      
      ws.onerror = () => ws.close()
      
      ws.onmessage = (e) => {
        if (!active) return
        try { onMessageRef.current(JSON.parse(e.data)) } catch (_) {}
      }
    }

    connect()
    return () => {
      active = false
      wsRef.current?.close()
    }
  }, [])

  return connected
}
