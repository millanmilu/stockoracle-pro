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

  const fetchHistory = useCallback(async (ticker, interval = '1d', timeframe = null) => {
    setHistoryError(null);
    // Never request an interval the backend rejects (422) — normalize first
    // so callers can never blank the chart with e.g. '3m'.
    const cleanInterval = normalizeInterval(interval, '1d');
    try {
      const params = { interval: cleanInterval };
      if (timeframe) params.timeframe = timeframe;
      const { data } = await api.get(`/api/stock/${ticker}/history`, { params });
      // API returns { data: [...], data_source: "angel_one" | "sqlite" | ... }
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        return { candles: data.data, dataSource: data.data_source || 'unknown' };
      }
      if (Array.isArray(data) && data.length > 0) {
        return { candles: data, dataSource: 'unknown' };
      }
    } catch (e) {
      // Backend not running or error; proceed to check crypto fallback
    }

    // Client-side fallback for Crypto/Commodity (e.g. BTC, XAUUSD) via Binance public klines API
    const isCrypto = ticker && isCryptoSymbol(ticker);

    if (isCrypto) {
      try {
        const binanceIvMap = {
          '1s': '1s', '30s': '1m', '1m': '1m', '5m': '5m',
          '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d'
        };
        const bIv = binanceIvMap[cleanInterval] || '1d';
        const bSymbol = isGoldSymbol(ticker) ? 'PAXGUSDT' : (ticker.toUpperCase().endsWith('USDT') ? ticker.toUpperCase() : 'BTCUSDT');
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${bIv}&limit=500`);
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          const isIntraday = cleanInterval !== '1d';
          const candles = json.map(k => {
            const timeMs = k[0];
            const d = new Date(timeMs);
            const dateVal = isIntraday
              ? Math.floor(timeMs / 1000)
              : d.toISOString().substring(0, 10);
            return {
              date: dateVal,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            };
          });
          return { candles, dataSource: 'binance_live' };
        }
      } catch (_) {}
    }

    setHistoryError('Failed to load historical candles');
    return { candles: [], dataSource: 'error' };
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
