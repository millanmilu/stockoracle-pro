import api from '../utils/api';
import { useState, useCallback } from 'react';

export function useStock() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchInfo = useCallback(async (ticker) => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get(`/api/stock/${ticker}/info`);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Failed to fetch stock info';
      setError(msg);
      console.error(`[useStock] fetchInfo(${ticker}) failed:`, msg, e);
      return null;
    } finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async (ticker, timeframe = '3M', interval = '1d') => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/history`, { params: { timeframe, interval } });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(`[useStock] fetchHistory(${ticker}, ${timeframe}, ${interval}) failed:`, e.response?.data?.detail || e.message, e);
      return [];
    }
  }, []);

  const fetchPredict = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/predict`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchPredict(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchMonteCarlo = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/montecarlo`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchMonteCarlo(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchAnomalies = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/anomalies`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchAnomalies(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return [];
    }
  }, []);

  const fetchScreener = useCallback(async (signal = '', minScore = 0) => {
    try {
      const { data } = await api.get('/api/screener', { params: { signal, min_score: minScore } });
      return data;
    } catch (e) {
      console.error(`[useStock] fetchScreener(signal=${signal}, minScore=${minScore}) failed:`, e.response?.data?.detail || e.message, e);
      return [];
    }
  }, []);

  const startTraining = useCallback(async (ticker) => {
    try {
      const { data } = await api.post(`/api/stock/${ticker}/train`);
      return data;
    } catch (e) {
      console.error(`[useStock] startTraining(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchTrainingStatus = useCallback(async (taskId) => {
    try {
      const { data } = await api.get(`/api/task/${taskId}/status`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchTrainingStatus(${taskId}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchBacktest = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/backtest`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchBacktest(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchPatterns = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/patterns`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchPatterns(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchLevels = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/levels`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchLevels(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const fetchVolatility = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/volatility`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchVolatility(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const searchStock = useCallback(async (query) => {
    try {
      const { data } = await api.get(`/api/stock/search/${query.toUpperCase()}`);
      return data;
    } catch (e) {
      console.error(`[useStock] searchStock(${query}) failed:`, e.response?.data?.detail || e.message, e);
      return { found: false, ticker: query.toUpperCase(), name: query.toUpperCase() };
    }
  }, []);

  const searchStocks = useCallback(async (query) => {
    try {
      const { data } = await api.get('/api/stocks/search', { params: { query, limit: 12 } });
      return data;
    } catch (e) {
      console.error(`[useStock] searchStocks(${query}) failed:`, e.response?.data?.detail || e.message, e);
      return [];
    }
  }, []);

  const fetchNews = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/news`);
      return data;
    } catch (e) {
      console.error(`[useStock] fetchNews(${ticker}) failed:`, e.response?.data?.detail || e.message, e);
      return { items: [] };
    }
  }, []);

  // ── Portfolio (server-persisted) ──────────────────────────────────────────
  const fetchPortfolio = useCallback(async (userId = 'default') => {
    try {
      const { data } = await api.get('/api/portfolio', { params: { user_id: userId } });
      return data;
    } catch (e) {
      console.error('[useStock] fetchPortfolio failed:', e.response?.data?.detail || e.message, e);
      return [];
    }
  }, []);

  const addPortfolioItem = useCallback(async (ticker, quantity, buyPrice, userId = 'default') => {
    try {
      const { data } = await api.post('/api/portfolio', { ticker, quantity, buy_price: buyPrice, user_id: userId });
      return data;
    } catch (e) {
      console.error('[useStock] addPortfolioItem failed:', e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const removePortfolioItem = useCallback(async (itemId, userId = 'default') => {
    try {
      const { data } = await api.delete(`/api/portfolio/${itemId}`, { params: { user_id: userId } });
      return data;
    } catch (e) {
      console.error('[useStock] removePortfolioItem failed:', e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  // ── Price Alerts (server-persisted) ──────────────────────────────────────
  const fetchAlerts = useCallback(async (userId = 'default') => {
    try {
      const { data } = await api.get('/api/alerts', { params: { user_id: userId } });
      return data;
    } catch (e) {
      console.error('[useStock] fetchAlerts failed:', e.response?.data?.detail || e.message, e);
      return [];
    }
  }, []);

  const addAlert = useCallback(async (ticker, condition, threshold, userId = 'default') => {
    try {
      const { data } = await api.post('/api/alerts', { ticker, condition, threshold, user_id: userId });
      return data;
    } catch (e) {
      console.error('[useStock] addAlert failed:', e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  const removeAlert = useCallback(async (alertId, userId = 'default') => {
    try {
      const { data } = await api.delete(`/api/alerts/${alertId}`, { params: { user_id: userId } });
      return data;
    } catch (e) {
      console.error('[useStock] removeAlert failed:', e.response?.data?.detail || e.message, e);
      return null;
    }
  }, []);

  return {
    loading, error,
    fetchInfo, fetchHistory, fetchPredict, fetchMonteCarlo, fetchAnomalies,
    fetchScreener, fetchBacktest, fetchPatterns, fetchLevels, fetchVolatility,
    searchStock, searchStocks, fetchNews, startTraining, fetchTrainingStatus,
    // Server-persisted portfolio & alerts
    fetchPortfolio, addPortfolioItem, removePortfolioItem,
    fetchAlerts, addAlert, removeAlert,
  };
}
