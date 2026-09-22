import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { getWsUrl } from '../utils/api';
import { POPULAR_STOCKS, emitLiveTick, isGoldSymbol, isCryptoSymbol } from '../utils/chartHelpers';

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
                const isCrypto = isCryptoSymbol(data.ticker);
                // If direct Binance WebSocket is actively connected for crypto, let Binance stream take priority
                if (isCrypto && cryptoWsRef.current && cryptoWsRef.current.readyState === WebSocket.OPEN) {
                  return;
                }
                setLivePrice(data.ticker, data);
                if (data.is_live) {
                  setWsLiveData(true);
                }
                // 60-FPS tick bus: chart consumers subscribe directly (render-free path)
                emitLiveTick(data);
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

  // Direct client-side stream for Crypto (e.g. BTC) via Binance combined WebSocket
  const cryptoWsRef = useRef(null);
  const selectedInterval = useStore((s) => s.selectedInterval || '1m');

  useEffect(() => {
    const s = (selectedSymbol || '').toUpperCase().trim();
    const isCrypto = isCryptoSymbol(s);

    if (!isCrypto) {
      if (cryptoWsRef.current) {
        try { cryptoWsRef.current.close(); } catch (_) {}
        cryptoWsRef.current = null;
      }
      return;
    }

    let active = true;
    let ws = null;
    let reconnectTimer = null;

    // Map StockOracle interval to Binance kline stream interval
    const binanceKlineMap = {
      '1s': '1s',
      '30s': '1s',
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };
    const bInterval = binanceKlineMap[selectedInterval] || '1m';
    const binanceStreamSym = isGoldSymbol(s)
      ? 'paxgusdt'
      : (s.endsWith('USDT') ? s.toLowerCase() : 'btcusdt');

    // Store state of latest 24h ticker metrics so kline ticks retain 24h context
    let latest24h = {
      open: null,
      high: null,
      low: null,
      prevClose: null,
      changePct: 0.0,
      vol: 0,
    };

    // Binance edge/endpooint fallbacks: some networks/ISPs block :9443 or a
    // specific edge POP. Rotate on failed attempts. The backend WS keeps
    // ~1Hz crypto ticks flowing meanwhile, so the chart never goes stale.
    // NOTE: @aggTrade (10-100+/sec on BTC) intentionally NOT subscribed —
    // @ticker (1s) + @kline carry the same price with far less jank; the
    // render-free tick bus + rAF coalescing already saturate at 60 FPS.
    const streams = `${binanceStreamSym}@ticker/${binanceStreamSym}@kline_${bInterval}`;
    const cryptoWsUrls = [
      `wss://stream.binance.com:9443/stream?streams=${streams}`,
      `wss://stream.binance.com:443/stream?streams=${streams}`,
      `wss://data-stream.binance.vision/stream?streams=${streams}`,
    ];
    let urlIdx = 0;
    let backoffMs = 2000;
    const BACKOFF_MAX = 30000;

    const connectCryptoWs = () => {
      if (!active) return;
      try {
        const streamUrl = cryptoWsUrls[urlIdx % cryptoWsUrls.length];
        let didOpen = false;
        let gotMessage = false;
        ws = new WebSocket(streamUrl);
        cryptoWsRef.current = ws;

        ws.onopen = () => { didOpen = true; };

        ws.onmessage = (e) => {
          if (!active) return;
          // Healthy stream: reset backoff so the next failure retries fast.
          if (!gotMessage) { gotMessage = true; backoffMs = 2000; }
          try {
            const msg = JSON.parse(e.data);
            const stream = msg.stream || '';
            const data = msg.data;
            if (!data) return;

            if (stream.includes('@aggTrade')) {
              // High-frequency sub-second trade tick (TradingView-grade fluid animation)
              const tradePrice = parseFloat(data.p);
              const tradeQty = parseFloat(data.q);
              if (!isNaN(tradePrice) && tradePrice > 0) {
                emitLiveTick({
                  ticker: selectedSymbol.toUpperCase(),
                  price: tradePrice,
                  volume: !isNaN(tradeQty) ? tradeQty : 0,
                  time: data.T,
                });
              }
            } else if (stream.includes('@ticker')) {
              // 24h rolling stats
              const ltp = parseFloat(data.c);
              const dayOpen = parseFloat(data.o);
              const dayHigh = parseFloat(data.h);
              const dayLow = parseFloat(data.l);
              const prevClose = parseFloat(data.x || data.o);
              const changePct = parseFloat(data.P);
              const vol = parseFloat(data.v);

              latest24h = {
                open: !isNaN(dayOpen) ? dayOpen : ltp,
                high: !isNaN(dayHigh) ? dayHigh : ltp,
                low: !isNaN(dayLow) ? dayLow : ltp,
                prevClose: !isNaN(prevClose) ? prevClose : ltp,
                changePct: !isNaN(changePct) ? changePct : 0.0,
                vol: !isNaN(vol) ? vol : 0,
              };

              if (!isNaN(ltp) && ltp > 0) {
                const existingCandle = useStore.getState().livePrices?.[selectedSymbol.toUpperCase()]?.liveCandle;
                const tickPayload = {
                  ticker: selectedSymbol.toUpperCase(),
                  price: ltp,
                  open: latest24h.open,
                  high: latest24h.high,
                  low: latest24h.low,
                  close: latest24h.prevClose,
                  change_pct: latest24h.changePct,
                  volume: latest24h.vol,
                  is_live: true,
                  liveCandle: existingCandle,
                };
                setLivePrice(selectedSymbol.toUpperCase(), tickPayload);
                setWsLiveData(true);
                emitLiveTick(tickPayload);
                onMessageRef.current?.(tickPayload);
              }
            } else if (stream.includes('@kline')) {
              // Real-time active candle (kline)
              const k = data.k;
              if (k) {
                const openTimeMs = k.t;
                const isIntraday = selectedInterval !== '1d';
                // Daily buckets are IST (backend fetcher astimezone(_IST)) —
                // UTC date would attach 00:00–05:30 IST ticks to yesterday's bar.
                const chartTime = isIntraday
                  ? Math.floor(openTimeMs / 1000)
                  : new Date(Number(openTimeMs) + 5.5 * 3600 * 1000).toISOString().substring(0, 10);

                const cClose = parseFloat(k.c);
                const cOpen = parseFloat(k.o);
                const cHigh = parseFloat(k.h);
                const cLow = parseFloat(k.l);
                const cVol = parseFloat(k.v);

                if (!isNaN(cClose) && cClose > 0) {
                  const liveCandle = {
                    time: chartTime,
                    open: !isNaN(cOpen) ? cOpen : cClose,
                    high: !isNaN(cHigh) ? cHigh : cClose,
                    low: !isNaN(cLow) ? cLow : cClose,
                    close: cClose,
                    volume: !isNaN(cVol) ? cVol : 0,
                    isClosed: Boolean(k.x),
                  };

                  const tickPayload = {
                    ticker: selectedSymbol.toUpperCase(),
                    price: cClose,
                    open: latest24h.open || cOpen,
                    high: Math.max(latest24h.high || cHigh, cHigh),
                    low: Math.min(latest24h.low || cLow, cLow),
                    close: latest24h.prevClose || cOpen,
                    change_pct: latest24h.changePct,
                    volume: latest24h.vol || cVol,
                    is_live: true,
                    liveCandle,
                  };

                  setLivePrice(selectedSymbol.toUpperCase(), tickPayload);
                  setWsLiveData(true);
                  emitLiveTick(tickPayload);
                  onMessageRef.current?.(tickPayload);
                }
              }
            }
          } catch (_) {}
        };

        ws.onerror = () => {
          try { ws.close(); } catch (_) {}
        };

        ws.onclose = () => {
          if (active) {
            // Never established (browser: "closed before the connection is
            // established") → rotate to the next endpoint/edge.
            if (!didOpen) urlIdx += 1;
            const jitter = Math.random() * 1000;
            const wait = Math.min(backoffMs + jitter, BACKOFF_MAX);
            backoffMs = Math.min(backoffMs * 1.6, BACKOFF_MAX);
            reconnectTimer = setTimeout(connectCryptoWs, wait);
          }
        };
      } catch (_) {}
    };

    connectCryptoWs();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
      cryptoWsRef.current = null;
    };
  }, [selectedSymbol, selectedInterval, setLivePrice, setWsLiveData]);

  return connected;
}
