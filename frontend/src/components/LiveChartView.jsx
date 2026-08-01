import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org';
const WS_BASE  = API_BASE.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');

const INTERVALS = [
  { label: '1m',  value: '1m'  },
  { label: '5m',  value: '5m'  },
  { label: '15m', value: '15m' },
  { label: '1H',  value: '1h'  },
  { label: '1D',  value: '1d'  },
];

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

const DEFAULT_INTERVAL = {
  '1D': '5m', '5D': '15m', '1W': '1h',
  '1M': '1d', '3M': '1d', '6M': '1d', '1Y': '1d', '2Y': '1d',
};

const SIG = {
  buy  : { label: '▲ BUY',  color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)' },
  sell : { label: '▼ SELL', color: '#EF5350', bg: 'rgba(239,83,80,0.10)',  border: 'rgba(239,83,80,0.28)' },
  hold : { label: '◆ HOLD', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

/** Convert backend ISO/space-separated date to lightweight-charts time format */
function toChartTime(dateStr, isIntraday) {
  // Backend may return "2024-07-31 09:15:00" (space) or "2024-07-31T09:15:00" (T)
  const normalized = String(dateStr).replace(' ', 'T');
  if (!isIntraday) {
    // lightweight-charts requires exactly 'YYYY-MM-DD'
    return normalized.substring(0, 10);
  }
  // For intraday: unix timestamp in seconds
  const ms = new Date(normalized).getTime();
  if (isNaN(ms)) return null; // guard against bad dates
  return Math.floor(ms / 1000);
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

/* ─── Lightweight Charts theme ───────────────────────────────────────────────── */

const CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor  : '#6B7280',
    fontFamily : '"JetBrains Mono", "Courier New", monospace',
    fontSize   : 11,
  },
  grid: {
    vertLines: { color: 'rgba(168,85,247,0.04)', style: LineStyle.Dotted },
    horzLines: { color: 'rgba(168,85,247,0.07)' },
  },
  crosshair: {
    mode        : CrosshairMode.Normal,
    vertLine    : { color: 'rgba(168,85,247,0.45)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1e1060' },
    horzLine    : { color: 'rgba(168,85,247,0.45)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1e1060' },
  },
  rightPriceScale: {
    borderColor     : 'rgba(168,85,247,0.10)',
    textColor       : '#6B7280',
    scaleMargins    : { top: 0.12, bottom: 0.08 },
  },
  timeScale: {
    borderColor   : 'rgba(168,85,247,0.10)',
    textColor     : '#6B7280',
    timeVisible   : true,
    secondsVisible: false,
    fixLeftEdge   : false,
    fixRightEdge  : false,
  },
  handleScroll : { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
  handleScale  : { mouseWheel: true, pinch: true },
};

const CANDLE_STYLE = {
  upColor        : '#26A69A',
  downColor      : '#EF5350',
  borderVisible  : false,
  wickUpColor    : '#26A69A',
  wickDownColor  : '#EF5350',
};

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function LiveChartView() {
  const { selectedSymbol }             = useStore();
  const { fetchHistory, fetchPredict } = useStock();

  const [period,      setPeriod]      = useState('3M');
  const [interval,    setInterval]    = useState('1d');
  const [rawHistory,  setRawHistory]  = useState(null);
  const [prediction,  setPrediction]  = useState(null);
  const [livePrice,   setLivePrice]   = useState(null);
  const [liveChange,  setLiveChange]  = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [predLoading, setPredLoading] = useState(true);

  // Chart DOM refs
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const candleRef      = useRef(null);
  const predLineRef    = useRef(null);
  const upperLineRef   = useRef(null);
  const lowerLineRef   = useRef(null);
  const livePriceLineRef = useRef(null);
  const wsRef          = useRef(null);

  const isDaily = interval === '1d';

  /* ── Period / Interval changes ────────────────────────────── */

  const handlePeriodChange = useCallback((p) => {
    const iv = DEFAULT_INTERVAL[p] || '1d';
    setPeriod(p);
    setInterval(iv);
  }, []);

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
  }, []);

  /* ── Create chart (once on mount) ────────────────────────── */

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width : containerRef.current.clientWidth,
      height: 480,
    });
    chartRef.current = chart;

    // Candlestick series
    const candle = chart.addCandlestickSeries(CANDLE_STYLE);
    candleRef.current = candle;

    // AI Prediction dashed line
    const predLine = chart.addLineSeries({
      color                  : '#A855F7',
      lineWidth              : 2.5,
      lineStyle              : LineStyle.Dashed,
      crosshairMarkerVisible : true,
      crosshairMarkerRadius  : 6,
      crosshairMarkerBorderColor: '#A855F7',
      crosshairMarkerBackgroundColor: 'rgba(168,85,247,0.3)',
      priceLineVisible       : false,
      lastValueVisible       : false,
    });
    predLineRef.current = predLine;

    // Upper confidence bound (dotted green)
    const upperLine = chart.addLineSeries({
      color                : 'rgba(38,166,154,0.5)',
      lineWidth            : 1,
      lineStyle            : LineStyle.Dotted,
      crosshairMarkerVisible: false,
      priceLineVisible     : false,
      lastValueVisible     : false,
    });
    upperLineRef.current = upperLine;

    // Lower confidence bound (dotted red)
    const lowerLine = chart.addLineSeries({
      color                : 'rgba(239,83,80,0.5)',
      lineWidth            : 1,
      lineStyle            : LineStyle.Dotted,
      crosshairMarkerVisible: false,
      priceLineVisible     : false,
      lastValueVisible     : false,
    });
    lowerLineRef.current = lowerLine;

    // ResizeObserver for responsive width
    const ro = new ResizeObserver(entries => {
      if (entries[0] && chartRef.current) {
        chartRef.current.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      predLineRef.current = null;
      upperLineRef.current = null;
      lowerLineRef.current = null;
      livePriceLineRef.current = null;
    };
  }, []); // once

  /* ── Fetch data when symbol / period / interval changes ──── */

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

    if (isDaily) {
      fetchPredict(selectedSymbol).then(pred => {
        setPrediction(pred);
        setPredLoading(false);
      });
    } else {
      setPrediction(null);
      setPredLoading(false);
    }
  }, [selectedSymbol, period, interval]);

  /* ── WebSocket for live prices ───────────────────────────── */

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

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 20_000);

    return () => { clearInterval(ping); ws.close(); };
  }, [selectedSymbol]);

  /* ── Push candle data to chart ───────────────────────────── */

  useEffect(() => {
    // Clear chart when no data (range switching)
    if (!candleRef.current) return;
    if (!rawHistory?.length) {
      try { candleRef.current.setData([]); } catch {}
      try { predLineRef.current?.setData([]); upperLineRef.current?.setData([]); lowerLineRef.current?.setData([]); } catch {}
      return;
    }

    const intraday = !isDaily;

    // Build candle data — filter bad values and null times
    const candles = rawHistory
      .filter(d => d.open != null && d.high != null && d.low != null && d.close != null)
      .map(d => ({
        time  : toChartTime(d.date, intraday),
        open  : Number(d.open),
        high  : Number(d.high),
        low   : Number(d.low),
        close : Number(d.close),
      }))
      .filter(d => d.time != null && !isNaN(d.time) && !isNaN(d.open)); // remove bad rows

    // Sort: numeric for intraday timestamps, lexicographic for date strings
    candles.sort((a, b) => intraday ? a.time - b.time : a.time < b.time ? -1 : 1);

    // Deduplicate by time (keep last occurrence per timestamp)
    const seen = new Map();
    candles.forEach(c => seen.set(c.time, c));
    const dedupedCandles = Array.from(seen.values());

    try {
      candleRef.current.setData(dedupedCandles);
    } catch (e) { console.warn('setData error:', e); }

    // ── Prediction lines (daily only) ──
    if (isDaily && prediction?.predicted_price_7d && rawHistory.length > 0) {
      const lastD    = rawHistory[rawHistory.length - 1];
      const lastTime = toChartTime(lastD.date, false);
      const lastClose = lastD.close;
      const futureTime = addBusinessDays(lastD.date, 7);

      const upperVal = prediction.predicted_upper_price_7d ?? prediction.high_bound ?? prediction.predicted_price_7d * 1.025;
      const lowerVal = prediction.predicted_lower_price_7d ?? prediction.low_bound  ?? prediction.predicted_price_7d * 0.975;

      try {
        predLineRef.current?.setData([
          { time: lastTime, value: lastClose },
          { time: futureTime, value: prediction.predicted_price_7d },
        ]);
        upperLineRef.current?.setData([
          { time: lastTime, value: lastClose },
          { time: futureTime, value: upperVal },
        ]);
        lowerLineRef.current?.setData([
          { time: lastTime, value: lastClose },
          { time: futureTime, value: lowerVal },
        ]);
      } catch (e) { console.warn('Prediction line error:', e); }
    } else {
      // Clear prediction lines
      try {
        predLineRef.current?.setData([]);
        upperLineRef.current?.setData([]);
        lowerLineRef.current?.setData([]);
      } catch {}
    }

    // ── Live price line ──
    if (livePriceLineRef.current) {
      try { candleRef.current.removePriceLine(livePriceLineRef.current); } catch {}
      livePriceLineRef.current = null;
    }

    chartRef.current?.timeScale().fitContent();
  }, [rawHistory, prediction, interval]);

  /* ── Real-time live price update (last candle) ───────────── */

  useEffect(() => {
    if (!candleRef.current || !livePrice || !rawHistory?.length) return;

    const last     = rawHistory[rawHistory.length - 1];
    const intraday = !isDaily;

    try {
      candleRef.current.update({
        time  : toChartTime(last.date, intraday),
        open  : last.open,
        high  : Math.max(last.high, livePrice),
        low   : Math.min(last.low,  livePrice),
        close : livePrice,
      });
    } catch {}

    // Update / create live price line
    if (livePriceLineRef.current) {
      try { candleRef.current.removePriceLine(livePriceLineRef.current); } catch {}
    }
    livePriceLineRef.current = candleRef.current.createPriceLine({
      price               : livePrice,
      color               : (liveChange ?? 0) >= 0 ? '#26A69A' : '#EF5350',
      lineWidth           : 1,
      lineStyle           : LineStyle.Dashed,
      axisLabelVisible    : true,
      axisLabelColor      : (liveChange ?? 0) >= 0 ? '#26A69A' : '#EF5350',
      axisLabelTextColor  : '#fff',
      title               : 'LIVE',
    });
  }, [livePrice, interval]);

  /* ── Derived values for header / stats ──────────────────── */

  const lastCandleClose = rawHistory?.length ? rawHistory[rawHistory.length - 1]?.close : null;
  const curPrice  = livePrice ?? lastCandleClose ?? prediction?.current_price;
  const changeUp  = (liveChange ?? 0) >= 0;
  const sig       = prediction?.signal;
  const sigMeta   = SIG[sig] ?? SIG.hold;
  const score     = prediction?.ai_confidence_score ?? 0;
  const scoreColor = score >= 70 ? '#26A69A' : score >= 50 ? '#F59E0B' : '#EF5350';

  /* ──────────────────────────────────────────────────────────── */

  return (
    <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16, minHeight:'100vh', background:'#090C18' }}>

      {/* ── CSS ── */}
      <style>{`
        @keyframes livePulse {
          0%,100% { box-shadow:0 0 0 0 rgba(38,166,154,0.5); }
          50%      { box-shadow:0 0 0 6px rgba(38,166,154,0); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .lc-stat { animation:fadeUp 0.35s ease both; transition:border-color 0.2s, background 0.2s; }
        .lc-stat:hover { border-color:rgba(168,85,247,0.28)!important; background:rgba(168,85,247,0.05)!important; }
        .lc-btn  { transition:all 0.15s; }
        .lc-btn:hover { opacity:1!important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>

        {/* Left: ticker + price */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h2 style={{ margin:0, fontSize:'1.55rem', fontWeight:800, color:'#F0F0FF', letterSpacing:'-0.02em' }}>
              {selectedSymbol}
            </h2>

            {/* LIVE / OFFLINE pill */}
            <div style={{
              display:'flex', alignItems:'center', gap:5,
              background: wsConnected ? 'rgba(38,166,154,0.10)' : 'rgba(75,85,99,0.10)',
              border:`1px solid ${wsConnected ? 'rgba(38,166,154,0.28)' : 'rgba(75,85,99,0.2)'}`,
              borderRadius:20, padding:'3px 10px',
            }}>
              <div style={{
                width:7, height:7, borderRadius:'50%',
                background: wsConnected ? '#26A69A' : '#4B5563',
                animation: wsConnected ? 'livePulse 2s infinite' : 'none',
              }} />
              <span style={{ fontSize:'0.67rem', fontWeight:700, letterSpacing:'0.07em', color: wsConnected ? '#26A69A' : '#4B5563' }}>
                {wsConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {curPrice != null && (
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:5 }}>
              <span style={{ fontSize:'1.9rem', fontWeight:800, color:'#F0F0FF', fontFamily:'JetBrains Mono, monospace' }}>
                ₹{curPrice.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}
              </span>
              {liveChange != null && (
                <span style={{ fontSize:'0.9rem', fontWeight:700, color: changeUp ? '#26A69A' : '#EF5350', fontFamily:'JetBrains Mono, monospace' }}>
                  {changeUp ? '+' : ''}{liveChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: interval + period selectors */}
        <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>

          {/* CANDLE row */}
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:'0.62rem', color:'#374151', letterSpacing:'0.08em', marginRight:4 }}>CANDLE</span>
            {INTERVALS.map(iv => (
              <button key={iv.value} className="lc-btn" onClick={() => handleIntervalChange(iv.value)} style={{
                padding:'4px 11px', borderRadius:6, fontSize:'0.72rem', fontWeight:600, cursor:'pointer',
                border    : interval === iv.value ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(75,85,99,0.2)',
                background: interval === iv.value ? 'rgba(99,102,241,0.15)'          : 'transparent',
                color     : interval === iv.value ? '#818CF8'                         : '#4B5563',
              }}>{iv.label}</button>
            ))}
          </div>

          {/* RANGE row */}
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:'0.62rem', color:'#374151', letterSpacing:'0.08em', marginRight:4 }}>RANGE</span>
            {PERIODS.map(p => (
              <button key={p.value} className="lc-btn" onClick={() => handlePeriodChange(p.value)} style={{
                padding:'4px 11px', borderRadius:6, fontSize:'0.72rem', fontWeight:600, cursor:'pointer',
                border    : period === p.value ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(75,85,99,0.2)',
                background: period === p.value ? 'rgba(168,85,247,0.13)'          : 'transparent',
                color     : period === p.value ? '#C084FC'                         : '#4B5563',
              }}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart card ── */}
      <div style={{
        background:'rgba(255,255,255,0.015)',
        border:'1px solid rgba(168,85,247,0.10)',
        borderRadius:18, overflow:'hidden',
        position:'relative',
      }}>

        {/* Legend */}
        <div style={{ display:'flex', gap:18, padding:'12px 18px 0', fontSize:'0.71rem', color:'#4B5563', flexWrap:'wrap' }}>
          <span><span style={{ color:'#26A69A' }}>█</span> Bullish</span>
          <span><span style={{ color:'#EF5350' }}>█</span> Bearish</span>
          {isDaily && prediction && (
            <>
              <span>
                <span style={{ display:'inline-block', width:14, borderBottom:'2px dashed #A855F7', verticalAlign:'middle', marginRight:4 }} />
                AI Prediction
              </span>
              <span style={{ color:'rgba(38,166,154,0.8)' }}>···· Upper bound</span>
              <span style={{ color:'rgba(239,83,80,0.8)'  }}>···· Lower bound</span>
            </>
          )}
          {wsConnected && <span style={{ color:'rgba(38,166,154,0.6)' }}>– – Live price line</span>}
          <span style={{ marginLeft:'auto', color:'#374151', fontSize:'0.65rem' }}>
            Scroll to zoom · Drag to pan
          </span>
        </div>

        {/* Loading spinner overlay */}
        {loading && (
          <div style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(9,12,24,0.75)', zIndex:10, borderRadius:18,
          }}>
            <div style={{
              width:38, height:38, borderRadius:'50%',
              border:'3px solid rgba(168,85,247,0.15)',
              borderTopColor:'#A855F7',
              animation:'spin 0.75s linear infinite',
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Lightweight Charts mounts here */}
        <div ref={containerRef} style={{ width:'100%', height:480 }} />
      </div>

      {/* ── Stats bar (daily only) ── */}
      {isDaily && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(138px, 1fr))', gap:10 }}>

          {[
            { label:'CURRENT PRICE',   value: curPrice ? `₹${curPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—', color:'#F0F0FF', delay:'0ms' },
            { label:'AI TARGET (7D)',  value: prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : predLoading ? 'Loading…' : '—', color:'#A855F7', delay:'40ms' },
            { label:'EXPECTED RETURN', value: prediction?.predicted_return_7d != null ? `${prediction.predicted_return_7d>=0?'+':''}${(prediction.predicted_return_7d*100).toFixed(2)}%` : predLoading ? 'Loading…' : '—',
              color: prediction?.predicted_return_7d >= 0 ? '#26A69A' : '#EF5350', delay:'80ms' },
            { label:'AI CONFIDENCE',   value: prediction?.ai_confidence_score != null ? `${prediction.ai_confidence_score}/100` : predLoading ? 'Loading…' : '—', color:scoreColor, delay:'120ms' },
            { label:'95% UPPER',       value:(prediction?.predicted_upper_price_7d??prediction?.high_bound) ? `₹${(prediction.predicted_upper_price_7d??prediction.high_bound).toFixed(2)}` : predLoading?'Loading…':'—', color:'#26A69A', delay:'160ms' },
            { label:'95% LOWER',       value:(prediction?.predicted_lower_price_7d??prediction?.low_bound)  ? `₹${(prediction.predicted_lower_price_7d??prediction.low_bound).toFixed(2)}`  : predLoading?'Loading…':'—', color:'#EF5350', delay:'200ms' },
          ].map(({ label, value, color, delay }) => (
            <div key={label} className="lc-stat" style={{
              background:'rgba(255,255,255,0.022)', border:'1px solid rgba(168,85,247,0.09)',
              borderRadius:12, padding:'11px 14px', animationDelay:delay,
            }}>
              <div style={{ fontSize:'0.64rem', color:'#374151', letterSpacing:'0.09em', marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:'0.9rem', fontWeight:700, color, fontFamily:'JetBrains Mono, monospace' }}>{value}</div>
            </div>
          ))}

          {/* Signal pill */}
          <div className="lc-stat" style={{
            background:sigMeta.bg, border:`1px solid ${sigMeta.border}`,
            borderRadius:12, padding:'11px 14px', animationDelay:'240ms',
            display:'flex', flexDirection:'column', justifyContent:'center',
          }}>
            <div style={{ fontSize:'0.64rem', color:'#374151', letterSpacing:'0.09em', marginBottom:5 }}>AI SIGNAL</div>
            <div style={{ fontSize:'1rem', fontWeight:800, color:sigMeta.color, fontFamily:'JetBrains Mono, monospace' }}>
              {predLoading ? 'Loading…' : sigMeta.label}
            </div>
          </div>
        </div>
      )}

      {/* ── Confidence bar (daily only) ── */}
      {isDaily && prediction?.ai_confidence_score != null && (
        <div style={{
          background:'rgba(255,255,255,0.018)', border:'1px solid rgba(168,85,247,0.08)',
          borderRadius:12, padding:'11px 16px',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7, fontSize:'0.74rem' }}>
            <span style={{ color:'#6B7280' }}>AI Confidence Score</span>
            <span style={{ color:scoreColor, fontFamily:'JetBrains Mono, monospace', fontWeight:700 }}>{score} / 100</span>
          </div>
          <div style={{ height:5, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${score}%`,
              background:`linear-gradient(90deg,${scoreColor}99,${scoreColor})`,
              borderRadius:99, transition:'width 0.6s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Intraday note ── */}
      {!isDaily && (
        <div style={{
          background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)',
          borderRadius:10, padding:'10px 14px', fontSize:'0.76rem', color:'#818CF8',
        }}>
          🔵 Intraday mode — AI prediction available on <strong>1D</strong> candle interval only.
          Switch to <strong>1D</strong> candle to see the 7-day AI forecast.
        </div>
      )}

    </div>
  );
}
