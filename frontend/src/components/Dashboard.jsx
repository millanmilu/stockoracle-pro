import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import StockChart from './StockChart';
import AIInsightCard from './AIInsightCard';
import api from '../utils/api';
import { 
  TrendingUp, TrendingDown, Activity, ArrowUpRight, 
  CandlestickChart, BrainCircuit, BarChart3, ShieldCheck, RefreshCw,
  Target, Landmark, Gauge, CircleDollarSign
} from 'lucide-react';

const formatValue = (value, suffix = '') => {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`;
};

const formatCurrency = (value) => {
  if (value == null || value === '') return '—';
  return String(value).includes('₹') ? value : `₹${formatValue(value)}`;
};

function MetricTile({ label, value, tone = '#F8FAFC', sub }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: 10, padding: '11px 13px', minWidth: 0 }}>
      <div style={{ color: '#64748B', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: tone, fontSize: '1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ color: '#64748B', fontSize: '0.62rem', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, icon: Icon, children, action }) {
  return (
    <section style={{ background: 'rgba(8,13,30,0.86)', border: '1px solid rgba(148,163,184,0.13)', borderRadius: 12, padding: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#CBD5E1', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {Icon && <Icon size={14} color="#818CF8" />}{title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);
  const historyCache = useStore(s => s.historyCache);
  const setHistoryCache = useStore(s => s.setHistoryCache);
  const { fetchHistory } = useStock();
  const [interval, setInterval] = useState('1d');
  const [localLoading, setLocalLoading] = useState(false);
  const [overview, setOverview] = useState({ fundamentals: null, financials: null, levels: null, prediction: null, valuation: null });
  const [overviewLoading, setOverviewLoading] = useState(false);

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

  useEffect(() => {
    let active = true;
    setOverviewLoading(true);
    Promise.allSettled([
      api.get(`/api/stock/${selectedSymbol}/fundamentals`),
      api.get(`/api/stock/${selectedSymbol}/financials`),
      api.get(`/api/stock/${selectedSymbol}/levels`),
      api.get(`/api/stock/${selectedSymbol}/predict`),
      api.get(`/api/stock/${selectedSymbol}/valuation`),
    ]).then(([fundamentals, financials, levels, prediction, valuation]) => {
      if (!active) return;
      const value = (result) => result.status === 'fulfilled' ? result.value.data : null;
      setOverview({ fundamentals: value(fundamentals), financials: value(financials), levels: value(levels), prediction: value(prediction), valuation: value(valuation) });
    }).finally(() => active && setOverviewLoading(false));
    return () => { active = false; };
  }, [selectedSymbol]);

  const lastBar = history && history.length > 0 ? history[history.length - 1] : null;
  const prevBar = history && history.length > 1 ? history[history.length - 2] : null;

  const currentPrice = lastBar && typeof lastBar.close === 'number' ? lastBar.close : null;
  const prevClose = prevBar && typeof prevBar.close === 'number' ? prevBar.close : null;

  const priceChange = currentPrice !== null && prevClose !== null ? currentPrice - prevClose : null;
  const pctChange = priceChange !== null && prevClose ? (priceChange / prevClose) * 100 : null;
  const isUp = (priceChange ?? 0) >= 0;
  const isLoading = localLoading && !history;
  const { fundamentals, financials, levels, prediction, valuation } = overview;
  const latestQuarter = financials?.quarterly_results?.at(-1) || {};
  const signal = prediction?.signal || '—';
  const signalTone = signal.includes('BUY') ? '#10B981' : signal.includes('SELL') ? '#EF5350' : '#F59E0B';
  const overviewPrice = levels?.current_price ?? prediction?.current_price ?? currentPrice;

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
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#F0F0FF', letterSpacing: '-0.01em' }}>
              {selectedSymbol}
            </h1>
            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '5px', background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', fontWeight: 700 }}>
              NSE EQUITIES
            </span>
          </div>

          {overviewPrice !== null && overviewPrice !== undefined ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
                {formatCurrency(overviewPrice)}
              </span>
              {priceChange !== null && pctChange !== null && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,83,80,0.12)',
                  border: `1px solid ${isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,83,80,0.3)'}`,
                  color: isUp ? '#10B981' : '#EF5350',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                }}>
                  {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>{isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{pctChange.toFixed(2)}%)</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>Fetching market data…</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 9 }}>
        <MetricTile label="Market Cap" value={formatCurrency(fundamentals?.market_cap)} />
        <MetricTile label="P/E" value={formatValue(fundamentals?.pe_ratio)} />
        <MetricTile label="ROE" value={formatValue(fundamentals?.roe, '%')} />
        <MetricTile label="ROCE" value={formatValue(fundamentals?.roce, '%')} />
        <MetricTile label="EPS" value={formatCurrency(fundamentals?.eps)} />
        <MetricTile label="Dividend Yield" value={formatValue(fundamentals?.dividend_yield, '%')} />
        <MetricTile label="AI Signal" value={signal} tone={signalTone} sub={prediction?.predicted_return_pct != null ? `${formatValue(prediction.predicted_return_pct, '%')} forecast` : undefined} />
        <MetricTile label="Valuation" value={valuation?.valuation_status || '—'} tone={valuation?.valuation_status === 'OVERVALUED' ? '#F59E0B' : '#10B981'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Panel title="Technical & Risk" icon={Gauge} action={overviewLoading && <RefreshCw size={13} color="#64748B" className="spin" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
            <MetricTile label="52W High" value={formatCurrency(levels?.period_high)} />
            <MetricTile label="52W Low" value={formatCurrency(levels?.period_low)} />
            <MetricTile label="Support S1" value={formatCurrency(levels?.daily_pivots?.classic?.S1)} />
            <MetricTile label="Resistance R1" value={formatCurrency(levels?.daily_pivots?.classic?.R1)} />
            <MetricTile label="Prediction Low" value={formatCurrency(prediction?.low_bound)} />
            <MetricTile label="Prediction High" value={formatCurrency(prediction?.high_bound)} />
          </div>
        </Panel>

        <Panel title="Fundamental Health" icon={Landmark}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
            <MetricTile label="Latest Sales" value={formatValue(latestQuarter.Sales ?? latestQuarter.revenue, ' Cr')} />
            <MetricTile label="Net Profit" value={formatValue(latestQuarter['Net Profit'] ?? latestQuarter.net_profit, ' Cr')} />
            <MetricTile label="OPM" value={formatValue(latestQuarter['OPM %'], '%')} />
            <MetricTile label="Sector" value={financials?.sector || '—'} />
            <MetricTile label="Data Source" value={fundamentals?.data_source || '—'} />
            <MetricTile label="Updated" value={fundamentals?.last_updated?.slice(0, 10) || '—'} />
          </div>
        </Panel>

        <Panel title="Valuation & Action" icon={Target}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
            <MetricTile label="DCF Value" value={formatCurrency(valuation?.dcf_intrinsic_value)} />
            <MetricTile label="Blended Value" value={formatCurrency(valuation?.blended_fair_value)} />
            <MetricTile label="Margin of Safety" value={formatValue(valuation?.margin_of_safety_pct, '%')} tone={(valuation?.margin_of_safety_pct ?? 0) >= 0 ? '#10B981' : '#EF5350'} />
            <MetricTile label="7D Forecast" value={formatCurrency(prediction?.predicted_price_7d ?? prediction?.predicted_price)} tone={signalTone} />
          </div>
          <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 8, background: `${signalTone}12`, border: `1px solid ${signalTone}44`, color: signalTone, fontSize: '0.72rem', fontWeight: 800 }}>
            {signal === '—' ? 'Action signal unavailable' : `${signal} | ${prediction?.model_type || 'Statistical trend model'}`}
          </div>
        </Panel>
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
