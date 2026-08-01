import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Maximize2, Minimize2, Camera, Bell, Search, 
  TrendingUp, Activity, BarChart2, Eye, EyeOff 
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org';
const WS_BASE  = API_BASE.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');

const POPULAR_STOCKS = ['RELIANCE', 'TATAMOTORS', 'INFY', 'TCS', 'HDFCBANK', 'NIFTY50', 'BANKNIFTY'];

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

/* ─── Math Indicators ───────────────────────────────────────────────────────── */

/** Simple Moving Average */
function calculateSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

/** Exponential Moving Average */
function calculateEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);
  let ema = data[0]?.close || 0;
  for (let i = 0; i < data.length; i++) {
    const val = data[i].close;
    ema = i === 0 ? val : val * k + ema * (1 - k);
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

/** Bollinger Bands (20, 2) */
function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const upper = [];
  const lower = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - mean, 2);
    }
    const stdDev = Math.sqrt(variance / period);
    upper.push({ time: data[i].time, value: mean + multiplier * stdDev });
    lower.push({ time: data[i].time, value: mean - multiplier * stdDev });
  }
  return { upper, lower };
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function toChartTime(dateStr, isIntraday) {
  const normalized = String(dateStr).replace(' ', 'T');
  if (!isIntraday) return normalized.substring(0, 10);
  const ms = new Date(normalized).getTime();
  if (isNaN(ms)) return null;
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

/* ─── Lightweight Charts options ─────────────────────────────────────────────── */

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
    scaleMargins    : { top: 0.08, bottom: 0.22 },
  },
  timeScale: {
    borderColor   : 'rgba(168,85,247,0.10)',
    textColor     : '#6B7280',
    timeVisible   : true,
    secondsVisible: false,
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

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export default function LiveChartView() {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const { fetchHistory, fetchPredict, searchStock } = useStock();

  const [period,      setPeriod]      = useState('3M');
  const [interval,    setInterval]    = useState('1d');
  const [rawHistory,  setRawHistory]  = useState(null);
  const [prediction,  setPrediction]  = useState(null);
  const [livePrice,   setLivePrice]   = useState(null);
  const [liveChange,  setLiveChange]  = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [predLoading, setPredLoading] = useState(true);

  // Indicator Toggles
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA,    setShowSMA]    = useState(false);
  const [showEMA,    setShowEMA]    = useState(false);
  const [showBB,     setShowBB]     = useState(false);

  // Search & Alert State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [targetAlertPrice, setTargetAlertPrice] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs
  const cardContainerRef = useRef(null);
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const candleRef      = useRef(null);
  const volumeRef      = useRef(null);
  const smaRef         = useRef(null);
  const emaRef         = useRef(null);
  const bbUpperRef     = useRef(null);
  const bbLowerRef     = useRef(null);

  const predLineRef    = useRef(null);
  const upperLineRef   = useRef(null);
  const lowerLineRef   = useRef(null);
  const livePriceLineRef = useRef(null);
  const wsRef          = useRef(null);

  const isDaily = interval === '1d';

  /* ── Period / Interval Handlers ───────────────────────────── */

  const handlePeriodChange = useCallback((p) => {
    const iv = DEFAULT_INTERVAL[p] || '1d';
    setPeriod(p);
    setInterval(iv);
  }, []);

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
  }, []);

  /* ── Chart Init (mount once) ──────────────────────────────── */

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width : containerRef.current.clientWidth,
      height: 500,
    });
    chartRef.current = chart;

    // 1. Candlesticks
    const candle = chart.addCandlestickSeries(CANDLE_STYLE);
    candleRef.current = candle;

    // 2. Volume Histogram Sub-chart
    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volumeRef.current = volume;

    // 3. Technical Indicators
    const sma = chart.addLineSeries({ color: '#00E5FF', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    smaRef.current = sma;

    const ema = chart.addLineSeries({ color: '#FF9100', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    emaRef.current = ema;

    const bbUpper = chart.addLineSeries({ color: '#E040FB', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbUpperRef.current = bbUpper;

    const bbLower = chart.addLineSeries({ color: '#E040FB', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbLowerRef.current = bbLower;

    // 4. AI Prediction Lines
    const predLine = chart.addLineSeries({
      color: '#A855F7', lineWidth: 2.5, lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: true, crosshairMarkerRadius: 6,
      crosshairMarkerBorderColor: '#A855F7', crosshairMarkerBackgroundColor: 'rgba(168,85,247,0.3)',
      priceLineVisible: false, lastValueVisible: false,
    });
    predLineRef.current = predLine;

    const upperLine = chart.addLineSeries({ color: 'rgba(38,166,154,0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    upperLineRef.current = upperLine;

    const lowerLine = chart.addLineSeries({ color: 'rgba(239,83,80,0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    lowerLineRef.current = lowerLine;

    // ResizeObserver
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
      volumeRef.current = null;
      smaRef.current = null;
      emaRef.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
      predLineRef.current = null;
      upperLineRef.current = null;
      lowerLineRef.current = null;
      livePriceLineRef.current = null;
    };
  }, []);

  /* ── Data Fetch ───────────────────────────────────────────── */

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

  /* ── WebSocket Feed ───────────────────────────────────────── */

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

          // Check Price Alert trigger
          if (targetAlertPrice && Math.abs(price - Number(targetAlertPrice)) < 1) {
            toast.success(`🔔 ALERT TRIGGERED: ${selectedSymbol} hit target ₹${price}`);
            setTargetAlertPrice('');
          }
        }
      } catch {}
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 20_000);

    return () => { clearInterval(ping); ws.close(); };
  }, [selectedSymbol, targetAlertPrice]);

  /* ── Data Binding to Chart & Indicators ───────────────────── */

  useEffect(() => {
    if (!candleRef.current) return;
    if (!rawHistory?.length) {
      try {
        candleRef.current.setData([]);
        volumeRef.current?.setData([]);
        smaRef.current?.setData([]);
        emaRef.current?.setData([]);
        bbUpperRef.current?.setData([]);
        bbLowerRef.current?.setData([]);
        predLineRef.current?.setData([]);
        upperLineRef.current?.setData([]);
        lowerLineRef.current?.setData([]);
      } catch {}
      return;
    }

    const intraday = !isDaily;

    // 1. Build Candles
    const candles = rawHistory
      .filter(d => d.open != null && d.high != null && d.low != null && d.close != null)
      .map(d => ({
        time  : toChartTime(d.date, intraday),
        open  : Number(d.open),
        high  : Number(d.high),
        low   : Number(d.low),
        close : Number(d.close),
      }))
      .filter(d => d.time != null && !isNaN(d.time) && !isNaN(d.open));

    candles.sort((a, b) => intraday ? a.time - b.time : a.time < b.time ? -1 : 1);

    const seen = new Map();
    candles.forEach(c => seen.set(c.time, c));
    const dedupedCandles = Array.from(seen.values());

    try { candleRef.current.setData(dedupedCandles); } catch (e) {}

    // 2. Volume Bars
    if (showVolume && volumeRef.current) {
      const volumeData = rawHistory
        .map(d => ({
          time: toChartTime(d.date, intraday),
          value: Number(d.volume || 0),
          color: Number(d.close) >= Number(d.open) ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
        }))
        .filter(d => d.time != null && !isNaN(d.time));
      
      const vSeen = new Map();
      volumeData.forEach(v => vSeen.set(v.time, v));
      try { volumeRef.current.setData(Array.from(vSeen.values())); } catch {}
    } else {
      try { volumeRef.current?.setData([]); } catch {}
    }

    // 3. Technical Indicators (SMA, EMA, BB)
    if (showSMA && smaRef.current && dedupedCandles.length > 20) {
      try { smaRef.current.setData(calculateSMA(dedupedCandles, 20)); } catch {}
    } else { try { smaRef.current?.setData([]); } catch {} }

    if (showEMA && emaRef.current && dedupedCandles.length > 20) {
      try { emaRef.current.setData(calculateEMA(dedupedCandles, 20)); } catch {}
    } else { try { emaRef.current?.setData([]); } catch {} }

    if (showBB && bbUpperRef.current && bbLowerRef.current && dedupedCandles.length > 20) {
      const { upper, lower } = calculateBollingerBands(dedupedCandles, 20, 2);
      try {
        bbUpperRef.current.setData(upper);
        bbLowerRef.current.setData(lower);
      } catch {}
    } else {
      try { bbUpperRef.current?.setData([]); bbLowerRef.current?.setData([]); } catch {}
    }

    // 4. AI Prediction Lines (Daily only)
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
      } catch {}
    } else {
      try {
        predLineRef.current?.setData([]);
        upperLineRef.current?.setData([]);
        lowerLineRef.current?.setData([]);
      } catch {}
    }

    chartRef.current?.timeScale().fitContent();
  }, [rawHistory, prediction, interval, showVolume, showSMA, showEMA, showBB]);

  /* ── Real-time Update ─────────────────────────────────────── */

  useEffect(() => {
    if (!candleRef.current || !livePrice || !rawHistory?.length) return;

    const last     = rawHistory[rawHistory.length - 1];
    const intraday = !isDaily;

    try {
      candleRef.current.update({
        time  : toChartTime(last.date, intraday),
        open  : Number(last.open),
        high  : Math.max(Number(last.high), livePrice),
        low   : Math.min(Number(last.low),  livePrice),
        close : livePrice,
      });
    } catch {}

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

  /* ── Header Search Handler ────────────────────────────────── */

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const res = await searchStock(searchQuery.trim());
    setIsSearching(false);
    if (res?.ticker) {
      setSelectedSymbol(res.ticker);
      setSearchQuery('');
      toast.success(`Loaded ${res.ticker}`);
    } else {
      toast.error('Stock not found');
    }
  };

  /* ── Snapshot Handler ─────────────────────────────────────── */

  const handleSnapshot = () => {
    if (!chartRef.current) return;
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `StockOracle_${selectedSymbol}_${period}.png`;
    link.href = image;
    link.click();
    toast.success('Chart Snapshot Downloaded 📸');
  };

  /* ── Fullscreen Toggle ────────────────────────────────────── */

  const toggleFullscreen = () => {
    if (!cardContainerRef.current) return;
    if (!document.fullscreenElement) {
      cardContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  /* ── Derived Header & Stats values ────────────────────────── */

  const lastCandleClose = rawHistory?.length ? rawHistory[rawHistory.length - 1]?.close : null;
  const curPrice  = livePrice ?? lastCandleClose ?? prediction?.current_price;
  const changeUp  = (liveChange ?? 0) >= 0;
  const sig       = prediction?.signal;
  const sigMeta   = SIG[sig] ?? SIG.hold;
  const score     = prediction?.ai_confidence_score ?? 0;
  const scoreColor = score >= 70 ? '#26A69A' : score >= 50 ? '#F59E0B' : '#EF5350';

  return (
    <div ref={cardContainerRef} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16, minHeight:'100vh', background:'#090C18' }}>

      {/* ── CSS Animations & Styles ── */}
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
        .pill-btn { transition:all 0.2s; cursor:pointer; }
        .pill-btn:hover { background:rgba(168,85,247,0.2)!important; color:#C084FC!important; }
      `}</style>

      {/* ── Top Bar: Quick Stock Watchlist & Search ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', background:'rgba(255,255,255,0.02)', padding:'10px 16px', borderRadius:14, border:'1px solid rgba(168,85,247,0.1)' }}>
        
        {/* Watchlist Pills */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.65rem', color:'#4B5563', letterSpacing:'0.08em', fontWeight:700, marginRight:4 }}>WATCHLIST</span>
          {POPULAR_STOCKS.map(sym => (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className="pill-btn"
              style={{
                padding:'4px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700,
                border: selectedSymbol === sym ? '1px solid #A855F7' : '1px solid rgba(75,85,99,0.3)',
                background: selectedSymbol === sym ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.03)',
                color: selectedSymbol === sym ? '#C084FC' : '#9CA3AF',
              }}
            >
              {sym}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
            <Search size={14} style={{ position:'absolute', left:10, color:'#6B7280' }} />
            <input
              type="text"
              placeholder="Search ticker (e.g. INFY)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding:'5px 10px 5px 30px', borderRadius:8, border:'1px solid rgba(168,85,247,0.2)',
                background:'rgba(15,23,42,0.8)', color:'#F0F0FF', fontSize:'0.75rem', width:180, outline:'none',
              }}
            />
          </div>
          <button type="submit" style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'#A855F7', color:'#fff', fontSize:'0.72rem', fontWeight:700, cursor:'pointer' }}>
            {isSearching ? '...' : 'Go'}
          </button>
        </form>
      </div>

      {/* ── Main Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>

        {/* Ticker & Live Price */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h2 style={{ margin:0, fontSize:'1.65rem', fontWeight:800, color:'#F0F0FF', letterSpacing:'-0.02em' }}>
              {selectedSymbol}
            </h2>

            {/* LIVE Badge */}
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

            {/* Action Buttons: Alert, Snapshot, Fullscreen */}
            <div style={{ display:'flex', gap:6, marginLeft:10 }}>
              <button
                onClick={() => setShowAlertModal(true)}
                title="Set Price Alert"
                style={{ padding:'5px 8px', borderRadius:6, border:'1px solid rgba(168,85,247,0.3)', background:'rgba(168,85,247,0.1)', color:'#C084FC', cursor:'pointer' }}
              >
                <Bell size={14} />
              </button>
              <button
                onClick={handleSnapshot}
                title="Take Chart Snapshot"
                style={{ padding:'5px 8px', borderRadius:6, border:'1px solid rgba(38,166,154,0.3)', background:'rgba(38,166,154,0.1)', color:'#26A69A', cursor:'pointer' }}
              >
                <Camera size={14} />
              </button>
              <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
                style={{ padding:'5px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)', color:'#fff', cursor:'pointer' }}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
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

        {/* Right: Interval + Period Selectors */}
        <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>

          {/* CANDLE Row */}
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

          {/* RANGE Row */}
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

      {/* ── Chart Container ── */}
      <div style={{
        background:'rgba(255,255,255,0.015)',
        border:'1px solid rgba(168,85,247,0.10)',
        borderRadius:18, overflow:'hidden',
        position:'relative',
      }}>

        {/* Toolbar & Indicators Bar */}
        <div style={{ display:'flex', gap:12, padding:'10px 16px 0', fontSize:'0.71rem', color:'#4B5563', flexWrap:'wrap', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:10 }}>
          
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:'0.65rem', color:'#6B7280', fontWeight:700, marginRight:2 }}>INDICATORS:</span>
            
            {/* Volume Toggle */}
            <button
              onClick={() => setShowVolume(!showVolume)}
              style={{
                padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer',
                border: showVolume ? '1px solid #26A69A' : '1px solid rgba(75,85,99,0.3)',
                background: showVolume ? 'rgba(38,166,154,0.15)' : 'transparent',
                color: showVolume ? '#26A69A' : '#6B7280',
              }}
            >
              VOL {showVolume ? <Eye size={10} style={{ display:'inline', marginLeft:3 }} /> : <EyeOff size={10} style={{ display:'inline', marginLeft:3 }} />}
            </button>

            {/* SMA 20 Toggle */}
            <button
              onClick={() => setShowSMA(!showSMA)}
              style={{
                padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer',
                border: showSMA ? '1px solid #00E5FF' : '1px solid rgba(75,85,99,0.3)',
                background: showSMA ? 'rgba(0,229,255,0.15)' : 'transparent',
                color: showSMA ? '#00E5FF' : '#6B7280',
              }}
            >
              SMA 20
            </button>

            {/* EMA 20 Toggle */}
            <button
              onClick={() => setShowEMA(!showEMA)}
              style={{
                padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer',
                border: showEMA ? '1px solid #FF9100' : '1px solid rgba(75,85,99,0.3)',
                background: showEMA ? 'rgba(255,145,0,0.15)' : 'transparent',
                color: showEMA ? '#FF9100' : '#6B7280',
              }}
            >
              EMA 20
            </button>

            {/* Bollinger Bands Toggle */}
            <button
              onClick={() => setShowBB(!showBB)}
              style={{
                padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer',
                border: showBB ? '1px solid #E040FB' : '1px solid rgba(75,85,99,0.3)',
                background: showBB ? 'rgba(224,64,251,0.15)' : 'transparent',
                color: showBB ? '#E040FB' : '#6B7280',
              }}
            >
              BOLL (20,2)
            </button>
          </div>

          {/* Legend Items */}
          <div style={{ marginLeft:'auto', display:'flex', gap:14, alignItems:'center' }}>
            <span><span style={{ color:'#26A69A' }}>█</span> Bullish</span>
            <span><span style={{ color:'#EF5350' }}>█</span> Bearish</span>
            {isDaily && prediction && (
              <span style={{ borderBottom:'2px dashed #A855F7', paddingBottom:1 }}>── AI Target</span>
            )}
          </div>
        </div>

        {/* Loading Spinner Overlay */}
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

        {/* Chart Mounting Div */}
        <div ref={containerRef} style={{ width:'100%', height:500 }} />
      </div>

      {/* ── Price Alert Modal ── */}
      {showAlertModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'#121629', border:'1px solid #A855F7', borderRadius:16, padding:24, width:320, display:'flex', flexDirection:'column', gap:14 }}>
            <h3 style={{ margin:0, color:'#F0F0FF', fontSize:'1.1rem', display:'flex', alignItems:'center', gap:8 }}>
              <Bell size={18} color="#A855F7" /> Set Price Alert for {selectedSymbol}
            </h3>
            <p style={{ margin:0, color:'#9CA3AF', fontSize:'0.78rem' }}>
              Notify me when live price reaches or crosses this target price:
            </p>
            <input
              type="number"
              placeholder={`Current: ₹${curPrice || '0'}`}
              value={targetAlertPrice}
              onChange={e => setTargetAlertPrice(e.target.value)}
              style={{ padding:'8px 12px', borderRadius:8, border:'1px solid rgba(168,85,247,0.3)', background:'#090C18', color:'#fff', fontSize:'0.9rem', outline:'none' }}
            />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowAlertModal(false)} style={{ padding:'6px 12px', borderRadius:8, border:'none', background:'#374151', color:'#fff', cursor:'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  if (targetAlertPrice) {
                    toast.success(`Alert set for ${selectedSymbol} at ₹${targetAlertPrice}`);
                    setShowAlertModal(false);
                  }
                }}
                style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#A855F7', color:'#fff', fontWeight:700, cursor:'pointer' }}
              >
                Save Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Bar (Daily Only) ── */}
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

          {/* Signal Pill */}
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

      {/* ── Confidence Score Bar (Daily Only) ── */}
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

      {/* ── Intraday Note ── */}
      {!isDaily && (
        <div style={{
          background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)',
          borderRadius:10, padding:'10px 14px', fontSize:'0.76rem', color:'#818CF8',
        }}>
          🔵 Intraday mode — Technical indicators (SMA, EMA, Volume) active. Switch to <strong>1D</strong> candle interval for 7-day AI forecasts.
        </div>
      )}

    </div>
  );
}
