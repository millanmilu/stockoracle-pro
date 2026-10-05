import { useState, useEffect, useRef, useCallback } from 'react';
import { getWsUrl } from '../../utils/api';

// WebSocket live ticks (event-driven; refresh modes only re-query).
export function useLiveTicks(results) {
  // Live ticks
  const [liveTicks, setLiveTicks] = useState({});
  const [wsState, setWsState] = useState('idle');
  const wsRef = useRef(null);
  const pendingTickersRef = useRef(null);

  // ── WebSocket live ticks (event-driven; refresh modes only re-query) ──
  const wsRetryRef = useRef(null);
  const wsAttemptRef = useRef(0);
  const connectWsRef = useRef(null);

  // Exponential backoff (2s -> 4s -> 8s -> 16s, capped at 30s). Previously a
  // dropped socket only flipped the label to RECONNECTING and nothing ever
  // retried, so live prices stayed dead until the user ran a new screen.
  const scheduleReconnect = useCallback(() => {
    if (wsRetryRef.current) return;
    wsAttemptRef.current += 1;
    const delay = Math.min(30000, 2000 * (2 ** (wsAttemptRef.current - 1)));
    setWsState('reconnecting');
    wsRetryRef.current = setTimeout(() => {
      wsRetryRef.current = null;
      if (connectWsRef.current) connectWsRef.current();
    }, delay);
  }, []);

  const connectWs = useCallback(() => {
    try { wsRef.current?.close(); } catch (_) {}
    setWsState('connecting');
    let ws;
    try {
      ws = new WebSocket(getWsUrl());
    } catch (_) {
      setWsState('offline');
      scheduleReconnect();
      return null;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      wsAttemptRef.current = 0; // healthy again -> reset the backoff
      setWsState('live');
      const pending = pendingTickersRef.current;
      if (pending && pending.length > 0) {
        try { ws.send(JSON.stringify({ subscribe: pending })); } catch (_) {}
        pendingTickersRef.current = null;
      }
    };
    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data);
        if (tick.ticker && tick.price) {
          setLiveTicks(prev => ({ ...prev, [tick.ticker]: { price: tick.price, change_pct: tick.change_pct, is_live: tick.is_live } }));
        }
      } catch (_) {}
    };
    ws.onclose = () => {
      // A superseded socket (replaced by connectWs, or closed on unmount) must
      // not trigger a reconnect, otherwise every connect would spawn another.
      if (wsRef.current !== ws) return;
      setWsState((s) => (s === 'live' ? 'reconnecting' : 'offline'));
      scheduleReconnect();
    };
    ws.onerror = () => { if (wsRef.current === ws) setWsState('reconnecting'); };
    return ws;
  }, [scheduleReconnect]);

  useEffect(() => { connectWsRef.current = connectWs; }, [connectWs]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRetryRef.current) { clearTimeout(wsRetryRef.current); wsRetryRef.current = null; }
      const ws = wsRef.current;
      wsRef.current = null; // marks the close as intentional for ws.onclose
      try { ws?.close(); } catch (_) {}
    };
  }, [connectWs]);

  useEffect(() => {
    if (!results || results.length === 0) return;
    const topTickers = results.slice(0, 50).map(r => r.ticker);
    const allowed = new Set(topTickers);
    // Bound the tick store: keyed by symbol it used to grow for every ticker
    // ever subscribed in the session (unbounded memory, stale prices).
    setLiveTicks((prev) => {
      const next = {};
      let changed = false;
      Object.keys(prev).forEach((k) => {
        if (allowed.has(k)) next[k] = prev[k];
        else changed = true;
      });
      return changed ? next : prev;
    });
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ subscribe: topTickers })); } catch (_) {}
      return;
    }
    // Not open: queue the subscription and make sure exactly one attempt is
    // in flight (never a second socket while one is connecting/retrying).
    pendingTickersRef.current = topTickers;
    const state = ws ? ws.readyState : null;
    if (state !== WebSocket.CONNECTING && !wsRetryRef.current) connectWs();
  }, [results, connectWs]);

  return { liveTicks, wsState };
}
