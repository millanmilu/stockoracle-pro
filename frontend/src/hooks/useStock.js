import api from '../utils/api';
import { useState, useCallback } from 'react';
import { isGoldSymbol, isCryptoSymbol, normalizeInterval } from '../utils/chartHelpers';

export function useStock() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [historyError, setHistoryError] = useState(null);

  const fetchInfo = useCallback(async (ticker) => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get(`/api/stock/${ticker}/info`);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Failed to fetch stock info';
      setError(msg);
      return null;
    } finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async (ticker, interval = '1d', timeframe = null, opts = null) => {
    setHistoryError(null);
    // Never request an interval the backend rejects (422) — normalize first
    // so callers can never blank the chart with e.g. '3m'.
    const cleanInterval = normalizeInterval(interval, '1d');
    // Cursor pagination for left-pan backfill: `before` (exclusive upper bound =
    // oldest loaded candle: epoch seconds intraday, 'YYYY-MM-DD' daily) + `limit`.
    // `slim: true` requests OHLCV-only rows (skips server enrich, ~10x smaller)
    // for instant first paint; the caller re-requests the full frame after.
    const cursorBefore = opts?.before ?? null;
    const cursorLimit = opts?.limit != null ? Math.max(50, Math.min(5000, Math.floor(Number(opts.limit)))) : null;
    const slimOnly = opts?.slim === true;
    let backendDetail = null;
    try {
      const params = { interval: cleanInterval };
      if (timeframe) params.timeframe = timeframe;
      if (cursorBefore != null) params.before = cursorBefore;
      if (cursorLimit != null) params.limit = cursorLimit;
      if (slimOnly) params.slim = true;
      const { data } = await api.get(`/api/stock/${ticker}/history`, { params });
      // API returns { data: [...], data_source: "angel_one" | "sqlite" | ... }
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        return { candles: data.data, dataSource: data.data_source || 'unknown', hasMore: data.has_more ?? null };
      }
      if (data && Array.isArray(data.data) && data.data.length === 0) {
        return { candles: [], dataSource: data.data_source || 'unknown', hasMore: false };
      }
      if (Array.isArray(data) && data.length > 0) {
        return { candles: data, dataSource: 'unknown', hasMore: null };
      }
      backendDetail = data?.detail || 'Empty history response';
    } catch (e) {
      // Preserve the real reason (503 broker-offline vs 404 unknown ticker vs
      // network down) instead of swallowing it — callers surface it in the UI.
      backendDetail = e?.response?.data?.detail || e?.message || 'Backend unreachable';
      const status = e?.response?.status;
      // Only crypto/commodity symbols have a client-side fallback; equities
      // must fail loudly so a wrong instrument is never plotted silently.
      const isCryptoLike = ticker && isCryptoSymbol(ticker);
      if (!isCryptoLike) {
        const msg = status === 503
          ? `Live data unavailable (${backendDetail})`
          : backendDetail;
        setHistoryError(msg);
        const err = new Error(msg);
        err.status = status || 0;
        err.detail = backendDetail;
        throw err;
      }
    }

    // Client-side fallback for Crypto/Commodity (e.g. BTC, XAUUSD) via Binance public klines API.
    // Timeframe-aware + paginated (endTime walk-back, max 12 pages) so left-pan
    // backfills (5D -> 1M -> ...) actually gain older bars instead of returning
    // the same latest-1000 slice every time (which instantly marked backfill exhausted).
    const isCrypto = ticker && isCryptoSymbol(ticker);

    if (isCrypto) {
      try {
        const binanceIvMap = {
          '1s': '1s', '30s': '1m', '1m': '1m', '5m': '5m',
          '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d'
        };
        const bIv = binanceIvMap[cleanInterval] || '1d';
        const isGold = isGoldSymbol(ticker);
        const bSymbol = isGold ? 'PAXGUSDT' : (ticker.toUpperCase().endsWith('USDT') ? ticker.toUpperCase() : 'BTCUSDT');
        // Requested window in days — mirrors backend _crypto_period_days + days_map
        // (5D->7D, 1M->45D, 3M->120D, 6M->200D, 1Y->370D, 2Y->2Y, 5Y->5Y, ALL->45 intraday cap).
        const tfUpper = String(timeframe || '').toUpperCase();
        const tfDays = { '1D': 2, '5D': 7, '1W': 10, '1M': 45, '3M': 120, '6M': 200, '1Y': 370, '2Y': 730, '5Y': 1825 }[tfUpper]
          ?? (cleanInterval === '1d' ? 9000 : 45);
        const slotSec = { '1s': 1, '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 }[bIv] || 86400;
        const needed = Math.floor(tfDays * 86400 / slotSec) + 2;
        // Cursor cap: never fetch more than the requested older-history chunk.
        // On slim paint (instant cold load), fetch at most 1 page (1000 bars) so first paint is instant
        const cap = slimOnly ? Math.min(1000, needed) : (cursorLimit ?? needed);
        const maxPages = slimOnly ? 1 : Math.max(1, Math.min(12, Math.ceil(cap / 1000)));
        const pages = [];
        // Seed walk-back from the cursor (oldest loaded candle), not live edge.
        let endTime = null;
        if (cursorBefore != null) {
          const asNum = Number(cursorBefore);
          if (Number.isFinite(asNum) && asNum > 1e9) endTime = Math.floor(asNum * 1000) - 1;
          else {
            const asMs = Date.parse(String(cursorBefore));
            if (Number.isFinite(asMs)) endTime = asMs - 1;
          }
        }
        for (let p = 0; p < maxPages; p++) {
          const url = `https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${bIv}&limit=${Math.min(1000, cap)}`
            + (endTime ? `&endTime=${endTime}` : '');
          const res = await fetch(url);
          const json = await res.json();
          if (!Array.isArray(json) || json.length === 0) break;
          pages.push(json);
          const got = pages.reduce((n, pg) => n + pg.length, 0);
          if (json.length < 1000 || got >= cap) break;
          endTime = json[0][0] - 1; // page backwards before oldest kline
        }
        const json = pages.length === 1 ? pages[0] : pages.slice().reverse().flat();
        if (Array.isArray(json) && json.length > 0) {
          // Keep the most recent `cap` bars matching the requested window.
          const sliced = json.length > cap ? json.slice(json.length - cap) : json;
          const isIntraday = cleanInterval !== '1d';
          const candles = sliced.map(k => {
            const timeMs = k[0];
            // Daily buckets are IST (backend invariant) — never UTC.
            const dateVal = isIntraday
              ? Math.floor(timeMs / 1000)
              : new Date(timeMs + 5.5 * 3600 * 1000).toISOString().substring(0, 10);
            return {
              date: dateVal,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            };
          });
          // GOLD/XAUUSD is a PAXG token proxy, NOT spot gold — flag it so the
          // chart never mislabels a different instrument as GOLD.
          if (isGold) {
            return {
              candles,
              dataSource: 'binance_proxy_PAXG',
              proxySymbol: bSymbol,
              proxyWarning: 'GOLD shown via PAXGUSDT token proxy (Binance) — not spot XAUUSD',
              hasMore: sliced.length >= cap,
            };
          }
          return { candles, dataSource: 'binance_live', hasMore: sliced.length >= cap };
        }
      } catch (_) {}
    }

    const msg = backendDetail
      ? `Failed to load historical candles (${backendDetail})`
      : 'Failed to load historical candles';
    setHistoryError(msg);
    const err = new Error(msg);
    err.detail = backendDetail;
    throw err;
  }, []);

  const fetchPredict = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/predict`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchMonteCarlo = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/montecarlo`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchAnomalies = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/anomalies`);
      return data;
    } catch (e) { return []; }
  }, []);

  const fetchScreener = useCallback(async (signal = '', minScore = 0) => {
    try {
      const { data } = await api.get('/api/screener', { params: { signal, min_score: minScore } });
      return data;
    } catch (e) { return []; }
  }, []);

  const startTraining = useCallback(async (ticker) => {
    try {
      const { data } = await api.post(`/api/train/${ticker}`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchTrainingStatus = useCallback(async (taskId) => {
    try {
      const { data } = await api.get(`/api/task/${taskId}/status`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchBacktest = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/backtest`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchPatterns = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/patterns`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchLevels = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/levels`);
      return data;
    } catch (e) { return null; }
  }, []);

  const fetchVolatility = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/volatility`);
      return data;
    } catch (e) { return null; }
  }, []);

  const searchStock = useCallback(async (query) => {
    if (!query) return { found: false, ticker: '', name: '' };
    const q = String(query).toUpperCase();
    try {
      const { data } = await api.get(`/api/stock/search/${q}`);
      return data;
    } catch (e) { return { found: false, ticker: q, name: q }; }
  }, []);

  const searchStocks = useCallback(async (query) => {
    try {
      const { data } = await api.get('/api/stocks/search', { params: { query, limit: 12 } });
      return data;
    } catch (_) { return []; }
  }, []);

  const fetchNews = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/news`);
      return data;
    } catch (_) { return { items: [] }; }
  }, []);

  const preloadStock = useCallback(async (ticker) => {
    if (!ticker) return;
    try {
      await api.post(`/api/stock/${ticker}/preload`);
    } catch (_) {}
  }, []);

  return {
    loading, error, historyError,
    fetchInfo, fetchHistory, fetchPredict, fetchMonteCarlo, fetchAnomalies,
    fetchScreener, fetchBacktest, fetchPatterns, fetchLevels, fetchVolatility,
    searchStock, searchStocks, fetchNews, startTraining, fetchTrainingStatus,
    preloadStock,
  };
}
