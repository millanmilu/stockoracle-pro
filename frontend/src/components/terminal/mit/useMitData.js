import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useStore from '../../../store/useStore';
import api from '../../../utils/api';
import { enrichArticles } from './utils';

/* Multi-source parallel fetch · 45s live polling · force-refresh support */
const AI_CACHE = {};

export function useMitData() {
  const symbol = (useStore((s) => s.selectedSymbol) || 'RELIANCE').toUpperCase();
  const livePrices = useStore((s) => s.livePrices);
  const [news, setNews] = useState([]);
  const [newsMeta, setNewsMeta] = useState({ total: 0, label: 'NEUTRAL', score: 0, updatedAt: null });
  const [newsScope, setNewsScope] = useState('stock'); // 'stock' | 'market'
  const [ta, setTa] = useState(null);
  const [info, setInfo] = useState(null);
  const [hist, setHist] = useState([]);
  const [aiSum, setAiSum] = useState(null);
  const [mkt, setMkt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [freshId, setFreshId] = useState(0);
  const timer = useRef(null);

  const stamp = () => setUpdatedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST');

  const load = useCallback(async (isPoll, isForceRefresh = false) => {
    if (!isPoll) setLoading(true);
    setErr(null);
    try {
      const newsEndpoint = newsScope === 'market' ? '/api/market/news' : `/api/stock/${symbol}/news`;
      const newsParams = { limit: 45, refresh: isForceRefresh };

      const [n, t, i, h] = await Promise.all([
        api.get(newsEndpoint, { params: newsParams }).then((r) => r.data).catch(() => null),
        api.get(`/api/stock/${symbol}/sentiment-ta`, { params: { period: '3M' } }).then((r) => r.data).catch(() => null),
        api.get(`/api/stock/${symbol}/info`).then((r) => r.data).catch(() => null),
        api.get(`/api/stock/${symbol}/history`, { params: { interval: '1d', timeframe: '3M' } }).then((r) => r.data?.data || r.data || []).catch(() => []),
      ]);

      if (n?.items) {
        setNews((prev) => {
          if (prev.length && n.items[0] && prev[0]?.title !== n.items[0]?.title) setFreshId((f) => f + 1);
          return n.items;
        });
        setNewsMeta({
          total: n.total ?? n.items.length,
          label: n.sentiment_label || 'NEUTRAL',
          score: n.sentiment_score ?? 0,
          updatedAt: n.updated_at || new Date().toISOString(),
          sources: n.available_sources || []
        });
      }

      if (t && !t.error) setTa(t);
      if (i) setInfo(i);
      if (Array.isArray(h)) setHist(h);

      if (!isPoll || isForceRefresh) {
        api.get(`/api/stock/${symbol}/news-summary`).then((r) => r.data && setAiSum(r.data)).catch(() => {});
        api.get('/api/sentiment/market-overview').then((r) => r.data && setMkt(r.data)).catch(() => {});
      }
      stamp();
    } catch {
      if (!isPoll) setErr('Market data temporarily unavailable.');
    } finally {
      if (!isPoll) setLoading(false);
    }
  }, [symbol, newsScope]);

  useEffect(() => {
    if (AI_CACHE[symbol]) setAiSum(AI_CACHE[symbol]);
    load(false, false);
    clearInterval(timer.current);
    // Polling every 45s for fresh real-time news and market pulses
    timer.current = setInterval(() => load(true, false), 45000);
    return () => clearInterval(timer.current);
  }, [symbol, newsScope, load]);

  useEffect(() => {
    if (aiSum?.summary) AI_CACHE[symbol] = aiSum;
  }, [aiSum, symbol]);

  const refreshAI = useCallback(() => {
    setAiBusy(true);
    api.get(`/api/stock/${symbol}/news-summary`)
      .then((r) => {
        if (r.data) {
          setAiSum(r.data);
          AI_CACHE[symbol] = r.data;
        }
        stamp();
      })
      .catch(() => {})
      .finally(() => setAiBusy(false));
  }, [symbol]);

  const articles = useMemo(() => enrichArticles(news), [news]);

  return {
    symbol,
    articles,
    newsMeta,
    newsScope,
    setNewsScope,
    ta,
    info,
    hist,
    aiSum,
    mkt,
    loading,
    aiBusy,
    err,
    updatedAt,
    freshId,
    live: livePrices[symbol],
    livePrices,
    refreshAI,
    reload: (force = false) => load(false, force),
  };
}
