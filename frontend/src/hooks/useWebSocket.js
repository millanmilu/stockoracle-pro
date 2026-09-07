import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { getWsUrl } from '../utils/api';
import { POPULAR_STOCKS } from '../utils/chartHelpers';

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const retryDelayRef = useRef(1000);
  const pingIntervalRef = useRef(null);

  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setWsConnected = useStore((s) => s.setWsConnected);
  const setWsLiveData  = useStore((s) => s.setWsLiveData);
  const setLivePrice   = useStore((s) => s.setLivePrice);

  // Keep callback ref fresh without triggering useEffect re-runs
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Helper to send subscription list to backend
  const sendSubscription = (ws, symbol) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const symList = Array.from(
        new Set([
          symbol?.toUpperCase().trim() || 'RELIANCE',
          ...POPULAR_STOCKS,
        ])
      ).filter(Boolean).slice(0, 50);

      ws.send(JSON.stringify({ subscribe: symList }));
    } catch (_) {}
  };

  // Dynamically update subscription whenever selectedSymbol changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedSymbol) {
      sendSubscription(wsRef.current, selectedSymbol);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    let active = true;
    const url  = getWsUrl();

    const connect = () => {
      if (!active) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) {
            ws.close();
            return;
          }
          setConnected(true);
          setWsConnected(true);
          retryDelayRef.current = 1000; // Reset backoff upon successful connection

          // Subscribe immediately to the currently selected symbol FIRST (avoid missing
          // the first tick for the symbol the user is actually viewing), then add popular universe.
          const currentSym = useStore.getState().selectedSymbol || 'RELIANCE';
          sendSubscription(ws, currentSym);

          // Keep-alive heartbeat ping every 25 seconds
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try { ws.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
            }
          }, 25000);
        };

        ws.onclose = () => {
          setConnected(false);
          setWsConnected(false);
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          if (active) {
            const nextDelay = Math.min(retryDelayRef.current * 1.5, 15000);
            retryDelayRef.current = nextDelay;
            setTimeout(connect, nextDelay);
          }
        };

        ws.onerror = () => ws.close();

        ws.onmessage = (e) => {
          if (!active) return;
          try {
            const data = JSON.parse(e.data);
            if (data && data.type !== 'pong') {
              if (data.ticker && data.price != null) {
                setLivePrice(data.ticker, data);
                if (data.is_live) {
                  setWsLiveData(true);
                }
              }
              if (onMessageRef.current) {
                onMessageRef.current(data);
              }
            }
          } catch (_) {}
        };
      } catch (err) {
        if (active) {
          setTimeout(connect, retryDelayRef.current);
        }
      }
    };

    connect();

    return () => {
      active = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      wsRef.current?.close();
      setConnected(false);
      setWsConnected(false);
    };
  }, [setWsConnected, setWsLiveData, setLivePrice]);

  return connected;
}
