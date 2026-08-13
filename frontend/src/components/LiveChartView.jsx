import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Maximize2, Minimize2, Camera, Bell, Search, 
  Columns, Square, Eye, EyeOff, Sparkles, TrendingUp
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
  { label: '5Y', value: '5Y' },
];

const DEFAULT_INTERVAL = {
  '1D': '5m', '5D': '15m', '1W': '1h',
  '1M': '1d', '3M': '1d', '6M': '1d', '1Y': '1d', '2Y': '1d', '5Y': '1d',
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
    for (let j = 0; j < period; j++) sum += data[i - j].close;
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
    for (let j = 0; j < period; j++) variance += Math.pow(data[i - j].close - mean, 2);
    const stdDev = Math.sqrt(variance / period);
    upper.push({ time: data[i].time, value: mean + multiplier * stdDev });
    lower.push({ time: data[i].time, value: mean - multiplier * stdDev });
  }
  return { upper, lower };
}

/** Relative Strength Index (RSI 14) */
function calculateRSI(data, period = 14) {
  if (!data || data.length <= period) return [];
  const result = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({ time: data[period].time, value: 100 - (100 / (1 + firstRS)) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    result.push({ time: data[i].time, value: Math.min(Math.max(rsi, 0), 100) });
  }
  return result;
}

/** AI Candlestick Pattern Detector */
function detectPatterns(data) {
  if (!data || data.length < 5) return [];
  const markers = [];

  for (let i = 2; i < data.length; i++) {
    const curr = data[i];
    const prev = data[i - 1];

    const prevO = prev.open, prevC = prev.close;
    const currO = curr.open, currC = curr.close;
    const currH = curr.high, currL = curr.low;

    const isPrevRed = prevC < prevO;
    const isCurrGreen = currC > currO;
    const isPrevGreen = prevC > prevO;
    const isCurrRed = currC < currO;

    // 1. Bullish Engulfing
    if (isPrevRed && isCurrGreen && currO <= prevC && currC >= prevO) {
      markers.push({
        time: curr.time,
        position: 'belowBar',
        color: '#10B981',
        shape: 'arrowUp',
        text: 'Bullish Engulfing',
      });
      continue;
    }

    // 2. Bearish Engulfing
    if (isPrevGreen && isCurrRed && currO >= prevC && currC <= prevO) {
      markers.push({
        time: curr.time,
        position: 'aboveBar',
        color: '#EF5350',
        shape: 'arrowDown',
        text: 'Bearish Engulfing',
      });
      continue;
    }

    // 3. Hammer Pattern
    const body = Math.abs(currC - currO);
    const lowerWick = Math.min(currO, currC) - currL;
    const upperWick = currH - Math.max(currO, currC);
    if (lowerWick > 2 * body && upperWick < body * 0.5 && body > 0) {
      markers.push({
        time: curr.time,
        position: 'belowBar',
        color: '#3B82F6',
        shape: 'circle',
        text: 'Hammer',
      });
    }
  }

  return markers.slice(-12);
}

function parseNum(val) {
  if (val == null) return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : val;
  const n = Number(String(val).replace(/,/g, ''));
  return isNaN(n) ? NaN : n;
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

/* ─── Lightweight Charts Theme Options ───────────────────────────────────────── */

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
    scaleMargins    : { top: 0.08, bottom: 0.28 },
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
  borderVisible  : true,
  borderUpColor  : '#26A69A',
  borderDownColor: '#EF5350',
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

  // Split View & Comparison State
  const [isSplitView, setIsSplitView] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState('NIFTY50');
  const [rawHistoryCompare, setRawHistoryCompare] = useState(null);

  // Indicator Toggles
  const [showVolume,   setShowVolume]   = useState(true);
  const [showSMA,      setShowSMA]      = useState(false);
  const [showEMA,      setShowEMA]      = useState(false);
  const [showBB,       setShowBB]       = useState(false);
  const [showRSI,      setShowRSI]      = useState(false);
  const [showPatterns, setShowPatterns] = useState(true);

  // Search & Alert State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [targetAlertPrice, setTargetAlertPrice] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chart 1 Refs
  const cardContainerRef = useRef(null);
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const candleRef      = useRef(null);
  const volumeRef      = useRef(null);
  const smaRef         = useRef(null);
  const emaRef         = useRef(null);
  const bbUpperRef     = useRef(null);
  const bbLowerRef     = useRef(null);
  const rsiRef         = useRef(null);
  const rsiLine70Ref   = useRef(null);
  const rsiLine30Ref   = useRef(null);

  const predLineRef    = useRef(null);
  const upperLineRef   = useRef(null);
  const lowerLineRef   = useRef(null);
  const livePriceLineRef = useRef(null);

  // Chart 2 (Comparison) Refs
  const containerRef2  = useRef(null);
  const chartRef2      = useRef(null);
  const candleRef2     = useRef(null);

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

  /* ── Primary Chart Init ───────────────────────────────────── */

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width : containerRef.current.clientWidth,
      height: 520,
    });
    chartRef.current = chart;

    // Candlesticks
    const candle = chart.addCandlestickSeries(CANDLE_STYLE);
    candleRef.current = candle;

    // Volume Sub-chart (overlay scale with scaleMargins)
    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeRef.current = volume;

    // SMA, EMA, BB
    const sma = chart.addLineSeries({ color: '#00E5FF', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    smaRef.current = sma;

    const ema = chart.addLineSeries({ color: '#FF9100', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    emaRef.current = ema;

    const bbUpper = chart.addLineSeries({ color: '#E040FB', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbUpperRef.current = bbUpper;

    const bbLower = chart.addLineSeries({ color: '#E040FB', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbLowerRef.current = bbLower;

    // RSI Sub-chart (overlay scale with scaleMargins)
    const rsi = chart.addLineSeries({
      color: '#F43F5E', lineWidth: 1.5,
      priceScaleId: '',
      scaleMargins: { top: 0.82, bottom: 0 },
      priceLineVisible: false, lastValueVisible: true,
    });
    rsiRef.current = rsi;

    const rsi70 = chart.addLineSeries({ color: 'rgba(239,83,80,0.6)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceScaleId: '', scaleMargins: { top: 0.82, bottom: 0 }, priceLineVisible: false, lastValueVisible: false });
    rsiLine70Ref.current = rsi70;

    const rsi30 = chart.addLineSeries({ color: 'rgba(38,166,154,0.6)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceScaleId: '', scaleMargins: { top: 0.82, bottom: 0 }, priceLineVisible: false, lastValueVisible: false });
    rsiLine30Ref.current = rsi30;

    // AI Predictions
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
      rsiRef.current = null;
      rsiLine70Ref.current = null;
      rsiLine30Ref.current = null;
      predLineRef.current = null;
      upperLineRef.current = null;
      lowerLineRef.current = null;
      livePriceLineRef.current = null;
    };
  }, []);

  /* ── Comparison Chart Init (Dual Split View) ──────────────── */

  useEffect(() => {
    if (!isSplitView || !containerRef2.current) return;

    const chart2 = createChart(containerRef2.current, {
      ...CHART_OPTIONS,
      width : containerRef2.current.clientWidth,
      height: 520,
    });
    chartRef2.current = chart2;

    const candle2 = chart2.addCandlestickSeries(CANDLE_STYLE);
    candleRef2.current = candle2;

    const ro2 = new ResizeObserver(entries => {
      if (entries[0] && chartRef2.current) {
        chartRef2.current.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    ro2.observe(containerRef2.current);

    return () => {
      ro2.disconnect();
      chart2.remove();
      chartRef2.current = null;
      candleRef2.current = null;
    };
  }, [isSplitView]);

  /* ── Primary Data Fetch ──────────────────────────────────── */

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

  /* ── Comparison Stock Data Fetch ──────────────────────────── */

  useEffect(() => {
    if (!isSplitView) return;
    fetchHistory(compareSymbol, period, interval).then(hist => {
      setRawHistoryCompare(hist);
    });
  }, [isSplitView, compareSymbol, period, interval]);

  /* ── WebSocket Feed ───────────────────────────────────────── */

  useEffect(() => {
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(`${WS_BASE}/ws/prices`);
    wsRef.current = ws;

    ws.onopen  = () => {
      setWsConnected(true);
      const subs = [selectedSymbol];
      if (isSplitView && compareSymbol) {
        subs.push(compareSymbol);
      }
      ws.send(JSON.stringify({ subscribe: subs }));
    };
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = e => {
      try {
        const { ticker, price, change_pct } = JSON.parse(e.data);
        if (ticker === selectedSymbol) {
          setLivePrice(price);
          setLiveChange(change_pct);

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
  }, [selectedSymbol, targetAlertPrice, compareSymbol, isSplitView]);

  /* ── Primary Chart Data Binding & Pattern Markers ─────────── */

  useEffect(() => {
    if (!candleRef.current) return;
    if (!Array.isArray(rawHistory) || !rawHistory.length) {
      try {
        candleRef.current.setData([]);
        candleRef.current.setMarkers([]);
        volumeRef.current?.setData([]);
        smaRef.current?.setData([]);
        emaRef.current?.setData([]);
        bbUpperRef.current?.setData([]);
        bbLowerRef.current?.setData([]);
        rsiRef.current?.setData([]);
        rsiLine70Ref.current?.setData([]);
        rsiLine30Ref.current?.setData([]);
        predLineRef.current?.setData([]);
        upperLineRef.current?.setData([]);
        lowerLineRef.current?.setData([]);
      } catch {}
      return;
    }

    const intraday = !isDaily;

    // 1. Build Candles with IQR Outlier Filtering & High/Low validity safety
    const validRaw = rawHistory.filter(d => d && d.date && !isNaN(parseNum(d.close)) && parseNum(d.close) > 0);
    if (!validRaw.length) return;

    // Collect closes & compute IQR bounds (Q1, Q3, IQR)
    const closes = validRaw.map(d => parseNum(d.close)).sort((a, b) => a - b);
    const q1 = closes[Math.floor((closes.length - 1) * 0.25)] || closes[0];
    const q3 = closes[Math.floor((closes.length - 1) * 0.75)] || closes[closes.length - 1];
    const iqr = q3 - q1;
    const lowerBound = Math.max(0, q1 - 2.5 * iqr);
    const upperBound = iqr > 0 ? q3 + 2.5 * iqr : closes[closes.length - 1] * 3;

    const candles = validRaw
      .map(d => {
        const o = parseNum(d.open);
        const h = parseNum(d.high);
        const l = parseNum(d.low);
        const c = parseNum(d.close);
        return {
          time  : toChartTime(d.date, intraday),
          open  : o,
          high  : Math.max(h, o, c),
          low   : Math.min(l, o, c),
          close : c,
        };
      })
      .filter(d => d.time != null && d.time !== '' && !isNaN(d.open) && !isNaN(d.close))
      .filter(d => d.close >= lowerBound && d.close <= upperBound);

    candles.sort((a, b) => (typeof a.time === 'number' ? a.time - b.time : String(a.time).localeCompare(String(b.time))));

    const seen = new Map();
    candles.forEach(c => seen.set(c.time, c));
    const dedupedCandles = Array.from(seen.values());

    try { candleRef.current.setData(dedupedCandles); } catch (e) {}

    // Pattern Badges Overlay
    if (showPatterns) {
      try {
        const patternMarkers = detectPatterns(dedupedCandles);
        candleRef.current.setMarkers(patternMarkers);
      } catch {}
    } else {
      try { candleRef.current.setMarkers([]); } catch {}
    }

    // 2. Volume Bars
    if (showVolume && volumeRef.current) {
      const volumeData = rawHistory
        .map(d => ({
          time: toChartTime(d.date, intraday),
          value: Number(d.volume || 0),
          color: Number(d.close) >= Number(d.open) ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)',
        }))
        .filter(d => d.time != null && d.time !== '' && !isNaN(d.value));
      
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

    // 4. RSI Sub-chart
    if (showRSI && rsiRef.current && dedupedCandles.length > 14) {
      const rsiVals = calculateRSI(dedupedCandles, 14);
      try {
        rsiRef.current.setData(rsiVals);
        if (rsiVals.length > 0) {
          const t1 = rsiVals[0].time;
          const t2 = rsiVals[rsiVals.length - 1].time;
          rsiLine70Ref.current?.setData([{ time: t1, value: 70 }, { time: t2, value: 70 }]);
          rsiLine30Ref.current?.setData([{ time: t1, value: 30 }, { time: t2, value: 30 }]);
        }
      } catch {}
    } else {
      try {
        rsiRef.current?.setData([]);
        rsiLine70Ref.current?.setData([]);
        rsiLine30Ref.current?.setData([]);
      } catch {}
    }

    // 5. AI Predictions (Daily only, valid target price)
    if (isDaily && prediction?.predicted_price_7d > 0 && rawHistory.length > 0 && Number(rawHistory[rawHistory.length - 1]?.close) > 0) {
      const lastD    = rawHistory[rawHistory.length - 1];
      const lastTime = toChartTime(lastD.date, false);
      const lastClose = Number(lastD.close);
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

    const timer = setTimeout(() => {
      try { chartRef.current?.timeScale().fitContent(); } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [rawHistory, prediction, interval, showVolume, showSMA, showEMA, showBB, showRSI, showPatterns]);

  /* ── Secondary Comparison Chart Data Binding ───────────────── */

  useEffect(() => {
    if (!isSplitView || !candleRef2.current || !rawHistoryCompare?.length) return;
    const intraday = !isDaily;

    const candles2 = rawHistoryCompare
      .filter(d => d.open != null && d.high != null && d.low != null && d.close != null)
      .map(d => ({
        time  : toChartTime(d.date, intraday),
        open  : Number(d.open),
        high  : Number(d.high),
        low   : Number(d.low),
        close : Number(d.close),
      }))
      .filter(d => d.time != null && d.time !== '' && !isNaN(d.open));

    candles2.sort((a, b) => (typeof a.time === 'number' ? a.time - b.time : String(a.time).localeCompare(String(b.time))));

    const seen2 = new Map();
    candles2.forEach(c => seen2.set(c.time, c));
    try {
      candleRef2.current.setData(Array.from(seen2.values()));
      chartRef2.current?.timeScale().fitContent();
    } catch {}
  }, [isSplitView, rawHistoryCompare, interval]);

  /* ── Real-time Price Update ───────────────────────────────── */

  useEffect(() => {
    if (!candleRef.current || !rawHistory || !Array.isArray(rawHistory) || !rawHistory.length || livePrice == null) return;

    const last      = rawHistory[rawHistory.length - 1];
    if (!last || last.close == null) return;
    const lastClose = parseNum(last.close);
    const intraday  = !isDaily;

    // Sanity check: ignore out-of-range live ticks (> 10% deviation) to prevent abnormal candle spikes
    if (lastClose > 0 && Math.abs(livePrice - lastClose) / lastClose > 0.10) {
      console.warn(`⚠️ [LiveTick] Dropping live price tick spike ${livePrice} for ${selectedSymbol} (last close: ${lastClose})`);
      return;
    }

    try {
      candleRef.current.update({
        time  : toChartTime(last.date, intraday),
        open  : Number(last.open),
        high  : Math.max(Number(last.high), Number(last.open), livePrice),
        low   : Math.min(Number(last.low),  Number(last.open), livePrice),
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

  /* ── Header Handlers ──────────────────────────────────────── */

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

  const toggleFullscreen = () => {
    if (!cardContainerRef.current) return;
    if (!document.fullscreenElement) {
      cardContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  /* ── Derived Header & Stats values ────────────────────────── */

  const lastCandleClose = Array.isArray(rawHistory) && rawHistory.length ? rawHistory[rawHistory.length - 1]?.close : null;
  const curPrice  = livePrice ?? lastCandleClose ?? prediction?.current_price;
  const changeUp  = (liveChange ?? 0) >= 0;
  const sig       = prediction?.signal;
  const sigMeta   = SIG[sig] ?? SIG.hold;
  const score     = prediction?.ai_confidence_score ?? 0;
  const scoreColor = score >= 70 ? '#26A69A' : score >= 50 ? '#F59E0B' : '#EF5350';

  return (
    <div ref={cardContainerRef} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16, minHeight:'100vh', background:'linear-gradient(160deg,#060810 0%,#090C1A 50%,#07090F 100%)' }}>

      {/* ── Embedded Styles ── */}
      <style>{`
        @keyframes livePulse { 0%,100%{box-shadow:0 0 0 0 rgba(38,166,154,0.6);} 50%{box-shadow:0 0 0 8px rgba(38,166,154,0);} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes shimmer   { 0%{background-position:-600px 0;} 100%{background-position:600px 0;} }
        @keyframes spin      { to{transform:rotate(360deg);} }
        @keyframes priceIn   { from{opacity:0;transform:translateY(-4px) scale(0.96);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes borderGlow{ 0%,100%{border-color:rgba(168,85,247,0.15);} 50%{border-color:rgba(168,85,247,0.38);} }

        .lc-stat {
          animation: fadeUp 0.4s ease both;
          transition: transform 0.2s ease, border-color 0.25s, box-shadow 0.25s, background 0.25s;
        }
        .lc-stat:hover {
          transform: translateY(-2px);
          border-color: rgba(168,85,247,0.35) !important;
          box-shadow: 0 8px 24px rgba(168,85,247,0.12) !important;
          background: rgba(168,85,247,0.07) !important;
        }
        .lc-btn { transition: all 0.18s ease; }
        .lc-btn:hover { opacity: 1 !important; }

        .pill-btn { transition: all 0.2s ease; }
        .pill-btn:hover {
          background: rgba(168,85,247,0.18) !important;
          color: #C084FC !important;
          border-color: rgba(168,85,247,0.4) !important;
          transform: translateY(-1px);
        }
        .ind-btn { transition: all 0.18s ease; }
        .ind-btn:hover { transform: translateY(-1px); filter: brightness(1.15); }

        .chart-card {
          background: rgba(255,255,255,0.018);
          border: 1px solid rgba(168,85,247,0.12);
          border-radius: 20px;
          overflow: hidden;
          transition: border-color 0.3s;
          box-shadow: 0 4px 32px rgba(0,0,0,0.35);
        }
        .chart-card:hover { border-color: rgba(168,85,247,0.22); }

        .watchlist-bar {
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .action-btn {
          padding: 6px 9px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.18s ease;
          display: flex; align-items: center;
        }
        .action-btn:hover { transform: translateY(-1px); filter: brightness(1.2); }

        .shimmer-bar {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
      `}</style>

      {/* ── TOP WATCHLIST BAR ── */}
      <div className="watchlist-bar">
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.6rem', color:'#4B5563', letterSpacing:'0.1em', fontWeight:700, marginRight:4, textTransform:'uppercase' }}>Watchlist</span>
          {POPULAR_STOCKS.map(sym => (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className="pill-btn"
              style={{
                padding:'4px 11px', borderRadius:20, fontSize:'0.71rem', fontWeight:700,
                border: selectedSymbol === sym ? '1px solid rgba(168,85,247,0.7)' : '1px solid rgba(255,255,255,0.08)',
                background: selectedSymbol === sym
                  ? 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(99,102,241,0.15))'
                  : 'rgba(255,255,255,0.03)',
                color: selectedSymbol === sym ? '#C084FC' : '#6B7280',
                cursor:'pointer',
              }}
            >{sym}</button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
            <Search size={13} style={{ position:'absolute', left:9, color:'#4B5563', pointerEvents:'none' }} />
            <input
              type="text"
              placeholder="Search NSE ticker…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding:'6px 10px 6px 28px', borderRadius:9, width:190,
                border:'1px solid rgba(168,85,247,0.18)', outline:'none',
                background:'rgba(15,23,42,0.85)', backdropFilter:'blur(8px)',
                color:'#F0F0FF', fontSize:'0.74rem',
                transition:'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor='rgba(168,85,247,0.5)'}
              onBlur={e => e.target.style.borderColor='rgba(168,85,247,0.18)'}
            />
          </div>
          <button type="submit" style={{
            padding:'6px 13px', borderRadius:9, border:'none',
            background:'linear-gradient(135deg,#A855F7,#7C3AED)',
            color:'#fff', fontSize:'0.72rem', fontWeight:700, cursor:'pointer',
            boxShadow:'0 2px 12px rgba(168,85,247,0.35)',
            transition:'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { e.target.style.transform='translateY(-1px)'; e.target.style.boxShadow='0 4px 18px rgba(168,85,247,0.5)'; }}
            onMouseLeave={e => { e.target.style.transform='translateY(0)'; e.target.style.boxShadow='0 2px 12px rgba(168,85,247,0.35)'; }}
          >
            {isSearching ? '…' : 'Go'}
          </button>
        </form>
      </div>

      {/* ── MAIN HEADER ── */}
      <div style={{
        background:'linear-gradient(135deg,rgba(168,85,247,0.07) 0%,rgba(99,102,241,0.04) 50%,rgba(6,182,212,0.03) 100%)',
        border:'1px solid rgba(168,85,247,0.15)', borderRadius:20,
        padding:'20px 24px', display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap',
        boxShadow:'0 4px 40px rgba(168,85,247,0.06)',
      }}>
        {/* Left: Ticker + Price */}
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {/* Ticker name */}
            <h2 style={{
              margin:0, fontSize:'1.75rem', fontWeight:900, letterSpacing:'-0.03em',
              background:'linear-gradient(135deg,#F0F0FF 30%,#C084FC)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>{selectedSymbol}</h2>

            {/* LIVE badge */}
            <div style={{
              display:'flex', alignItems:'center', gap:5,
              background: wsConnected ? 'rgba(38,166,154,0.1)' : 'rgba(75,85,99,0.1)',
              border:`1px solid ${wsConnected ? 'rgba(38,166,154,0.35)' : 'rgba(75,85,99,0.25)'}`,
              borderRadius:20, padding:'3px 10px',
              transition:'all 0.3s',
            }}>
              <div style={{
                width:7, height:7, borderRadius:'50%',
                background: wsConnected ? '#26A69A' : '#4B5563',
                animation: wsConnected ? 'livePulse 1.8s infinite' : 'none',
              }} />
              <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.08em', color: wsConnected ? '#26A69A' : '#4B5563' }}>
                {wsConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:5, marginLeft:4 }}>
              <button className="action-btn" onClick={() => setIsSplitView(!isSplitView)} title="Toggle Split View"
                style={{
                  border: isSplitView ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: isSplitView ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                  color: isSplitView ? '#60A5FA' : '#6B7280', gap:5, fontSize:'0.71rem', fontWeight:700,
                }}>
                {isSplitView ? <Square size={12}/> : <Columns size={12}/>}
                {isSplitView ? 'Single' : 'Split'}
              </button>
              <button className="action-btn" onClick={() => setShowAlertModal(true)} title="Set Price Alert"
                style={{ border:'1px solid rgba(168,85,247,0.3)', background:'rgba(168,85,247,0.1)', color:'#C084FC' }}>
                <Bell size={14}/>
              </button>
              <button className="action-btn" onClick={handleSnapshot} title="Chart Snapshot"
                style={{ border:'1px solid rgba(38,166,154,0.3)', background:'rgba(38,166,154,0.1)', color:'#26A69A' }}>
                <Camera size={14}/>
              </button>
              <button className="action-btn" onClick={toggleFullscreen} title="Fullscreen"
                style={{ border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', color:'#9CA3AF' }}>
                {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
              </button>
            </div>
          </div>

          {/* Live Price display */}
          {curPrice != null ? (
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:8, animation:'priceIn 0.3s ease' }}>
              <span style={{
                fontSize:'2.2rem', fontWeight:900, fontFamily:'JetBrains Mono, monospace',
                color:'#F0F0FF', letterSpacing:'-0.02em',
                textShadow: changeUp ? '0 0 30px rgba(38,166,154,0.3)' : '0 0 30px rgba(239,83,80,0.3)',
              }}>
                ₹{curPrice.toLocaleString('en-IN',{ minimumFractionDigits:2, maximumFractionDigits:2 })}
              </span>
              {liveChange != null && (
                <span style={{
                  fontSize:'1rem', fontWeight:800, fontFamily:'JetBrains Mono, monospace',
                  color: changeUp ? '#26A69A' : '#EF5350',
                  background: changeUp ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)',
                  border: `1px solid ${changeUp ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)'}`,
                  borderRadius:8, padding:'2px 10px',
                  transition:'color 0.3s, background 0.3s',
                }}>
                  {changeUp ? '▲' : '▼'} {changeUp ? '+' : ''}{liveChange.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <div className="shimmer-bar" style={{ width:180, height:36 }} />
              <div className="shimmer-bar" style={{ width:90, height:36 }} />
            </div>
          )}
        </div>

        {/* Right: Interval + Period selectors */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
          {/* CANDLE interval */}
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:'0.6rem', color:'#374151', letterSpacing:'0.1em', fontWeight:700, marginRight:4, textTransform:'uppercase' }}>Candle</span>
            <div style={{ display:'flex', gap:3, background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'3px' }}>
              {INTERVALS.map(iv => (
                <button key={iv.value} className="lc-btn" onClick={() => handleIntervalChange(iv.value)} style={{
                  padding:'4px 10px', borderRadius:7, fontSize:'0.71rem', fontWeight:700, cursor:'pointer',
                  border:'none',
                  background: interval === iv.value ? 'rgba(99,102,241,0.3)' : 'transparent',
                  color: interval === iv.value ? '#818CF8' : '#4B5563',
                  boxShadow: interval === iv.value ? '0 0 12px rgba(99,102,241,0.25)' : 'none',
                }}>{iv.label}</button>
              ))}
            </div>
          </div>

          {/* RANGE period */}
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:'0.6rem', color:'#374151', letterSpacing:'0.1em', fontWeight:700, marginRight:4, textTransform:'uppercase' }}>Range</span>
            <div style={{ display:'flex', gap:3, background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'3px' }}>
              {PERIODS.map(p => (
                <button key={p.value} className="lc-btn" onClick={() => handlePeriodChange(p.value)} style={{
                  padding:'4px 10px', borderRadius:7, fontSize:'0.71rem', fontWeight:700, cursor:'pointer',
                  border:'none',
                  background: period === p.value ? 'rgba(168,85,247,0.25)' : 'transparent',
                  color: period === p.value ? '#C084FC' : '#4B5563',
                  boxShadow: period === p.value ? '0 0 12px rgba(168,85,247,0.2)' : 'none',
                }}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHART AREA ── */}
      <div style={{ display:'grid', gridTemplateColumns: isSplitView ? '1fr 1fr' : '1fr', gap:16 }}>

        {/* Chart 1 */}
        <div className="chart-card">
          {/* Indicator pills bar */}
          <div style={{
            display:'flex', gap:6, padding:'11px 16px', flexWrap:'wrap', alignItems:'center',
            borderBottom:'1px solid rgba(255,255,255,0.04)',
            background:'rgba(255,255,255,0.012)',
          }}>
            <span style={{ fontSize:'0.6rem', color:'#4B5563', fontWeight:800, letterSpacing:'0.12em', marginRight:4, textTransform:'uppercase' }}>Indicators</span>

            {[
              { key:'vol',  label:'VOL',       active:showVolume,   toggle:()=>setShowVolume(!showVolume),   color:'#26A69A' },
              { key:'sma',  label:'SMA 20',    active:showSMA,      toggle:()=>setShowSMA(!showSMA),         color:'#00E5FF' },
              { key:'ema',  label:'EMA 20',    active:showEMA,      toggle:()=>setShowEMA(!showEMA),         color:'#FF9100' },
              { key:'bb',   label:'BOLL(20,2)',active:showBB,       toggle:()=>setShowBB(!showBB),           color:'#E040FB' },
              { key:'rsi',  label:'RSI 14',    active:showRSI,      toggle:()=>setShowRSI(!showRSI),         color:'#F43F5E' },
            ].map(ind => (
              <button key={ind.key} className="ind-btn" onClick={ind.toggle} style={{
                padding:'3px 10px', borderRadius:7, fontSize:'0.68rem', fontWeight:700, cursor:'pointer',
                border: ind.active ? `1px solid ${ind.color}60` : '1px solid rgba(75,85,99,0.25)',
                background: ind.active ? `${ind.color}18` : 'rgba(255,255,255,0.03)',
                color: ind.active ? ind.color : '#4B5563',
                boxShadow: ind.active ? `0 0 10px ${ind.color}25` : 'none',
              }}>{ind.label}</button>
            ))}

            <button className="ind-btn" onClick={() => setShowPatterns(!showPatterns)} style={{
              padding:'3px 10px', borderRadius:7, fontSize:'0.68rem', fontWeight:700, cursor:'pointer',
              border: showPatterns ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(75,85,99,0.25)',
              background: showPatterns ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
              color: showPatterns ? '#10B981' : '#4B5563',
              display:'flex', alignItems:'center', gap:4,
              boxShadow: showPatterns ? '0 0 10px rgba(16,185,129,0.2)' : 'none',
            }}>
              <Sparkles size={10}/> AI Patterns
            </button>

            <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center', fontSize:'0.67rem', color:'#374151' }}>
              <span><span style={{ color:'#26A69A', marginRight:4 }}>█</span>Bull</span>
              <span><span style={{ color:'#EF5350', marginRight:4 }}>█</span>Bear</span>
              {isDaily && prediction && (
                <span style={{ color:'#A855F7', borderBottom:'1.5px dashed #A855F7', paddingBottom:1 }}>── AI Target</span>
              )}
            </div>
          </div>

          {/* Loading overlay */}
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(6,8,16,0.82)', backdropFilter:'blur(4px)', zIndex:10, borderRadius:20, gap:14 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(168,85,247,0.15)', borderTopColor:'#A855F7', animation:'spin 0.8s linear infinite' }} />
              <span style={{ fontSize:'0.78rem', color:'#6B7280', letterSpacing:'0.05em' }}>Loading chart data…</span>
            </div>
          )}

          <div ref={containerRef} style={{ width:'100%', height:520 }} />
        </div>

        {/* Chart 2 — split view */}
        {isSplitView && (
          <div className="chart-card" style={{ border:'1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ display:'flex', gap:8, padding:'11px 16px', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'rgba(255,255,255,0.012)' }}>
              <TrendingUp size={13} style={{ color:'#60A5FA' }}/>
              <span style={{ fontSize:'0.7rem', color:'#60A5FA', fontWeight:800, letterSpacing:'0.06em' }}>COMPARE</span>
              <select
                value={compareSymbol}
                onChange={e => setCompareSymbol(e.target.value)}
                style={{ background:'rgba(15,23,42,0.9)', color:'#60A5FA', border:'1px solid rgba(59,130,246,0.35)', borderRadius:7, padding:'3px 10px', fontSize:'0.74rem', outline:'none', fontWeight:700, cursor:'pointer' }}
              >
                {POPULAR_STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div ref={containerRef2} style={{ width:'100%', height:520 }} />
          </div>
        )}
      </div>

      {/* ── PRICE ALERT MODAL ── */}
      {showAlertModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target === e.currentTarget && setShowAlertModal(false)}>
          <div style={{
            background:'linear-gradient(135deg,#0F1629,#141B35)',
            border:'1px solid rgba(168,85,247,0.5)', borderRadius:20, padding:28,
            width:340, display:'flex', flexDirection:'column', gap:16,
            boxShadow:'0 20px 60px rgba(168,85,247,0.2)',
            animation:'fadeUp 0.25s ease',
          }}>
            <h3 style={{ margin:0, color:'#F0F0FF', fontSize:'1.1rem', display:'flex', alignItems:'center', gap:8 }}>
              <Bell size={18} color="#A855F7"/> Set Price Alert
              <span style={{ fontSize:'0.85rem', color:'#6B7280', fontWeight:400 }}>for {selectedSymbol}</span>
            </h3>
            <p style={{ margin:0, color:'#6B7280', fontSize:'0.8rem', lineHeight:1.5 }}>
              Get notified when the live price reaches your target:
            </p>
            <input
              type="number"
              placeholder={`Current: ₹${curPrice?.toFixed(2) || '—'}`}
              value={targetAlertPrice}
              onChange={e => setTargetAlertPrice(e.target.value)}
              style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(168,85,247,0.35)', background:'rgba(9,12,24,0.8)', color:'#fff', fontSize:'0.95rem', outline:'none', transition:'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor='rgba(168,85,247,0.7)'}
              onBlur={e => e.target.style.borderColor='rgba(168,85,247,0.35)'}
            />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowAlertModal(false)} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9CA3AF', cursor:'pointer', fontWeight:600 }}>
                Cancel
              </button>
              <button
                onClick={() => { if (targetAlertPrice) { toast.success(`🔔 Alert set for ${selectedSymbol} at ₹${targetAlertPrice}`); setShowAlertModal(false); } }}
                style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#A855F7,#7C3AED)', color:'#fff', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(168,85,247,0.4)' }}
              >
                Save Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS GRID (Daily only) ── */}
      {isDaily && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(142px, 1fr))', gap:10 }}>
          {[
            { label:'CURRENT PRICE',   value: curPrice ? `₹${curPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—', color:'#F0F0FF', glow:'rgba(240,240,255,0.1)', delay:'0ms' },
            { label:'AI TARGET (7D)',  value: prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : predLoading ? '…' : '—', color:'#C084FC', glow:'rgba(168,85,247,0.12)', delay:'50ms' },
            { label:'EXPECTED RETURN', value: prediction?.predicted_return_7d != null ? `${prediction.predicted_return_7d>=0?'+':''}${(prediction.predicted_return_7d*100).toFixed(2)}%` : predLoading ? '…' : '—',
              color: (prediction?.predicted_return_7d ?? 0) >= 0 ? '#26A69A' : '#EF5350',
              glow: (prediction?.predicted_return_7d ?? 0) >= 0 ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)',
              delay:'100ms' },
            { label:'AI CONFIDENCE',   value: prediction?.ai_confidence_score != null ? `${prediction.ai_confidence_score}/100` : predLoading ? '…' : '—', color:scoreColor, glow:`${scoreColor}20`, delay:'150ms' },
            { label:'95% UPPER',       value:(prediction?.predicted_upper_price_7d??prediction?.high_bound) ? `₹${(prediction.predicted_upper_price_7d??prediction.high_bound).toFixed(2)}` : predLoading?'…':'—', color:'#26A69A', glow:'rgba(38,166,154,0.1)', delay:'200ms' },
            { label:'95% LOWER',       value:(prediction?.predicted_lower_price_7d??prediction?.low_bound) ? `₹${(prediction.predicted_lower_price_7d??prediction.low_bound).toFixed(2)}` : predLoading?'…':'—', color:'#EF5350', glow:'rgba(239,83,80,0.1)', delay:'250ms' },
          ].map(({ label, value, color, glow, delay }) => (
            <div key={label} className="lc-stat" style={{
              background:'rgba(255,255,255,0.025)', border:'1px solid rgba(168,85,247,0.1)',
              borderRadius:14, padding:'13px 16px', animationDelay:delay,
              boxShadow:`0 2px 16px ${glow}`,
            }}>
              <div style={{ fontSize:'0.6rem', color:'#4B5563', letterSpacing:'0.1em', marginBottom:7, textTransform:'uppercase', fontWeight:700 }}>{label}</div>
              <div style={{ fontSize:'0.95rem', fontWeight:800, color, fontFamily:'JetBrains Mono, monospace' }}>
                {value === '…' ? <div className="shimmer-bar" style={{ width:80, height:18 }} /> : value}
              </div>
            </div>
          ))}

          {/* Signal pill card */}
          <div className="lc-stat" style={{
            background:sigMeta.bg, border:`1px solid ${sigMeta.border}`,
            borderRadius:14, padding:'13px 16px', animationDelay:'300ms',
            display:'flex', flexDirection:'column', justifyContent:'center',
            boxShadow:`0 4px 20px ${sigMeta.color}20`,
          }}>
            <div style={{ fontSize:'0.6rem', color:'#4B5563', letterSpacing:'0.1em', marginBottom:7, textTransform:'uppercase', fontWeight:700 }}>AI SIGNAL</div>
            <div style={{ fontSize:'1.05rem', fontWeight:900, color:sigMeta.color, fontFamily:'JetBrains Mono, monospace', textShadow:`0 0 20px ${sigMeta.color}60` }}>
              {predLoading ? <div className="shimmer-bar" style={{ width:70, height:20 }} /> : sigMeta.label}
            </div>
          </div>
        </div>
      )}

      {/* ── AI CONFIDENCE BAR (Daily only) ── */}
      {isDaily && prediction?.ai_confidence_score != null && (
        <div style={{
          background:'rgba(255,255,255,0.022)', border:'1px solid rgba(168,85,247,0.1)',
          borderRadius:14, padding:'14px 18px',
          animation:'fadeUp 0.4s ease 320ms both',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:9, fontSize:'0.74rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Sparkles size={13} color={scoreColor}/>
              <span style={{ color:'#6B7280', fontWeight:600 }}>AI Confidence Score</span>
            </div>
            <span style={{ color:scoreColor, fontFamily:'JetBrains Mono, monospace', fontWeight:800, fontSize:'0.85rem' }}>
              {score} <span style={{ color:'#4B5563', fontWeight:400 }}>/ 100</span>
            </span>
          </div>
          <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${score}%`,
              background:`linear-gradient(90deg,${scoreColor}80,${scoreColor})`,
              borderRadius:99, transition:'width 0.8s cubic-bezier(0.4,0,0.2,1)',
              boxShadow:`0 0 12px ${scoreColor}60`,
            }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'0.65rem', color:'#374151' }}>
            <span>Low Confidence</span>
            <span>High Confidence</span>
          </div>
        </div>
      )}

    </div>
  );
}
