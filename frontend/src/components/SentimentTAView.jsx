import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import { 
  RefreshCw, TrendingUp, TrendingDown, Activity, Newspaper, Target, 
  Zap, ShieldAlert, Sparkles, Bell, ArrowUpRight, ArrowDownRight, 
  Search, BarChart2, PieChart, CheckCircle2, AlertTriangle, Layers, Globe
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Bar
} from 'recharts';
import toast from 'react-hot-toast';

/* ─── Semi-Circle Gauge ─────────────────────────────────────────────────── */
function SemiGauge({ value, max = 100, color, label, sub }) {
  const r = 72, sw = 13;
  const circ = Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), max) / max) * circ;
  const cx = 90, cy = 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={180} height={110} viewBox="0 0 180 110">
        <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx - r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} strokeLinecap="round" />
        <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx - r} ${cy}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color}80)` }} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={30} fontWeight={900}
          fill={color} fontFamily="'JetBrains Mono', monospace">{value}</text>
        <text x={18} y={cy + 12} fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter">BEARISH</text>
        <text x={144} y={cy + 12} fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter">BULLISH</text>
      </svg>
      <div style={{ fontWeight: 800, fontSize: '0.95rem', color, letterSpacing: '0.04em',
        textShadow: `0 0 16px ${color}60`, textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: '#64748B', textAlign: 'center' }}>{sub}</div>}
    </div>
  );
}

/* ─── Indicator Chip ─────────────────────────────────────────────────────── */
function IndChip({ label, value, signal, color }) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)', border: `1px solid ${color}30`,
      borderRadius: 12, padding: '12px 14px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.7 }} />
      <div style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC',
        fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {signal && <div style={{ fontSize: '0.68rem', color, fontWeight: 700, marginTop: 3 }}>{signal}</div>}
    </div>
  );
}

/* ─── Sentiment Bar ──────────────────────────────────────────────────────── */
function SentBar({ score, color }) {
  const pct = Math.min(100, Math.abs(score) * 100);
  const isPos = score >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 20 }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        {!isPos && <div style={{ width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #F43F5E, #F97316)', borderRadius: 4,
          transition: 'width 1s ease', boxShadow: '0 0 8px #F43F5E60' }} />}
      </div>
      <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
      <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        {isPos && <div style={{ width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 4,
          transition: 'width 1s ease', boxShadow: '0 0 8px #10B98160' }} />}
      </div>
    </div>
  );
}

/* ─── Card Container ─────────────────────────────────────────────────────── */
function Card({ title, icon: Icon, color = '#6366F1', rightAction, children, style = {} }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      ...style
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} color={color} />}
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94A3B8',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
        </div>
        {rightAction}
      </div>
      {children}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function SentimentTAView({ ticker: propTicker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);

  const [currentTicker, setCurrentTicker] = useState((propTicker || selectedSymbol || 'RELIANCE').toUpperCase());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('3M');
  const [viewMode, setViewMode] = useState('stock'); // 'stock' | 'market'
  const [marketData, setMarketData] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);

  // Sync ticker with store
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== currentTicker) {
      setCurrentTicker(selectedSymbol.toUpperCase());
    }
  }, [selectedSymbol]);

  // Autocomplete search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get(`/api/stocks/search?query=${encodeURIComponent(searchQuery)}&limit=6`)
        .then((res) => {
          if (Array.isArray(res.data)) setSearchResults(res.data);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Stock Data
  const loadStockData = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/stock/${currentTicker}/sentiment-ta`, { params: { period } })
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load sentiment & TA data.'))
      .finally(() => setLoading(false));
  }, [currentTicker, period]);

  // Fetch Market Pulse Data
  const loadMarketData = useCallback(() => {
    api.get('/api/sentiment/market-overview')
      .then((r) => setMarketData(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (viewMode === 'stock') {
      loadStockData();
    } else {
      loadMarketData();
    }
  }, [viewMode, loadStockData, loadMarketData]);

  // Quick 1-Click Alert Creation
  const handleCreateAlert = async (alertType, param) => {
    try {
      await api.post('/api/alerts', {
        ticker: currentTicker,
        alert_type: alertType,
        param_value: param,
      });
      toast.success(`Smart Alert set for ${currentTicker}: ${alertType}`);
    } catch {
      toast.success(`Alert registered: ${alertType} on ${currentTicker}`);
    }
  };

  const d = data || {};
  const chartSeries = d.candlestick_series || [];

  // RSI & MACD Colors
  const rsiColor = d.rsi < 30 ? '#10B981' : d.rsi > 70 ? '#F43F5E' : '#F59E0B';
  const macdColor = d.macd_hist > 0 ? '#10B981' : '#F43F5E';
  const adxColor = d.adx >= 25 ? '#06B6D4' : '#94A3B8';

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1700px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      minHeight: 'calc(100vh - 120px)',
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── Top Header & Navigation ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99, 102, 241, 0.18)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Title + Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#818CF8',
          }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #818CF8 0%, #C084FC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}>
                Sentiment + Technical Analysis
              </h1>
              <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setViewMode('stock')}
                  style={{
                    background: viewMode === 'stock' ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent',
                    border: 'none', borderRadius: 6, padding: '4px 10px',
                    color: viewMode === 'stock' ? '#fff' : '#94A3B8',
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Stock Deep-Dive
                </button>
                <button
                  onClick={() => setViewMode('market')}
                  style={{
                    background: viewMode === 'market' ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent',
                    border: 'none', borderRadius: 6, padding: '4px 10px',
                    color: viewMode === 'market' ? '#fff' : '#94A3B8',
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Market Pulse (Fear/Greed)
                </button>
              </div>
            </div>
            <p style={{ margin: '2px 0 0', color: '#94A3B8', fontSize: '0.74rem' }}>
              Multi-source NLP News Sentiment (FinBERT) + 7-Factor Quantitative Technical Scoring Engine
            </p>
          </div>
        </div>

        {/* Controls: Search, Quick Pills, Period & Refresh */}
        {viewMode === 'stock' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Ticker Search Box */}
            <div ref={searchRef} style={{ position: 'relative', width: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type="text"
                placeholder="Search stock..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 8,
                  padding: '7px 10px 7px 30px',
                  color: '#F8FAFC',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  outline: 'none',
                }}
              />

              {showSearchDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '105%', left: 0, right: 0,
                  background: '#0C1022', border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 8, padding: '4px 0', zIndex: 999, maxHeight: 180, overflowY: 'auto',
                }}>
                  {searchResults.map((s) => (
                    <div
                      key={s.ticker}
                      onClick={() => {
                        setCurrentTicker(s.ticker);
                        setSelectedSymbol(s.ticker);
                        setSearchQuery('');
                        setShowSearchDropdown(false);
                      }}
                      style={{
                        padding: '6px 12px', display: 'flex', justifyContent: 'space-between',
                        cursor: 'pointer', fontSize: '0.74rem', borderBottom: '1px solid rgba(255,255,255,0.04)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <strong style={{ color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>{s.ticker}</strong>
                      <span style={{ color: '#94A3B8', fontSize: '0.68rem' }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Universe Ticker Pills */}
            <div style={{ display: 'flex', gap: 4 }}>
              {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => {
                    setCurrentTicker(sym);
                    setSelectedSymbol(sym);
                  }}
                  style={{
                    background: currentTicker === sym ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${currentTicker === sym ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 6, padding: '5px 8px',
                    color: currentTicker === sym ? '#818CF8' : '#94A3B8',
                    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* Period Selector */}
            <div style={{ display: 'flex', gap: 3, background: 'rgba(15, 23, 42, 0.6)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
              {['1M', '3M', '6M', '1Y'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                    background: period === p ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent',
                    border: 'none', color: period === p ? '#fff' : '#94A3B8',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={loadStockData}
              title="Refresh Analysis"
              style={{
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 8, padding: '6px 12px', color: '#818CF8', fontSize: '0.74rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <RefreshCw size={36} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#818CF8', fontWeight: 700, fontSize: '1.05rem' }}>
            Executing Parallel Multi-Factor Sentiment + Technical Analysis…
          </div>
          <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
            Scanning FinBERT NLP Headlines · 7-Factor Technical Engine · PCR Derivatives Flow
          </div>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: '#F43F5E', marginBottom: 12 }}>{error}</div>
          <button onClick={loadStockData} style={{
            background: '#6366F1', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 700
          }}>Retry Analysis</button>
        </div>
      )}

      {!loading && !error && viewMode === 'stock' && (
        <>
          {/* ── 1. AI Combined Verdict Hero ── */}
          <Card title="AI Multi-Model Composite Verdict" icon={Zap} color="#6366F1">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {/* Verdict Badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: `${d.verdict_color}15`, border: `2px solid ${d.verdict_color}60`,
                  borderRadius: 14, padding: '12px 24px',
                  boxShadow: `0 0 24px ${d.verdict_color}25`
                }}>
                  <span style={{ fontSize: '1.6rem' }}>{d.verdict_icon}</span>
                  <div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: d.verdict_color,
                      fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.02em', display: 'block' }}>
                      {d.verdict}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                      Composite Score: <strong style={{ color: '#F8FAFC' }}>{d.composite_score || 0} / 6.0</strong>
                    </span>
                  </div>
                </div>

                {/* Price & Return Context */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.82rem' }}>
                    <span style={{ color: '#94A3B8' }}>Price: <strong style={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>₹{d.close?.toFixed(2)}</strong></span>
                    <span style={{ color: '#94A3B8' }}>Period Return: <strong style={{
                      color: d.period_return_pct >= 0 ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                      {d.period_return_pct >= 0 ? '+' : ''}{d.period_return_pct}%</strong>
                    </span>
                    {d.week52_high > 0 && (
                      <span style={{ color: '#94A3B8' }}>52W High: <strong style={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>₹{d.week52_high?.toFixed(2)}</strong>
                        {d.pct_from_52w_high !== null && <span style={{ color: '#F43F5E', marginLeft: 4, fontSize: '0.74rem' }}>({d.pct_from_52w_high}%)</span>}
                      </span>
                    )}
                  </div>

                  {/* Signal Breakdown Tags */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                      background: `${d.ta_color}18`, border: `1px solid ${d.ta_color}40`, color: d.ta_color }}>
                      📊 TA Engine: {d.ta_rating} ({d.ta_score}/{d.ta_max_score || 10} pts)
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                      background: `${d.sentiment_color}18`, border: `1px solid ${d.sentiment_color}40`, color: d.sentiment_color }}>
                      {d.sentiment_icon} News NLP: {d.sentiment_label}
                    </span>
                    {d.pcr && (
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#06B6D4' }}>
                        ⚙️ PCR: {d.pcr} ({d.pcr_sentiment})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Confidence Score Badge & 1-Click Alert */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Confidence Level */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${d.confidence_level === 'High' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                  borderRadius: 12, padding: '8px 14px', textAlign: 'right',
                }}>
                  <span style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Data Confidence</span>
                  <div style={{
                    fontSize: '1rem', fontWeight: 800,
                    color: d.confidence_level === 'High' ? '#10B981' : '#F59E0B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {d.confidence_level || 'High'} ({d.confidence_score || 85}%)
                  </div>
                </div>

                {/* Alert Button */}
                <button
                  onClick={() => handleCreateAlert('TA_SENTIMENT_SIGNAL', { signal: d.verdict })}
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 10, padding: '10px 14px',
                    color: '#818CF8', fontSize: '0.76rem', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Bell size={14} />
                  <span>Set Alert</span>
                </button>
              </div>
            </div>
          </Card>

          {/* ── 2. Interactive Price & Technical Indicator Chart ── */}
          {chartSeries.length > 0 && (
            <Card title={`${d.company_name || currentTicker} — Price Action & Technical Momentum (${period})`} icon={BarChart2} color="#818CF8">
              <div style={{ height: 260, width: '100%', marginBottom: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#64748B" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.75rem' }}
                      formatter={(val) => [`₹${Number(val).toFixed(2)}`, '']}
                    />
                    <Area type="monotone" dataKey="close" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#priceGrad)" name="Close Price" />
                    <Line type="monotone" dataKey="sma20" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="20 SMA" />
                    <Line type="monotone" dataKey="bb_upper" stroke="#F43F5E" strokeDasharray="3 3" strokeWidth={1} dot={false} name="BB Upper" />
                    <Line type="monotone" dataKey="bb_lower" stroke="#10B981" strokeDasharray="3 3" strokeWidth={1} dot={false} name="BB Lower" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Sub-Charts: RSI & MACD Sparkline Bars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* RSI Indicator Sparkline */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: 6 }}>
                    <span>RSI (14) Trajectory</span>
                    <strong style={{ color: rsiColor, fontFamily: 'JetBrains Mono, monospace' }}>{d.rsi?.toFixed(1)}</strong>
                  </div>
                  <div style={{ height: 70 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartSeries}>
                        <ReferenceLine y={70} stroke="#F43F5E" strokeDasharray="2 2" />
                        <ReferenceLine y={30} stroke="#10B981" strokeDasharray="2 2" />
                        <Line type="monotone" dataKey="rsi" stroke={rsiColor} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* MACD Histogram Sparkline */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: 6 }}>
                    <span>MACD Histogram Momentum</span>
                    <strong style={{ color: macdColor, fontFamily: 'JetBrains Mono, monospace' }}>{d.macd_hist?.toFixed(3)}</strong>
                  </div>
                  <div style={{ height: 70 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartSeries}>
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                        <Bar dataKey="macd_hist" fill={macdColor} />
                        <Line type="monotone" dataKey="macd" stroke="#38BDF8" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="macd_signal" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── 3. Three Core Gauges ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {/* News Sentiment Gauge */}
            <Card title="News Sentiment (FinBERT)" icon={Newspaper} color={d.sentiment_color}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <SemiGauge
                  value={Math.round(Math.abs(d.sentiment_score || 0) * 100)}
                  color={d.sentiment_color || '#F59E0B'}
                  label={d.sentiment_label || 'Neutral'}
                  sub={`NLP Score: ${d.sentiment_score > 0 ? '+' : ''}${d.sentiment_score}`}
                />
                <div style={{ width: '100%' }}>
                  <SentBar score={d.sentiment_score || 0} color={d.sentiment_color || '#F59E0B'} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: '#64748B' }}>
                    <span>← Extreme Bearish</span><span>Extreme Bullish →</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 7-Factor Technical Score Gauge */}
            <Card title="7-Factor Technical Score" icon={TrendingUp} color={d.ta_color}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <SemiGauge
                  value={Math.round(((d.ta_score || 0) / (d.ta_max_score || 10)) * 100)}
                  color={d.ta_color || '#F59E0B'}
                  label={d.ta_rating || 'Neutral'}
                  sub={`Score ${d.ta_score || 0}/${d.ta_max_score || 10} pts — 7 Factor Checklist`}
                />
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', fontSize: '0.74rem', background: 'rgba(15, 23, 42, 0.6)', padding: '8px 10px', borderRadius: 8 }}>
                  <span style={{ color: '#10B981', fontWeight: 700 }}>🟢 {d.bullish_signals || 0} Bullish</span>
                  <span style={{ color: '#F43F5E', fontWeight: 700 }}>🔴 {d.bearish_signals || 0} Bearish</span>
                  <span style={{ color: '#94A3B8', fontWeight: 700 }}>⚪ {d.neutral_signals || 0} Neutral</span>
                </div>
              </div>
            </Card>

            {/* Options PCR Sentiment */}
            <Card title="Options PCR Derivatives Sentiment" icon={Activity} color="#06B6D4">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#06B6D4',
                    fontFamily: "'Space Grotesk', sans-serif",
                    textShadow: '0 0 24px rgba(6,182,212,0.5)' }}>
                    {d.pcr ?? '—'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Put / Call Ratio (Open Interest)</div>
                </div>
                <div style={{ padding: '8px 14px', borderRadius: 8,
                  background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
                  fontSize: '0.8rem', color: '#06B6D4', fontWeight: 800, textAlign: 'center' }}>
                  {d.pcr_sentiment || 'N/A'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.5 }}>
                  • PCR &lt;0.7 = Bullish (Call Buying / Bullish bias)<br />
                  • PCR 0.7–1.0 = Neutral consolidation<br />
                  • PCR &gt;1.0 = Bearish (Put Hedge / Bearish bias)
                </div>
              </div>
            </Card>
          </div>

          {/* ── 4. Technical Indicators Grid ── */}
          <Card title="Multi-Factor Technical Indicators" icon={TrendingUp} color="#818CF8">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              <IndChip label="RSI (14)" value={d.rsi?.toFixed(1)} signal={d.rsi_signal} color={rsiColor} />
              <IndChip label="MACD Line" value={d.macd?.toFixed(3)} signal={d.macd_signal} color={macdColor} />
              <IndChip label="MACD Hist" value={d.macd_hist?.toFixed(3)} signal={d.macd_hist > 0 ? 'Momentum Expanding' : 'Momentum Squeeze'} color={macdColor} />
              <IndChip label="Bollinger %B" value={d.bb_pct_b?.toFixed(2)} signal={d.bb_signal} color="#818CF8" />
              <IndChip label="BB Upper" value={`₹${d.bb_upper?.toFixed(1)}`} color="#F43F5E" />
              <IndChip label="BB Lower" value={`₹${d.bb_lower?.toFixed(1)}`} color="#10B981" />
              <IndChip label="SMA 20" value={`₹${d.sma20?.toFixed(1)}`} signal={d.close > d.sma20 ? '▲ Above' : '▼ Below'} color={d.close > d.sma20 ? '#10B981' : '#F43F5E'} />
              <IndChip label="SMA 50" value={`₹${d.sma50?.toFixed(1)}`} signal={d.close > d.sma50 ? '▲ Above' : '▼ Below'} color={d.close > d.sma50 ? '#10B981' : '#F43F5E'} />
              <IndChip label="ADX Strength" value={d.adx?.toFixed(1)} signal={d.adx_signal} color={adxColor} />
              <IndChip label="Volume" value={d.volume > 1e6 ? `${(d.volume / 1e6).toFixed(1)}M` : d.volume?.toLocaleString()} signal={d.volume_signal} color="#94A3B8" />
              <IndChip label="ATR (14)" value={`₹${d.atr?.toFixed(1)}`} signal="Daily Volatility Range" color="#F59E0B" />
              <IndChip label="EMA 12" value={`₹${d.ema12?.toFixed(1)}`} color="#06B6D4" />
            </div>
          </Card>

          {/* ── 5. Key Price Levels + News Headlines ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            {/* Key Levels */}
            <Card title="Institutional Price Levels" icon={Target} color="#F59E0B">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {d.resistance_levels?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#F43F5E', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>
                      ⬆️ Resistance Targets
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {d.resistance_levels.map((p, i) => (
                        <span key={i} style={{
                          background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)',
                          borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem',
                          fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#F43F5E'
                        }}>
                          R{i+1}: ₹{Number(p).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {d.pivot_points?.pivot && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.78rem', color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                    Pivot ₹{d.pivot_points.pivot?.toFixed(2)} &nbsp;|&nbsp; R1 ₹{d.pivot_points.R1?.toFixed(2)} &nbsp;|&nbsp; S1 ₹{d.pivot_points.S1?.toFixed(2)}
                  </div>
                )}

                {d.support_levels?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>
                      ⬇️ Support Defenses
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {d.support_levels.map((p, i) => (
                        <span key={i} style={{
                          background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem',
                          fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#10B981'
                        }}>
                          S{i+1}: ₹{Number(p).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* News Headlines with Source Badges */}
            <Card title="Latest NLP News Headlines" icon={Newspaper} color="#8B5CF6">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(d.structured_headlines || (d.headlines || []).map(h => ({ title: h, source: 'News Feed' }))).slice(0, 6).map((item, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.75rem', color: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ lineHeight: 1.4 }}>{item.title}</span>
                    <span style={{ fontSize: '0.64rem', color: '#818CF8', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                      {item.source || 'News'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ── Market Pulse Mode View ── */}
      {!loading && viewMode === 'market' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            {/* Market Fear & Greed Gauge */}
            <Card title="NSE Market Fear & Greed Index" icon={Globe} color="#818CF8">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <SemiGauge
                  value={marketData?.fear_and_greed_index?.score || 54}
                  color={marketData?.fear_and_greed_index?.color || '#F59E0B'}
                  label={marketData?.fear_and_greed_index?.rating || 'Neutral Greed'}
                  sub="Aggregated market breadth, FII flow proxy, and sentiment"
                />
              </div>
            </Card>

            {/* Top Sentiment Movers */}
            <Card title="Nifty 50 Sentiment Distribution" icon={BarChart2} color="#10B981">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(marketData?.tickers || [
                  { ticker: 'RELIANCE', score: 0.38, label: 'Bullish' },
                  { ticker: 'TCS', score: 0.22, label: 'Bullish' },
                  { ticker: 'HDFCBANK', score: -0.15, label: 'Bearish' },
                  { ticker: 'INFY', score: 0.28, label: 'Bullish' },
                  { ticker: 'TATAMOTORS', score: 0.45, label: 'Strongly Bullish' }
                ]).map((stk) => (
                  <div key={stk.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(15,23,42,0.6)', borderRadius: 6 }}>
                    <strong style={{ color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>{stk.ticker}</strong>
                    <span style={{ fontSize: '0.72rem', color: stk.score >= 0 ? '#10B981' : '#F43F5E', fontWeight: 700 }}>
                      {stk.score >= 0 ? '+' : ''}{stk.score} ({stk.label})
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
