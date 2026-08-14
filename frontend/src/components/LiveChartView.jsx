import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Maximize2, Minimize2, Camera, Bell, Search, 
  Columns, Square, Eye, EyeOff, Sparkles, TrendingUp,
  ZoomIn, ZoomOut, Move, RotateCcw, Zap, Activity,
  BarChart3, Layers, Target, ChevronRight, ChevronLeft, X, FlaskConical
} from 'lucide-react';
import toast from 'react-hot-toast';
import DrawingTools from './chart-tools/DrawingTools';
import VolumeProfile from './chart-tools/VolumeProfile';
import OrderFlow from './chart-tools/OrderFlow';
import AIPatternRecognition from './chart-tools/AIPatternRecognition';
import MultiTimeframeCorrelation from './chart-tools/MultiTimeframeCorrelation';

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
    autoScale       : true,
    lockVisibleRange: false,
  },
  timeScale: {
    borderColor     : 'rgba(168,85,247,0.10)',
    textColor       : '#6B7280',
    timeVisible     : true,
    secondsVisible  : false,
    fixLeftEdge     : false,
    fixRightEdge    : false,
    visible         : true,
  },
  handleScroll : { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
  handleScale  : { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  kineticScroll: { touch: true, mouse: true },
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

/* ─── Backtest Overlay Side Panel ────────────────────────────────────────────── */

function BacktestOverlayPanel({ symbol, showBacktest, setShowBacktest, backtestData, backtestLoading }) {
  const cr  = backtestData?.cumulative_return;
  const br  = backtestData?.benchmark_return;
  const alpha = cr != null && br != null ? (cr - br) : null;

  const pct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
  const col = v => v >= 0 ? '#10B981' : '#EF5350';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toggle Button */}
      <button
        onClick={() => setShowBacktest(p => !p)}
        style={{
          width: '100%', padding: '8px 10px',
          borderRadius: 8, border: `1px solid ${showBacktest ? '#10B981' : 'rgba(99,102,241,0.3)'}`,
          background: showBacktest ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.08)',
          color: showBacktest ? '#10B981' : '#8B5CF6',
          fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <FlaskConical size={13} />
        {showBacktest ? '✓ Backtest ON — markers visible' : 'Enable Backtest Overlay'}
      </button>

      {/* Loading */}
      {showBacktest && backtestLoading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Running backtest…</div>
        </div>
      )}

      {/* Legend */}
      {showBacktest && !backtestLoading && (
        <div style={{ display: 'flex', gap: 8, fontSize: '0.68rem' }}>
          <span style={{ color: '#10B981', fontWeight: 700 }}>▲ BUY</span>
          <span style={{ color: '#EF5350', fontWeight: 700 }}>▼ SELL</span>
          <span style={{ color: '#6B7280' }}>shown on chart</span>
        </div>
      )}

      {/* Metrics */}
      {backtestData && !backtestLoading && (() => {
        const { cumulative_return: cr, benchmark_return: br, sharpe_ratio, max_drawdown, win_rate, total_trades, cagr, initial_capital, final_value } = backtestData;
        const alpha = cr - br;
        const rows = [
          { label: 'Strategy Return', value: pct(cr), color: col(cr) },
          { label: 'Benchmark (B&H)', value: pct(br), color: col(br) },
          { label: 'Alpha', value: pct(alpha), color: col(alpha) },
          { label: 'CAGR', value: pct(cagr), color: col(cagr) },
          { label: 'Sharpe', value: sharpe_ratio.toFixed(2), color: sharpe_ratio >= 1 ? '#10B981' : sharpe_ratio >= 0 ? '#F59E0B' : '#EF5350' },
          { label: 'Max Drawdown', value: pct(max_drawdown), color: max_drawdown > -0.1 ? '#10B981' : '#EF5350' },
          { label: 'Win Rate', value: `${(win_rate * 100).toFixed(1)}%`, color: win_rate >= 0.55 ? '#10B981' : '#F59E0B' },
          { label: 'Trades', value: total_trades, color: '#9CA3AF' },
        ];
        return (
          <>
            <div style={{ borderTop: '1px solid rgba(99,102,241,0.1)', paddingTop: 8, fontSize: '0.68rem', color: '#6366F1', fontWeight: 700, letterSpacing: '0.06em' }}>
              PERFORMANCE METRICS
            </div>
            {rows.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: '#6B7280' }}>{r.label}</span>
                <span style={{ color: r.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, fontSize: '0.68rem', color: '#4B5563', lineHeight: 1.5 }}>
              📋 Buy when AI 7d return &gt; 1.5% · Stop-loss 4% · TP 8%
            </div>
          </>
        );
      })()}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export default function LiveChartView() {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const { fetchHistory, fetchPredict, searchStock, fetchBacktest } = useStock();

  const [interval,    setInterval]    = useState('1d');
  const [timeframe,   setTimeframe]   = useState('5Y');
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
  
  // Chart Navigation State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);

  // Advanced Features State
  const [showVolumeProfile, setShowVolumeProfile] = useState(false);
  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const [showAIPatterns, setShowAIPatterns] = useState(false);
  const [showMTFCorrelation, setShowMTFCorrelation] = useState(false);
  const [showDrawings, setShowDrawings] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [advancedPanelTab, setAdvancedPanelTab] = useState('volume');

  // Backtest Overlay State
  const [backtestData, setBacktestData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const backtestEquityRef = useRef(null);

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

  /* ── Interval Handler ─────────────────────────────────────── */

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
    // Reset zoom when changing interval for smooth transition
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }, 100);
  }, []);

  /* ── Chart Navigation Handlers ─────────────────────────────── */

  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (visibleRange) {
      const rangeSize = visibleRange.to - visibleRange.from;
      const newRangeSize = rangeSize * 0.7; // Zoom in by 30%
      const center = (visibleRange.from + visibleRange.to) / 2;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: center - newRangeSize / 2,
        to: center + newRangeSize / 2,
      });
      setZoomLevel(prev => Math.min(prev + 0.3, 3));
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (visibleRange) {
      const rangeSize = visibleRange.to - visibleRange.from;
      const newRangeSize = rangeSize * 1.4; // Zoom out by 40%
      const center = (visibleRange.from + visibleRange.to) / 2;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: center - newRangeSize / 2,
        to: center + newRangeSize / 2,
      });
      setZoomLevel(prev => Math.max(prev - 0.3, 0.3));
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    setZoomLevel(1);
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
      backtestEquityRef.current = null;
    };
  }, []);

  /* ── Backtest Fetch + Chart Markers ──────────────────────────── */

  useEffect(() => {
    if (!showBacktest || !selectedSymbol) return;
    setBacktestData(null);
    setBacktestLoading(true);
    fetchBacktest(selectedSymbol).then(res => {
      setBacktestLoading(false);
      if (!res || res.error) { toast.error('Backtest failed. Train the model first.'); return; }
      setBacktestData(res);

      // ── Plot buy/sell markers on main candlestick chart ──
      if (candleRef.current && res.equity_curve?.length) {
        const MIN_GAP_DAYS = 5; // minimum days between same-type markers
        const MAX_EACH = 10;    // max 10 buy + 10 sell markers

        const allBuys  = res.equity_curve.filter(p => p.action === 'BUY');
        const allSells = res.equity_curve.filter(p => p.action === 'SELL');

        // Deduplicate: keep markers at least MIN_GAP_DAYS apart
        const dedupe = (list) => {
          const out = [];
          let lastDate = null;
          for (const pt of list) {
            if (!lastDate) { out.push(pt); lastDate = pt.date; continue; }
            const diff = (new Date(pt.date) - new Date(lastDate)) / 86400000;
            if (diff >= MIN_GAP_DAYS) { out.push(pt); lastDate = pt.date; }
          }
          return out.slice(-MAX_EACH); // keep last N (most recent)
        };

        const intraday = !isDaily;
        const markers = [
          ...dedupe(allBuys).map(pt => ({
            time: toChartTime(pt.date, intraday),
            position: 'belowBar',
            color: '#10B981',
            shape: 'arrowUp',
            text: `▲ ₹${Number(pt.price).toFixed(0)}`,
            size: 1,
          })),
          ...dedupe(allSells).map(pt => ({
            time: toChartTime(pt.date, intraday),
            position: 'aboveBar',
            color: '#EF5350',
            shape: 'arrowDown',
            text: `▼ ₹${Number(pt.price).toFixed(0)}`,
            size: 1,
          })),
        ]
        .filter(m => m.time != null)
        .sort((a, b) => (typeof a.time === 'number' ? a.time - b.time : String(a.time).localeCompare(String(b.time))));

        if (markers.length) candleRef.current.setMarkers(markers);
      }

      // ── Plot equity curve as separate line series ──
      if (chartRef.current && res.equity_curve?.length && !backtestEquityRef.current) {
        const intraday = !isDaily;
        const equityData = res.equity_curve
          .map(pt => ({
            time: toChartTime(pt.date, intraday),
            value: Number(pt.value ?? pt.equity ?? pt.portfolio_value ?? 0),
          }))
          .filter(pt => pt.time != null && !isNaN(pt.value) && pt.value > 0);
        
        if (equityData.length) {
          backtestEquityRef.current = chartRef.current.addLineSeries({
            color: '#8B5CF6',
            lineWidth: 2,
            title: 'Strategy Equity',
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            scaleMargins: { top: 0.1, bottom: 0.1 },
          });
          
          backtestEquityRef.current.setData(equityData);
        }
      }
    });
    return () => {
      // Remove markers when backtest is toggled off
      if (candleRef.current) candleRef.current.setMarkers([]);
      if (backtestEquityRef.current && chartRef.current) {
        chartRef.current.removeSeries(backtestEquityRef.current);
        backtestEquityRef.current = null;
      }
    };
  }, [showBacktest, selectedSymbol]);

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

    fetchHistory(selectedSymbol, interval, timeframe).then(hist => {
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
  }, [selectedSymbol, interval, timeframe]);

  /* ── Comparison Stock Data Fetch ──────────────────────────── */

  useEffect(() => {
    if (!isSplitView) return;
    fetchHistory(compareSymbol, interval, timeframe).then(hist => {
      setRawHistoryCompare(hist);
    });
  }, [isSplitView, compareSymbol, interval, timeframe]);

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
      try {
        if (chartRef.current && dedupedCandles.length > 0) {
          const total = dedupedCandles.length;
          // Focus view on recent ~120 candles (full size), panning left reveals full 5-year history
          const visibleCount = Math.min(total, 120);
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: total - visibleCount,
            to: total + 3,
          });
        }
      } catch {}
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
    link.download = `StockOracle_${selectedSymbol}_${interval}.png`;
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
    <div ref={cardContainerRef} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16, minHeight:'100vh', background:'#090C18' }}>

      {/* ── CSS Styles ── */}
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

      {/* ── Top Bar: Watchlist & Search ── */}
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

            {/* Action Buttons: Split View, Alert, Snapshot, Fullscreen */}
            <div style={{ display:'flex', gap:6, marginLeft:10 }}>
              <button
                onClick={() => setIsSplitView(!isSplitView)}
                title="Toggle Dual Chart Split View"
                style={{
                  padding:'5px 10px', borderRadius:6,
                  border: isSplitView ? '1px solid #3B82F6' : '1px solid rgba(75,85,99,0.3)',
                  background: isSplitView ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  color: isSplitView ? '#60A5FA' : '#9CA3AF',
                  fontSize:'0.72rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4
                }}
              >
                {isSplitView ? <Square size={13} /> : <Columns size={13} />}
                {isSplitView ? 'Single View' : 'Split View'}
              </button>
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

          {/* Chart Navigation Controls */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="lc-btn"
              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.1)', color:'#818CF8', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
            >
              <ZoomIn size={12} /> <span style={{fontSize:'0.65rem', fontWeight:600}}>Zoom In</span>
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="lc-btn"
              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.1)', color:'#818CF8', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
            >
              <ZoomOut size={12} /> <span style={{fontSize:'0.65rem', fontWeight:600}}>Zoom Out</span>
            </button>
            <button
              onClick={handleResetView}
              title="Reset View"
              className="lc-btn"
              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(168,85,247,0.3)', background:'rgba(168,85,247,0.1)', color:'#C084FC', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
            >
              <RotateCcw size={12} /> <span style={{fontSize:'0.65rem', fontWeight:600}}>Reset</span>
            </button>
            <div style={{ width:1, height:20, background:'rgba(75,85,99,0.3)', margin:'0 4px' }} />
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? "Disable Auto Scroll" : "Enable Auto Scroll"}
              className="lc-btn"
              style={{ padding:'4px 8px', borderRadius:6, border: autoScroll ? '1px solid #26A69A' : '1px solid rgba(75,85,99,0.3)', background: autoScroll ? 'rgba(38,166,154,0.15)' : 'transparent', color: autoScroll ? '#26A69A' : '#6B7280', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
            >
              <Move size={12} /> <span style={{fontSize:'0.65rem', fontWeight:600}}>{autoScroll ? 'Auto-Scroll ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Right: Multi-Timeframe Candle Intervals */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
          {/* Candle Interval Selector (1m, 5m, 15m, 1H, 1D) */}
          <div style={{ display:'flex', alignItems:'center', gap:3, background:'rgba(255,255,255,0.02)', padding:'2px 4px', borderRadius:8, border:'1px solid rgba(99,102,241,0.15)' }}>
            <span style={{ fontSize:'0.58rem', color:'#6B7280', letterSpacing:'0.06em', marginRight:2 }}>INTERVAL</span>
            {INTERVALS.map(iv => (
              <button key={iv.value} className="lc-btn" onClick={() => handleIntervalChange(iv.value)} style={{
                padding:'3px 8px', borderRadius:5, fontSize:'0.68rem', fontWeight:700, cursor:'pointer',
                border    : interval === iv.value ? '1px solid rgba(99,102,241,0.6)' : '1px solid transparent',
                background: interval === iv.value ? 'rgba(99,102,241,0.15)'          : 'transparent',
                color     : interval === iv.value ? '#818CF8'                         : '#6B7280',
              }}>{iv.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Display Section */}
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

      {/* ── Main Chart Area (Single or Split Grid) ── */}
      <div style={{ display:'grid', gridTemplateColumns: isSplitView ? '1fr 1fr' : '1fr', gap:16 }}>
        
        {/* Chart 1 Container */}
        <div style={{
          background:'rgba(255,255,255,0.015)',
          border:'1px solid rgba(168,85,247,0.10)',
          borderRadius:18, overflow:'hidden',
          position:'relative',
        }}>

          {/* Enhanced Indicators Bar with Quick Stats */}
          <div style={{ display:'flex', gap:8, padding:'10px 16px 0', fontSize:'0.71rem', color:'#4B5563', flexWrap:'wrap', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:10 }}>
            <span style={{ fontSize:'0.65rem', color:'#6B7280', fontWeight:700, marginRight:2 }}>INDICATORS:</span>
            
            <button onClick={() => setShowVolume(!showVolume)} style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', border: showVolume ? '1px solid #26A69A' : '1px solid rgba(75,85,99,0.3)', background: showVolume ? 'rgba(38,166,154,0.15)' : 'transparent', color: showVolume ? '#26A69A' : '#6B7280' }}>
              VOL {showVolume ? <Eye size={10} style={{ display:'inline', marginLeft:3 }} /> : <EyeOff size={10} style={{ display:'inline', marginLeft:3 }} />}
            </button>

            <button onClick={() => setShowSMA(!showSMA)} style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', border: showSMA ? '1px solid #00E5FF' : '1px solid rgba(75,85,99,0.3)', background: showSMA ? 'rgba(0,229,255,0.15)' : 'transparent', color: showSMA ? '#00E5FF' : '#6B7280' }}>
              SMA 20
            </button>

            <button onClick={() => setShowEMA(!showEMA)} style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', border: showEMA ? '1px solid #FF9100' : '1px solid rgba(75,85,99,0.3)', background: showEMA ? 'rgba(255,145,0,0.15)' : 'transparent', color: showEMA ? '#FF9100' : '#6B7280' }}>
              EMA 20
            </button>

            <button onClick={() => setShowBB(!showBB)} style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', border: showBB ? '1px solid #E040FB' : '1px solid rgba(75,85,99,0.3)', background: showBB ? 'rgba(224,64,251,0.15)' : 'transparent', color: showBB ? '#E040FB' : '#6B7280' }}>
              BOLL (20,2)
            </button>

            {/* RSI Toggle */}
            <button onClick={() => setShowRSI(!showRSI)} style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', border: showRSI ? '1px solid #F43F5E' : '1px solid rgba(75,85,99,0.3)', background: showRSI ? 'rgba(244,63,94,0.15)' : 'transparent', color: showRSI ? '#F43F5E' : '#6B7280' }}>
              RSI 14 {showRSI ? <Eye size={10} style={{ display:'inline', marginLeft:3 }} /> : <EyeOff size={10} style={{ display:'inline', marginLeft:3 }} />}
            </button>

            {/* AI Pattern Markers Toggle */}
            <button onClick={() => setShowPatterns(!showPatterns)} style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', border: showPatterns ? '1px solid #10B981' : '1px solid rgba(75,85,99,0.3)', background: showPatterns ? 'rgba(16,185,129,0.15)' : 'transparent', color: showPatterns ? '#10B981' : '#6B7280', display:'flex', alignItems:'center', gap:3 }}>
              <Sparkles size={10} /> PATTERNS
            </button>

            {/* Advanced Tools Button */}
            <button 
              onClick={() => { setShowAdvancedPanel(!showAdvancedPanel); if (!showAdvancedPanel) setAdvancedPanelTab('volume'); }}
              style={{ 
                padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', 
                border: showAdvancedPanel ? '1px solid #A855F7' : '1px solid rgba(75,85,99,0.3)', 
                background: showAdvancedPanel ? 'rgba(168,85,247,0.15)' : 'transparent', 
                color: showAdvancedPanel ? '#C084FC' : '#6B7280', 
                display:'flex', alignItems:'center', gap:3 
              }}
            >
              <Layers size={10} /> ADVANCED TOOLS
            </button>

            {/* Quick Trend Indicator */}
            {rawHistory && rawHistory.length >= 20 && (
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.2)' }}>
                <Activity size={10} color="#A855F7" />
                <span style={{ fontSize:'0.65rem', color:'#A855F7', fontWeight:700 }}>
                  TREND: {Number(rawHistory[rawHistory.length-1]?.close) > Number(rawHistory[rawHistory.length-20]?.close) ? '▲ BULLISH' : '▼ BEARISH'}
                </span>
              </div>
            )}

            <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
              <span><span style={{ color:'#26A69A' }}>█</span> Bull</span>
              <span><span style={{ color:'#EF5350' }}>█</span> Bear</span>
              {isDaily && prediction && (
                <span style={{ borderBottom:'2px dashed #A855F7', paddingBottom:1 }}>── AI Target</span>
              )}
            </div>
          </div>

          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(9,12,24,0.75)', zIndex:10, borderRadius:18 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', border:'3px solid rgba(168,85,247,0.15)', borderTopColor:'#A855F7', animation:'spin 0.75s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          <div ref={containerRef} style={{ width:'100%', height:520 }} />
          
          {/* Advanced Tools Panel - Slide-in Sidebar */}
          {showAdvancedPanel && (
            <div style={{
              position: 'absolute',
              top: 60,
              right: 16,
              width: 340,
              maxHeight: 'calc(100% - 120px)',
              background: 'rgba(9,12,24,0.98)',
              border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 12,
              zIndex: 50,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              {/* Panel Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid rgba(168,85,247,0.2)',
                background: 'rgba(168,85,247,0.05)',
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A855F7', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={12} />
                  ADVANCED CHART TOOLS
                </div>
                <button
                  onClick={() => setShowAdvancedPanel(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              
              {/* Tab Navigation */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                padding: 8,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                {[
                  { id: 'volume', label: 'Vol Profile', icon: BarChart3 },
                  { id: 'order', label: 'Order Flow', icon: Activity },
                  { id: 'patterns', label: 'AI Patterns', icon: Zap },
                  { id: 'mtf', label: 'MTF Corr', icon: Target },
                  { id: 'draw', label: 'Drawings', icon: Layers },
                  { id: 'backtest', label: 'Backtest', icon: FlaskConical },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdvancedPanelTab(tab.id)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 6,
                        border: advancedPanelTab === tab.id ? '1px solid #A855F7' : '1px solid rgba(75,85,99,0.3)',
                        background: advancedPanelTab === tab.id ? 'rgba(168,85,247,0.15)' : 'transparent',
                        color: advancedPanelTab === tab.id ? '#C084FC' : '#6B7280',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: '0.55rem',
                        fontWeight: 600,
                      }}
                    >
                      <Icon size={12} />
                      <span style={{ fontSize: '0.52rem' }}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Panel Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 10,
              }}>
                {advancedPanelTab === 'volume' && rawHistory && (
                  <VolumeProfile 
                    candles={rawHistory.map(d => ({
                      time: d.date,
                      open: Number(d.open),
                      high: Number(d.high),
                      low: Number(d.low),
                      close: Number(d.close),
                      volume: Number(d.volume) || 0,
                    }))}
                    height={280}
                  />
                )}
                
                {advancedPanelTab === 'order' && rawHistory && (
                  <OrderFlow 
                    candles={rawHistory.map(d => ({
                      time: d.date,
                      open: Number(d.open),
                      high: Number(d.high),
                      low: Number(d.low),
                      close: Number(d.close),
                      volume: Number(d.volume) || 0,
                    }))}
                  />
                )}
                
                {advancedPanelTab === 'patterns' && rawHistory && (
                  <AIPatternRecognition 
                    candles={rawHistory.map(d => ({
                      time: d.date,
                      open: Number(d.open),
                      high: Number(d.high),
                      low: Number(d.low),
                      close: Number(d.close),
                    }))}
                    symbol={selectedSymbol}
                  />
                )}
                
                {advancedPanelTab === 'mtf' && rawHistory && (
                  <MultiTimeframeCorrelation 
                    candles={rawHistory.map(d => ({
                      time: d.date,
                      open: Number(d.open),
                      high: Number(d.high),
                      low: Number(d.low),
                      close: Number(d.close),
                    }))}
                    symbol={selectedSymbol}
                  />
                )}
                
                {advancedPanelTab === 'draw' && (
                  <DrawingTools 
                    chartRef={chartRef}
                    symbol={selectedSymbol}
                    interval={interval}
                  />
                )}

                {advancedPanelTab === 'backtest' && (
                  <BacktestOverlayPanel
                    symbol={selectedSymbol}
                    showBacktest={showBacktest}
                    setShowBacktest={setShowBacktest}
                    backtestData={backtestData}
                    backtestLoading={backtestLoading}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chart 2 Container (Shown only when Split View is Active) */}
        {isSplitView && (
          <div style={{
            background:'rgba(255,255,255,0.015)',
            border:'1px solid rgba(59,130,246,0.2)',
            borderRadius:18, overflow:'hidden',
            position:'relative',
          }}>
            <div style={{ display:'flex', gap:8, padding:'10px 16px', fontSize:'0.75rem', color:'#60A5FA', fontWeight:700, alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
              <span>COMPARISON CHART:</span>
              <select
                value={compareSymbol}
                onChange={e => setCompareSymbol(e.target.value)}
                style={{ background:'#090C18', color:'#60A5FA', border:'1px solid rgba(59,130,246,0.3)', borderRadius:6, padding:'2px 8px', fontSize:'0.75rem', outline:'none', fontWeight:700 }}
              >
                {POPULAR_STOCKS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div ref={containerRef2} style={{ width:'100%', height:520 }} />
          </div>
        )}
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

      {/* ── Enhanced Stats Bar with Volatility & Momentum (Daily Only) ── */}
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
            // New: Volatility & Momentum Indicators
            { label:'VOLATILITY',      value: rawHistory && rawHistory.length > 14 ? (() => { const closes = rawHistory.slice(-15).map(d => Number(d.close)); const changes = closes.map((c,i) => i>0 ? Math.abs(c-closes[i-1])/closes[i-1] : 0); const avgVol = changes.reduce((a,b)=>a+b,0)/changes.length*100; return avgVol.toFixed(2)+'%'; })() : predLoading?'Loading…':'—', color:'#F59E0B', delay:'240ms' },
            { label:'MOMENTUM',        value: rawHistory && rawHistory.length > 5 ? (() => { const curr = Number(rawHistory[rawHistory.length-1]?.close); const prev = Number(rawHistory[rawHistory.length-6]?.close); const mom = ((curr-prev)/prev)*100; return (mom>=0?'+':'')+mom.toFixed(2)+'%'; })() : predLoading?'Loading…':'—', color: rawHistory && rawHistory.length > 5 ? (Number(rawHistory[rawHistory.length-1]?.close) >= Number(rawHistory[rawHistory.length-6]?.close) ? '#26A69A' : '#EF5350') : '#6B7280', delay:'280ms' },
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

      {/* ── Enhanced Confidence Score Bar with Quick Insights (Daily Only) ── */}
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
          {/* Quick AI Insight */}
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6, padding:'8px 10px', background:'rgba(168,85,247,0.06)', borderRadius:8, border:'1px solid rgba(168,85,247,0.12)' }}>
            <Zap size={14} color="#A855F7" />
            <span style={{ fontSize:'0.72rem', color:'#C084FC', fontWeight:600 }}>
              {score >= 75 ? '🔥 HIGH CONFIDENCE TRADE SETUP' : score >= 50 ? '⚡ MODERATE OPPORTUNITY' : '⚠️ LOW CONFIDENCE - WAIT FOR SIGNAL'}
            </span>
          </div>
        </div>
      )}

      {/* ── Keyboard Shortcuts Hint ── */}
      <div style={{ 
        display:'flex', justifyContent:'center', gap:12, 
        padding:'10px 16px', 
        background:'rgba(255,255,255,0.01)', 
        borderRadius:10, 
        border:'1px solid rgba(75,85,99,0.15)',
        fontSize:'0.68rem',
        color:'#4B5563'
      }}>
        <span><kbd style={{padding:'2px 6px',background:'rgba(255,255,255,0.05)',borderRadius:4,border:'1px solid rgba(75,85,99,0.3)'}}>Scroll</kbd> Zoom</span>
        <span><kbd style={{padding:'2px 6px',background:'rgba(255,255,255,0.05)',borderRadius:4,border:'1px solid rgba(75,85,99,0.3)'}}>Drag</kbd> Pan</span>
        <span><kbd style={{padding:'2px 6px',background:'rgba(255,255,255,0.05)',borderRadius:4,border:'1px solid rgba(75,85,99,0.3)'}}>Hover</kbd> Crosshair</span>
      </div>

    </div>
  );
}
