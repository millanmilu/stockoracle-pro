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
      setError(e.response?.data?.detail || 'Failed to fetch stock info');
      return null;
    } finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async (ticker, interval = '1d') => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/history`, { params: { interval } });
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
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
      const { data } = await api.post(`/api/stock/${ticker}/train`);
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
    try {
      const { data } = await api.get(`/api/stock/search/${query.toUpperCase()}`);
      return data;
    } catch (e) { return { found: false, ticker: query.toUpperCase(), name: query.toUpperCase() }; }
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

  return {
    loading, error,
    fetchInfo, fetchHistory, fetchPredict, fetchMonteCarlo, fetchAnomalies,
    fetchScreener, fetchBacktest, fetchPatterns, fetchLevels, fetchVolatility,
    searchStock, searchStocks, fetchNews, startTraining, fetchTrainingStatus,
  };
}
