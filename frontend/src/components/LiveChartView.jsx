import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';

const API_BASE = import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org';
const WS_BASE  = API_BASE.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');

// Interval buttons (candle size)
const INTERVALS = [
  { label: '1m',  value: '1m'  },
  { label: '5m',  value: '5m'  },
  { label: '15m', value: '15m' },
  { label: '1H',  value: '1h'  },
  { label: '1D',  value: '1d'  },
];

// Period buttons (date range)
const PERIODS = [
  { label: '1D', value: '1D' },
  { label: '5D', value: '5D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '2Y', value: '2Y' },
];

// Default interval for each period
const DEFAULT_INTERVAL = {
  '1D': '5m', '5D': '15m', '1W': '1h',
  '1M': '1d', '3M': '1d', '6M': '1d', '1Y': '1d', '2Y': '1d',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtLabel(dateStr, interval = '1d') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // Intraday intervals → show time
  if (['1m','5m','15m','1h'].includes(interval)) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

// ── Custom Candlestick shape ──────────────────────────────────────────────────
// recharts Bar with dataKey=[min(open,close), max(open,close)] gives us a
// floating bar. y = pixel of top value, height = pixel distance to base.
function CandleShape(props) {
  const { x, y, width, height, payload } = props;
  if (!payload || payload.open == null) return null;

  const { open, close, high, low } = payload;
  const isGreen = close >= open;
  const color    = isGreen ? '#26A69A' : '#EF5350';

  const bodyHigh  = Math.max(open, close);
  const bodyLow   = Math.min(open, close);
  const bodyRange = bodyHigh - bodyLow;

  // Pixel-per-unit: derived from the bar body
  const absH = Math.abs(height);
  const ppu  = bodyRange > 0 ? absH / bodyRange : 1;

  // Wick positions
  const wickTopY = y - (high - bodyHigh) * ppu;
  const wickBotY = y + absH + (bodyLow - low)  * ppu;

  const cx  = x + width / 2;
  const bw  = Math.max(width * 0.65, 3);
  const bx  = x + (width - bw) / 2;
  const bh  = Math.max(absH, 1.5);           // min 1.5px so doji are visible

  return (
    <g>
      {/* Wick */}
      <line
        x1={cx} y1={wickTopY}
        x2={cx} y2={wickBotY}
        stroke={color} strokeWidth={1.2} opacity={0.75}
      />
      {/* Body */}
      <rect
        x={bx} y={y}
        width={bw} height={bh}
        fill={color} rx={0.5} opacity={0.88}
      />
    </g>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div style={{
      background : 'rgba(9,12,24,0.97)',
      border     : '1px solid rgba(168,85,247,0.28)',
      borderRadius: 10,
      padding    : '10px 14px',
      fontSize   : '0.78rem',
      fontFamily : 'JetBrains Mono, monospace',
      minWidth   : 160,
      boxShadow  : '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#6B7280', marginBottom: 7, fontSize: '0.72rem' }}>
        {d.date}
      </div>

      {/* OHLC block */}
      {d.open != null && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              { k: 'Open',  v: d.open,  c: '#9CA3AF' },
              { k: 'High',  v: d.high,  c: '#26A69A' },
              { k: 'Low',   v: d.low,   c: '#EF5350' },
              { k: 'Close', v: d.close, c: '#F0F0FF', bold: true },
            ].map(({ k, v, c, bold }) => (
              <tr key={k}>
                <td style={{ color: '#4B5563', paddingRight: 12 }}>{k}</td>
                <td style={{ color: c, fontWeight: bold ? 700 : 400, textAlign: 'right' }}>
                  ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Prediction block */}
      {d.predClose != null && (
        <div style={{
          marginTop  : 8,
          paddingTop : 8,
          borderTop  : '1px solid rgba(168,85,247,0.18)',
        }}>
          <div style={{ color: '#A855F7', fontWeight: 700, fontSize: '0.8rem' }}>
            🤖 AI Target: ₹{d.predClose.toFixed(2)}
          </div>
          {d.predUpper != null && (
            <div style={{ color: '#26A69A', marginTop: 3, fontSize: '0.73rem' }}>
              ↑ Upper: ₹{d.predUpper.toFixed(2)}
            </div>
          )}
          {d.predLower != null && (
            <div style={{ color: '#EF5350', fontSize: '0.73rem' }}>
              ↓ Lower: ₹{d.predLower.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Signal meta ───────────────────────────────────────────────────────────────
const SIG = {
  buy  : { label: '▲ BUY',  color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
  sell : { label: '▼ SELL', color: '#EF5350', bg: 'rgba(239,83,80,0.10)',  border: 'rgba(239,83,80,0.25)' },
  hold : { label: '◆ HOLD', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveChartView() {
  const { selectedSymbol }          = useStore();
  const { fetchHistory, fetchPredict } = useStock();

  const [period,       setPeriod]       = useState('3M');
  const [interval,     setInterval]     = useState('1d');
  const [rawHistory,   setRawHistory]   = useState(null);
  const [prediction,   setPrediction]   = useState(null);
  const [livePrice,    setLivePrice]    = useState(null);
  const [liveChange,   setLiveChange]   = useState(null);
  const [wsConnected,  setWsConnected]  = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [predLoading,  setPredLoading]  = useState(true);

  // Batch period + interval change → one single fetch
  const pendingRef = useRef(null);
  const handlePeriodChange = (p) => {
    const iv = DEFAULT_INTERVAL[p] || '1d';
    pendingRef.current = { period: p, interval: iv };
    setPeriod(p);
    setInterval(iv);
  };
  // Direct interval change keeps current period
  const handleIntervalChange = (iv) => {
    pendingRef.current = null; // no batch needed
    setInterval(iv);
  };

  const wsRef = useRef(null);

  // ── Data fetch (history + prediction) ──
  useEffect(() => {
    setLoading(true);
    setPredLoading(true);
    setRawHistory(null);
    setPrediction(null);
    setLivePrice(null);
    setLiveChange(null);

    fetchHistory(selectedSymbol, period, interval).then(hist => {
      setRawHistory(hist);
      setLoading(false);
    });

    // Only fetch prediction for daily intervals (intraday pred not supported)
    if (interval === '1d') {
      fetchPredict(selectedSymbol).then(pred => {
        setPrediction(pred);
        setPredLoading(false);
      });
    } else {
      setPrediction(null);
      setPredLoading(false);
    }
  }, [selectedSymbol, period, interval]);

  // Derive current price: WS live price > last candle close > prediction current_price
  const lastCandleClose = useMemo(() => {
    if (!rawHistory?.length) return null;
    return rawHistory[rawHistory.length - 1]?.close ?? null;
  }, [rawHistory]);

  const isDaily = interval === '1d';

  // ── WebSocket ──
  useEffect(() => {
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(`${WS_BASE}/ws/prices`);
    wsRef.current = ws;

    ws.onopen  = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = e => {
      try {
        const { ticker, price, change_pct } = JSON.parse(e.data);
        if (ticker === selectedSymbol) {
          setLivePrice(price);
          setLiveChange(change_pct);
        }
      } catch {}
    };

    // Keepalive ping every 20 s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 20_000);

    return () => { clearInterval(ping); ws.close(); };
  }, [selectedSymbol]);

  // ── Build chart data ──
  const chartData = useMemo(() => {
    if (!rawHistory?.length) return [];

    const hist = rawHistory.map(d => ({
      date      : d.date,
      label     : fmtLabel(d.date, interval),
      open      : d.open,
      high      : d.high,
      low       : d.low,
      close     : d.close,
      // recharts floating-bar requires [base, top]
      bodyRange : [Math.min(d.open, d.close), Math.max(d.open, d.close)],
      predClose : null,
      predUpper : null,
      predLower : null,
    }));

    // Patch last bar with live price
    if (livePrice) {
      const last = hist[hist.length - 1];
      last.close     = livePrice;
      last.high      = Math.max(last.high, livePrice);
      last.low       = Math.min(last.low,  livePrice);
      last.bodyRange = [Math.min(last.open, livePrice), Math.max(last.open, livePrice)];
    }

    // Append prediction future point
    if (prediction?.predicted_price_7d) {
      const lastClose = livePrice ?? hist[hist.length - 1].close;
      const lastDate  = hist[hist.length - 1].date;
      const futureDate = addBusinessDays(lastDate, 7);

      // Anchor prediction line from last historical close
      hist[hist.length - 1].predClose = lastClose;
      hist[hist.length - 1].predUpper = lastClose;
      hist[hist.length - 1].predLower = lastClose;

      hist.push({
        date      : futureDate,
        label     : `+7D`,
        open      : null, high: null, low: null, close: null,
        bodyRange : null,
        predClose : prediction.predicted_price_7d,
        predUpper : prediction.predicted_upper_price_7d ?? prediction.high_bound ?? prediction.predicted_price_7d * 1.025,
        predLower : prediction.predicted_lower_price_7d ?? prediction.low_bound  ?? prediction.predicted_price_7d * 0.975,
      });
    }

    return hist;
  }, [rawHistory, livePrice, prediction]);

  // ── Y-axis domain ──
  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'];
    const vals = chartData.flatMap(d => [d.high, d.low, d.predUpper, d.predLower])
      .filter(v => v != null && !isNaN(v));
    if (!vals.length) return ['auto', 'auto'];
    const mn  = Math.min(...vals);
    const mx  = Math.max(...vals);
    const pad = (mx - mn) * 0.09;
    return [Math.floor(mn - pad), Math.ceil(mx + pad)];
  }, [chartData]);

  // ── Confidence band X labels ──
  const bandX1 = chartData.length >= 2 ? chartData[chartData.length - 2]?.label : null;
  const bandX2 = chartData.length >= 1 ? chartData[chartData.length - 1]?.label : null;

  const sig      = prediction?.signal;
  const sigMeta  = SIG[sig] ?? SIG.hold;
  const curPrice = livePrice ?? lastCandleClose ?? prediction?.current_price;
  const score    = prediction?.ai_confidence_score ?? 0;
  const scoreColor = score >= 70 ? '#26A69A' : score >= 50 ? '#F59E0B' : '#EF5350';
  const changeUp = (liveChange ?? 0) >= 0;

  return (
    <div style={{
      padding       : '20px',
      display       : 'flex',
      flexDirection : 'column',
      gap           : 16,
      minHeight     : '100vh',
      background    : '#090C18',
    }}>

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes livePulse {
          0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(38,166,154,0.6); }
          50%      { opacity:.6; box-shadow:0 0 0 5px rgba(38,166,154,0); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .live-chart-stat-card {
          animation: slideUp 0.4s ease both;
          transition: border-color 0.2s, background 0.2s;
        }
        .live-chart-stat-card:hover {
          border-color: rgba(168,85,247,0.25) !important;
          background:   rgba(168,85,247,0.06) !important;
        }
        .tf-btn { transition: all 0.18s; }
        .tf-btn:hover { border-color: rgba(168,85,247,0.4) !important; color:#C084FC !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>

        {/* Ticker + price */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <h2 style={{ margin:0, fontSize:'1.65rem', color:'#F0F0FF', fontWeight:800, letterSpacing:'-0.02em' }}>
              {selectedSymbol}
            </h2>

            {/* LIVE / OFFLINE badge */}
            <div style={{
              display     :'flex', alignItems:'center', gap:6,
              background  : wsConnected ? 'rgba(38,166,154,0.10)' : 'rgba(107,114,128,0.10)',
              border      : `1px solid ${wsConnected ? 'rgba(38,166,154,0.28)' : 'rgba(107,114,128,0.2)'}`,
              borderRadius: 20, padding:'3px 10px',
            }}>
              <div style={{
                width     : 7, height:7, borderRadius:'50%',
                background: wsConnected ? '#26A69A' : '#4B5563',
                animation : wsConnected ? 'livePulse 2s infinite' : 'none',
              }} />
              <span style={{ fontSize:'0.68rem', fontWeight:700, color: wsConnected ? '#26A69A' : '#4B5563', letterSpacing:'0.06em' }}>
                {wsConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {curPrice != null && (
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:5 }}>
              <span style={{
                fontSize  :'2rem', fontWeight:800, color:'#F0F0FF',
                fontFamily:'JetBrains Mono, monospace',
              }}>
                ₹{curPrice.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}
              </span>
              {liveChange != null && (
                <span style={{
                  fontSize  :'0.95rem', fontWeight:700,
                  color     : changeUp ? '#26A69A' : '#EF5350',
                  fontFamily:'JetBrains Mono, monospace',
                }}>
                  {changeUp ? '+' : ''}{liveChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeframe + Interval selector */}
        <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
          {/* Interval row */}
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:'0.65rem', color:'#374151', marginRight:4, letterSpacing:'0.06em' }}>CANDLE</span>
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                className="tf-btn"
                onClick={() => handleIntervalChange(iv.value)}
                style={{
                  padding   :'4px 10px', borderRadius:6,
                  fontSize  :'0.72rem', fontWeight:600,
                  cursor    :'pointer',
                  border    : interval === iv.value ? '1px solid rgba(99,102,241,0.55)' : '1px solid rgba(75,85,99,0.25)',
                  background: interval === iv.value ? 'rgba(99,102,241,0.15)'           : 'transparent',
                  color     : interval === iv.value ? '#818CF8'                          : '#4B5563',
                }}
              >{iv.label}</button>
            ))}
          </div>
          {/* Period row */}
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:'0.65rem', color:'#374151', marginRight:4, letterSpacing:'0.06em' }}>RANGE</span>
            {PERIODS.map(p => (
              <button
                key={p.value}
                className="tf-btn"
                onClick={() => handlePeriodChange(p.value)}
                style={{
                  padding   :'4px 10px', borderRadius:6,
                  fontSize  :'0.72rem', fontWeight:600,
                  cursor    :'pointer',
                  border    : period === p.value ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(75,85,99,0.25)',
                  background: period === p.value ? 'rgba(168,85,247,0.13)'           : 'transparent',
                  color     : period === p.value ? '#C084FC'                          : '#4B5563',
                }}
              >{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart card ── */}
      <div style={{
        background  :'rgba(255,255,255,0.018)',
        border      :'1px solid rgba(168,85,247,0.10)',
        borderRadius:18,
        padding     :'20px 8px 12px 0',
        flex        :1,
        minHeight   :440,
        position    :'relative',
        overflow    :'hidden',
      }}>

        {/* Legend row */}
        <div style={{
          display:'flex', gap:20, paddingLeft:16, marginBottom:12,
          fontSize:'0.72rem', color:'#4B5563',
        }}>
          <span><span style={{ color:'#26A69A' }}>█</span> Bullish</span>
          <span><span style={{ color:'#EF5350' }}>█</span> Bearish</span>
          {isDaily && prediction && (
            <>
              <span style={{ borderBottom:'2px dashed #A855F7', paddingBottom:1 }}>── AI Prediction</span>
              <span style={{ background:'rgba(168,85,247,0.15)', padding:'0 6px', borderRadius:4 }}>░ Confidence band</span>
            </>
          )}
          {wsConnected && (
            <span style={{ color:'rgba(38,166,154,0.6)' }}>─ ─  Live price</span>
          )}
        </div>

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400 }}>
            <div style={{
              width:36, height:36, borderRadius:'50%',
              border:'3px solid rgba(168,85,247,0.15)',
              borderTopColor:'#A855F7',
              animation:'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={440}>
            <ComposedChart data={chartData} margin={{ top:10, right:24, bottom:10, left:10 }}>

              <CartesianGrid
                strokeDasharray="3 4"
                stroke="rgba(168,85,247,0.055)"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fill:'#374151', fontSize:10, fontFamily:'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                domain={yDomain}
                tick={{ fill:'#374151', fontSize:10, fontFamily:'JetBrains Mono, monospace' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `₹${Number(v).toLocaleString('en-IN')}`}
                width={82}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke:'rgba(168,85,247,0.18)', strokeWidth:1 }} />

              {/* ── Confidence band (ReferenceArea is simplest) ── */}
              {prediction?.predicted_price_7d && bandX1 && bandX2 && (
                <ReferenceArea
                  x1={bandX1} x2={bandX2}
                  y1={prediction.predicted_lower_price_7d ?? prediction.low_bound  ?? prediction.predicted_price_7d * 0.975}
                  y2={prediction.predicted_upper_price_7d ?? prediction.high_bound ?? prediction.predicted_price_7d * 1.025}
                  fill="rgba(168,85,247,0.09)"
                  stroke="rgba(168,85,247,0.18)"
                  strokeDasharray="4 3"
                  ifOverflow="extendDomain"
                />
              )}

              {/* ── Candlestick bodies ── */}
              <Bar
                dataKey="bodyRange"
                shape={<CandleShape />}
                isAnimationActive={false}
                maxBarSize={22}
              />

              {/* ── AI prediction dotted line ── */}
              <Line
                dataKey="predClose"
                stroke="#A855F7"
                strokeWidth={2.2}
                strokeDasharray="7 5"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.predClose == null) return null;
                  if (payload.label !== '+7D') {
                    // Small anchor dot at bridge point
                    return <circle key={`a-${cx}`} cx={cx} cy={cy} r={2.5} fill="#A855F7" opacity={0.4} />;
                  }
                  // Target dot — bigger with glow ring
                  return (
                    <g key={`t-${cx}`}>
                      <circle cx={cx} cy={cy} r={10} fill="rgba(168,85,247,0.12)" />
                      <circle cx={cx} cy={cy} r={5.5} fill="rgba(168,85,247,0.3)" />
                      <circle cx={cx} cy={cy} r={3.5} fill="#A855F7" />
                    </g>
                  );
                }}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={true}
                animationDuration={900}
              />

              {/* ── Live price reference line ── */}
              {curPrice != null && (
                <ReferenceLine
                  y={curPrice}
                  stroke={changeUp ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)'}
                  strokeDasharray="4 3"
                  strokeWidth={1.2}
                  label={{
                    value   : `₹${curPrice.toFixed(0)}`,
                    position: 'insideTopRight',
                    fill    : changeUp ? '#26A69A' : '#EF5350',
                    fontSize: 10,
                    fontFamily:'JetBrains Mono, monospace',
                  }}
                />
              )}

              {/* ── Prediction target reference line ── */}
              {prediction?.predicted_price_7d && (
                <ReferenceLine
                  y={prediction.predicted_price_7d}
                  stroke="rgba(168,85,247,0.3)"
                  strokeDasharray="3 4"
                  strokeWidth={1}
                  label={{
                    value   : `AI ₹${prediction.predicted_price_7d.toFixed(0)}`,
                    position: 'insideTopLeft',
                    fill    : '#A855F7',
                    fontSize: 10,
                    fontFamily:'JetBrains Mono, monospace',
                  }}
                />
              )}

            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Stats bar — only for daily interval ── */}
      {isDaily && (<div style={{
        display            :'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',
        gap                :10,
      }}>

        {[
          {
            label : 'CURRENT PRICE',
            value : curPrice ? `₹${curPrice.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}` : '—',
            color : '#F0F0FF',
            delay : '0ms',
          },
          {
            label : 'AI TARGET (7D)',
            value : prediction?.predicted_price_7d
              ? `₹${prediction.predicted_price_7d.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
              : predLoading ? 'Loading…' : '—',
            color : '#A855F7',
            delay : '50ms',
          },
          {
            label : 'EXPECTED RETURN',
            value : prediction?.predicted_return_7d != null
              ? `${prediction.predicted_return_7d >= 0 ? '+' : ''}${(prediction.predicted_return_7d * 100).toFixed(2)}%`
              : predLoading ? 'Loading…' : '—',
            color : prediction?.predicted_return_7d >= 0 ? '#26A69A' : '#EF5350',
            delay : '100ms',
          },
          {
            label : 'AI CONFIDENCE',
            value : prediction?.ai_confidence_score != null ? `${prediction.ai_confidence_score}/100` : predLoading ? 'Loading…' : '—',
            color : scoreColor,
            delay : '150ms',
          },
          {
            label : '95% UPPER',
            value : (prediction?.predicted_upper_price_7d ?? prediction?.high_bound)
              ? `₹${(prediction.predicted_upper_price_7d ?? prediction.high_bound).toFixed(2)}`
              : predLoading ? 'Loading…' : '—',
            color : '#26A69A',
            delay : '200ms',
          },
          {
            label : '95% LOWER',
            value : (prediction?.predicted_lower_price_7d ?? prediction?.low_bound)
              ? `₹${(prediction.predicted_lower_price_7d ?? prediction.low_bound).toFixed(2)}`
              : predLoading ? 'Loading…' : '—',
            color : '#EF5350',
            delay : '250ms',
          },
        ].map(({ label, value, color, delay }) => (
          <div
            key={label}
            className="live-chart-stat-card"
            style={{
              background  :'rgba(255,255,255,0.025)',
              border      :'1px solid rgba(168,85,247,0.09)',
              borderRadius:12,
              padding     :'12px 16px',
              animationDelay: delay,
            }}
          >
            <div style={{ fontSize:'0.66rem', color:'#374151', letterSpacing:'0.08em', marginBottom:5 }}>
              {label}
            </div>
            <div style={{
              fontSize  :'0.92rem', fontWeight:700, color,
              fontFamily:'JetBrains Mono, monospace',
              letterSpacing:'-0.01em',
            }}>
              {value}
            </div>
          </div>
        ))}

        {/* Signal pill */}
        <div
          className="live-chart-stat-card"
          style={{
            background  : sigMeta.bg,
            border      : `1px solid ${sigMeta.border}`,
            borderRadius: 12,
            padding     : '12px 16px',
            animationDelay: '300ms',
            display     : 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize:'0.66rem', color:'#374151', letterSpacing:'0.08em', marginBottom:5 }}>
            AI SIGNAL
          </div>
          <div style={{
            fontSize  :'1.05rem', fontWeight:800, color: sigMeta.color,
            fontFamily:'JetBrains Mono, monospace',
          }}>
            {predLoading ? 'Loading…' : sigMeta.label}
          </div>
        </div>

      </div>
      )}

      {/* ── Confidence score bar — only for daily ── */}
      {isDaily && prediction?.ai_confidence_score != null && (
        <div style={{
          background  :'rgba(255,255,255,0.02)',
          border      :'1px solid rgba(168,85,247,0.08)',
          borderRadius:12, padding:'12px 16px',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7, fontSize:'0.75rem' }}>
            <span style={{ color:'#6B7280' }}>AI Confidence Score</span>
            <span style={{ color:scoreColor, fontFamily:'JetBrains Mono, monospace', fontWeight:700 }}>
              {score} / 100
            </span>
          </div>
          <div style={{ height:5, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height    :'100%',
              width     :`${score}%`,
              background:`linear-gradient(90deg, ${scoreColor}bb, ${scoreColor})`,
              borderRadius: 99,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      )}

    </div>
  );
}
