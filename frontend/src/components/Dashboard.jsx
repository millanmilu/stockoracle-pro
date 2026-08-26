import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import StockChart from './StockChart';
import AIInsightCard from './AIInsightCard';
import { 
  TrendingUp, TrendingDown, Activity, ArrowUpRight, 
  CandlestickChart, BrainCircuit, BarChart3, ShieldCheck
} from 'lucide-react';

function SkeletonChart() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ width: 90, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div style={{ width: 60, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </div>
      <div style={{ flex: 1, minHeight: 300, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)' }} />
    </div>
  );
}

export default function Dashboard() {
  const { selectedSymbol, setActiveView, historyCache, setHistoryCache } = useStore();
  const { fetchHistory } = useStock();
  const [interval, setInterval] = useState('1d');
  const [localLoading, setLocalLoading] = useState(false);

  const cacheKey = `${selectedSymbol}_${interval}`;
  const history = historyCache[cacheKey] || null;

  // Load history — uses cache to avoid re-fetching on view switch
  useEffect(() => {
    if (historyCache[cacheKey]) return;
    setLocalLoading(true);
    fetchHistory(selectedSymbol, interval).then(result => {
      const candles = result?.candles ?? [];
      if (candles.length > 0) setHistoryCache(cacheKey, candles);
      setLocalLoading(false);
    });
  }, [selectedSymbol, interval]);

  const lastBar = history && history.length > 0 ? history[history.length - 1] : null;
  const prevBar = history && history.length > 1 ? history[history.length - 2] : null;

  const currentPrice = lastBar && typeof lastBar.close === 'number' ? lastBar.close : null;
  const prevClose = prevBar && typeof prevBar.close === 'number' ? prevBar.close : null;

  const priceChange = currentPrice !== null && prevClose !== null ? currentPrice - prevClose : null;
  const pctChange = priceChange !== null && prevClose ? (priceChange / prevClose) * 100 : null;
  const isUp = (priceChange ?? 0) >= 0;
  const isLoading = localLoading && !history;

  return (
    <div className="glass-card" style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(99,102,241,0.18)' }}>

      {/* ── Asset Hero & Quick Metrics ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(30,27,75,0.4) 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '16px',
        padding: 'clamp(14px, 2.5vw, 20px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}>
        {/* Left: Ticker & Live Price */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.3rem, 4vw, 1.85rem)', fontWeight: 800, color: '#F0F0FF', letterSpacing: '-0.02em' }}>
              {selectedSymbol}
            </h1>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', fontWeight: 700 }}>
              NSE EQUITIES
            </span>
          </div>

          {currentPrice !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'Space Grotesk, sans-serif' }}>
                ₹{currentPrice.toFixed(2)}
              </span>
              {priceChange !== null && pctChange !== null && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,83,80,0.12)',
                  border: `1px solid ${isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,83,80,0.3)'}`,
                  color: isUp ? '#10B981' : '#EF5350',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}>
                  {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{pctChange.toFixed(2)}%)</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '6px' }}>Fetching market data…</div>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveView('Live Chart')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.12)',
              color: '#818CF8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <CandlestickChart size={15} /> Pro Charting
          </button>

          <button
            onClick={() => setActiveView('AI Prediction')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
            }}
          >
            <BrainCircuit size={15} /> AI Forecast
          </button>
        </div>
      </div>

      {/* ── Main Chart Card ── */}
      <div style={{
        backgroundColor: 'var(--bg-card, #0C1022)',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid var(--border, rgba(99,102,241,0.15))',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Price Trend & Moving Averages (20 / 50 SMA)
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6366F1', fontWeight: 600 }}>
            {interval ? interval.toUpperCase() : '1D'} INTERVAL
          </div>
        </div>

        {isLoading ? (
          <SkeletonChart />
        ) : history ? (
          <StockChart history={history} interval={interval} onIntervalChange={setInterval} />
        ) : (
          <div style={{ color: '#888', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            No chart data available.
          </div>
        )}
      </div>

      {/* ── AI Insight Card below chart ── */}
      <AIInsightCard />

    </div>
  );
}
