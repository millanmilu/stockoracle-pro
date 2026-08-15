import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Maximize2, Minimize2, Camera, Bell, Search, 
  Columns, Rows, Grid2X2, Square, Eye, EyeOff, Sparkles, TrendingUp,
  ZoomIn, ZoomOut, Move, RotateCcw, Zap, Activity, Check,
  BarChart3, Layers, Target, ChevronRight, ChevronLeft, X, FlaskConical
} from 'lucide-react';
import toast from 'react-hot-toast';
import MultiChartGrid from './MultiChartGrid';
import DrawingTools from './chart-tools/DrawingTools';
import IndicatorsModal from './IndicatorsModal';
import ChartSettingsModal from './ChartSettingsModal';
import VolumeProfile from './chart-tools/VolumeProfile';
import OrderFlow from './chart-tools/OrderFlow';
import AIPatternRecognition from './chart-tools/AIPatternRecognition';
import MultiTimeframeCorrelation from './chart-tools/MultiTimeframeCorrelation';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.hostname.includes('amplifyapp.com')) {
      return 'wss://stockoracle.duckdns.org/ws/prices';
    }
    return `${protocol}//${window.location.host}/ws/prices`;
  }
  return 'ws://localhost:8000/ws/prices';
};

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

/** MACD (12, 26, 9) */
function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
  if (!data || data.length <= slow + signal) return { macd: [], signal: [], hist: [] };
  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);
  
  const fastMap = new Map(emaFast.map(d => [d.time, d.value]));
  const macdLine = [];
  for (const s of emaSlow) {
    const fVal = fastMap.get(s.time);
    if (fVal != null) {
      macdLine.push({ time: s.time, value: fVal - s.value });
    }
  }

  const k = 2 / (signal + 1);
  let sig = macdLine[0]?.value || 0;
  const signalLine = [];
  const hist = [];

  for (let i = 0; i < macdLine.length; i++) {
    const mVal = macdLine[i].value;
    sig = i === 0 ? mVal : mVal * k + sig * (1 - k);
    if (i >= signal - 1) {
      signalLine.push({ time: macdLine[i].time, value: sig });
      hist.push({
        time: macdLine[i].time,
        value: mVal - sig,
        color: mVal - sig >= 0 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 83, 80, 0.65)'
      });
    }
  }

  return { macd: macdLine, signal: signalLine, hist };
}

/** Arnaud Legoux Moving Average (ALMA 9) */
function calculateALMA(data, period = 9, offset = 0.85, sigma = 6) {
  if (!data || data.length < period) return [];
  const m = Math.floor(offset * (period - 1));
  const s = period / sigma;
  const weights = [];
  let sumW = 0;
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(w);
    sumW += w;
  }
  for (let i = 0; i < period; i++) weights[i] /= sumW;

  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    let val = 0;
    for (let j = 0; j < period; j++) {
      val += data[i - period + 1 + j].close * weights[j];
    }
    result.push({ time: data[i].time, value: val });
  }
  return result;
}

/** Auto Support & Resistance Key Levels */
function calculateKeyLevels(data) {
  if (!data || data.length < 25) return [];
  const levels = [];
  const lookback = 8;
  for (let i = lookback; i < data.length - lookback; i += 4) {
    const c = data[i];
    const isHigh = data.slice(i - lookback, i + lookback).every(x => x.high <= c.high);
    const isLow = data.slice(i - lookback, i + lookback).every(x => x.low >= c.low);
    if (isHigh) levels.push({ price: c.high, title: `Resist ₹${c.high.toFixed(0)}`, color: 'rgba(239, 83, 80, 0.65)' });
    if (isLow) levels.push({ price: c.low, title: `Support ₹${c.low.toFixed(0)}`, color: 'rgba(16, 185, 129, 0.65)' });
  }
  const deduped = [];
  for (const lvl of levels.reverse()) {
    if (!deduped.some(d => Math.abs(d.price - lvl.price) / lvl.price < 0.006)) {
      deduped.push(lvl);
    }
    if (deduped.length >= 4) break;
  }
  return deduped;
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
  const { fetchHistory, fetchPredict, searchStock, searchStocks, fetchBacktest } = useStock();

  const [interval,    setInterval]    = useState('1d');
  const [timeframe,   setTimeframe]   = useState('5Y');
  const [rawHistory,  setRawHistory]  = useState(null);
  const [prediction,  setPrediction]  = useState(null);
  const [livePrice,   setLivePrice]   = useState(null);
  const [liveChange,  setLiveChange]  = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [predLoading, setPredLoading] = useState(true);

  // TradingView Multi-Chart Grid Layout State ('1x1' | '1x2' | '2x1' | '2x2')
  const [chartLayout, setChartLayout] = useState('1x1');
  const [showSymbolModal, setShowSymbolModal] = useState(false);
  const [symbolModalFilter, setSymbolModalFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Split View & Comparison State
  const [isSplitView, setIsSplitView] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState('NIFTY50');
  const [rawHistoryCompare, setRawHistoryCompare] = useState(null);

  // Indicator Toggles & TradingView Modals
  const [showIndicatorsModal, setShowIndicatorsModal] = useState(false);
  const [showChartSettingsModal, setShowChartSettingsModal] = useState(false);
  const [showBottomStats, setShowBottomStats] = useState(false); // Collapsed by default to maximize chart height
  const [showIndicatorDropdown, setShowIndicatorDropdown] = useState(false);
  const [showVolume,    setShowVolume]    = useState(false);
  const [showSMA,       setShowSMA]       = useState(false);
  const [showEMA,       setShowEMA]       = useState(false);
  const [showBB,        setShowBB]        = useState(false);
  const [showRSI,       setShowRSI]       = useState(false);
  const [showMACD,      setShowMACD]      = useState(false);
  const [showALMA,      setShowALMA]      = useState(false);
  const [showKeyLevels, setShowKeyLevels] = useState(false);
  const [showPatterns,  setShowPatterns]  = useState(false);
  const [showAICone,    setShowAICone]    = useState(true);
  
  // Real-time indicator readout values for on-chart TradingView legend
  const [indicatorValues, setIndicatorValues] = useState({
    sma: null,
    ema: null,
    bb: null,
    rsi: null,
    macd: null,
    alma: null,
    volume: null,
  });

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

  // Indicators Map & Toggle Handler
  const activeIndicatorsMap = useMemo(() => ({
    vol_24h: showVolume,
    sma_20: showSMA,
    ema_20: showEMA,
    boll: showBB,
    rsi_14: showRSI,
    macd: showMACD,
    alma: showALMA,
    auto_key_levels: showKeyLevels,
    ai_patterns: showPatterns || (showAdvancedPanel && advancedPanelTab === 'patterns'),
    vpvr: showAdvancedPanel && advancedPanelTab === 'volume',
    orderflow: showAdvancedPanel && advancedPanelTab === 'order',
    mtf_matrix: showAdvancedPanel && advancedPanelTab === 'mtf',
    backtester: showAdvancedPanel && advancedPanelTab === 'backtest',
  }), [showVolume, showSMA, showEMA, showBB, showRSI, showMACD, showALMA, showKeyLevels, showPatterns, showAdvancedPanel, advancedPanelTab]);

  const handleToggleIndicator = useCallback((id) => {
    switch (id) {
      case 'vol_24h':
      case 'volume':
        setShowVolume(prev => !prev);
        break;
      case 'sma_20':
        setShowSMA(prev => !prev);
        break;
      case 'ema_20':
        setShowEMA(prev => !prev);
        break;
      case 'boll':
        setShowBB(prev => !prev);
        break;
      case 'rsi_14':
        setShowRSI(prev => !prev);
        break;
      case 'macd':
        setShowMACD(prev => !prev);
        break;
      case 'alma':
        setShowALMA(prev => !prev);
        break;
      case 'auto_key_levels':
        setShowKeyLevels(prev => !prev);
        break;
      case 'ai_patterns':
        setShowPatterns(prev => !prev);
        setShowAdvancedPanel(true);
        setAdvancedPanelTab('patterns');
        break;
      case 'vpvr':
        setShowAdvancedPanel(prev => !prev || advancedPanelTab !== 'volume');
        setAdvancedPanelTab('volume');
        break;
      case 'orderflow':
        setShowAdvancedPanel(prev => !prev || advancedPanelTab !== 'order');
        setAdvancedPanelTab('order');
        break;
      case 'mtf_matrix':
        setShowAdvancedPanel(prev => !prev || advancedPanelTab !== 'mtf');
        setAdvancedPanelTab('mtf');
        break;
      case 'backtester':
        setShowAdvancedPanel(prev => !prev || advancedPanelTab !== 'backtest');
        setAdvancedPanelTab('backtest');
        break;
      default:
        toast.success(`Toggled ${id}`);
    }
  }, [advancedPanelTab]);

  // Search & Alert State
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [targetAlertPrice, setTargetAlertPrice] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Real-time Autocomplete Ticker Suggestions
  useEffect(() => {
    if (!symbolModalFilter.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchStocks(symbolModalFilter.trim());
        setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [symbolModalFilter, searchStocks]);

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
  const macdRef        = useRef(null);
  const macdSignalRef  = useRef(null);
  const macdHistRef    = useRef(null);
  const almaRef        = useRef(null);
  const keyLevelLinesRef = useRef([]);

  const predLineRef    = useRef(null);
  const upperLineRef   = useRef(null);
  const lowerLineRef   = useRef(null);
  const livePriceLineRef = useRef(null);
  const activeCandleRef  = useRef(null);

  // Chart 2 (Comparison) Refs
  const containerRef2  = useRef(null);
  const chartRef2      = useRef(null);
  const candleRef2     = useRef(null);

  const wsRef          = useRef(null);
  const isDaily = interval === '1d';

  /* ── Interval Handler ─────────────────────────────────────── */

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
    activeCandleRef.current = null;
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

    const initialWidth = containerRef.current.clientWidth || 800;
    const initialHeight = containerRef.current.clientHeight || 600;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width : initialWidth,
      height: initialHeight,
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

    // SMA, EMA, BB, ALMA
    const sma = chart.addLineSeries({ color: '#00E5FF', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    smaRef.current = sma;

    const ema = chart.addLineSeries({ color: '#FF9100', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    emaRef.current = ema;

    const alma = chart.addLineSeries({ color: '#FACC15', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    almaRef.current = alma;

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

    // MACD Sub-chart (overlay scale with scaleMargins)
    const macd = chart.addLineSeries({
      color: '#38BDF8', lineWidth: 1.5,
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
      priceLineVisible: false, lastValueVisible: false,
    });
    macdRef.current = macd;

    const macdSignal = chart.addLineSeries({
      color: '#F97316', lineWidth: 1.5,
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
      priceLineVisible: false, lastValueVisible: false,
    });
    macdSignalRef.current = macdSignal;

    const macdHist = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
      priceLineVisible: false, lastValueVisible: false,
    });
    macdHistRef.current = macdHist;

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
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
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
      almaRef.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
      rsiRef.current = null;
      rsiLine70Ref.current = null;
      rsiLine30Ref.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      keyLevelLinesRef.current = [];
      predLineRef.current = null;
      upperLineRef.current = null;
      lowerLineRef.current = null;
      livePriceLineRef.current = null;
      activeCandleRef.current = null;
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
    activeCandleRef.current = null;

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

    const ws = new WebSocket(getWsUrl());
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
    activeCandleRef.current = null;

    // 1. Build Candles with IQR Outlier Filtering & High/Low validity safety
    const validRaw = rawHistory.filter(d => d && d.date && !isNaN(parseNum(d.close)) && parseNum(d.close) > 0);
    if (!validRaw.length) return;

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
      .filter(d => d.time != null && d.time !== '' && !isNaN(d.open) && !isNaN(d.close) && d.open > 0 && d.close > 0);

    candles.sort((a, b) => (typeof a.time === 'number' ? a.time - b.time : String(a.time).localeCompare(String(b.time))));

    const seen = new Map();
    candles.forEach(c => seen.set(c.time, c));
    const dedupedCandles = Array.from(seen.values());

    try { 
      candleRef.current.setData(dedupedCandles); 
      chartRef.current?.timeScale().fitContent();
    } catch (e) {}

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
    let currentRSI = null;
    if (showRSI && rsiRef.current && dedupedCandles.length > 14) {
      const rsiVals = calculateRSI(dedupedCandles, 14);
      try {
        rsiRef.current.setData(rsiVals);
        if (rsiVals.length > 0) {
          currentRSI = rsiVals[rsiVals.length - 1].value;
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

    // 5. MACD Sub-chart
    let currentMACD = null;
    if (showMACD && macdRef.current && macdSignalRef.current && macdHistRef.current && dedupedCandles.length > 35) {
      const macdData = calculateMACD(dedupedCandles, 12, 26, 9);
      try {
        macdRef.current.setData(macdData.macd);
        macdSignalRef.current.setData(macdData.signal);
        macdHistRef.current.setData(macdData.hist);
        if (macdData.hist.length > 0) {
          const lastHist = macdData.hist[macdData.hist.length - 1];
          const lastMacd = macdData.macd[macdData.macd.length - 1];
          const lastSig  = macdData.signal[macdData.signal.length - 1];
          currentMACD = { hist: lastHist?.value || 0, macd: lastMacd?.value || 0, signal: lastSig?.value || 0 };
        }
      } catch {}
    } else {
      try {
        macdRef.current?.setData([]);
        macdSignalRef.current?.setData([]);
        macdHistRef.current?.setData([]);
      } catch {}
    }

    // 6. ALMA Overlay
    let currentALMA = null;
    if (showALMA && almaRef.current && dedupedCandles.length > 10) {
      const almaVals = calculateALMA(dedupedCandles, 9, 0.85, 6);
      try {
        almaRef.current.setData(almaVals);
        if (almaVals.length > 0) currentALMA = almaVals[almaVals.length - 1].value;
      } catch {}
    } else {
      try { almaRef.current?.setData([]); } catch {}
    }

    // 7. Auto Support & Resistance Key Levels
    if (showKeyLevels && candleRef.current && dedupedCandles.length > 25) {
      if (keyLevelLinesRef.current && keyLevelLinesRef.current.length > 0) {
        keyLevelLinesRef.current.forEach(line => {
          try { candleRef.current?.removePriceLine(line); } catch {}
        });
        keyLevelLinesRef.current = [];
      }
      const keyLevels = calculateKeyLevels(dedupedCandles);
      keyLevels.forEach(lvl => {
        try {
          const pLine = candleRef.current.createPriceLine({
            price: lvl.price,
            color: lvl.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: lvl.title,
          });
          keyLevelLinesRef.current.push(pLine);
        } catch {}
      });
    } else if (!showKeyLevels && candleRef.current && keyLevelLinesRef.current.length > 0) {
      keyLevelLinesRef.current.forEach(line => {
        try { candleRef.current?.removePriceLine(line); } catch {}
      });
      keyLevelLinesRef.current = [];
    }

    // Update real-time indicator legend values
    const lastCandle = dedupedCandles[dedupedCandles.length - 1];
    const smaCalculated = showSMA && dedupedCandles.length > 20 ? calculateSMA(dedupedCandles, 20) : [];
    const emaCalculated = showEMA && dedupedCandles.length > 20 ? calculateEMA(dedupedCandles, 20) : [];
    const bbCalculated  = showBB && dedupedCandles.length > 20 ? calculateBollingerBands(dedupedCandles, 20, 2) : null;

    setIndicatorValues({
      sma: smaCalculated.length > 0 ? smaCalculated[smaCalculated.length - 1].value : null,
      ema: emaCalculated.length > 0 ? emaCalculated[emaCalculated.length - 1].value : null,
      bb: bbCalculated && bbCalculated.upper.length > 0 ? {
        upper: bbCalculated.upper[bbCalculated.upper.length - 1].value,
        lower: bbCalculated.lower[bbCalculated.lower.length - 1].value,
      } : null,
      rsi: currentRSI,
      macd: currentMACD,
      alma: currentALMA,
      volume: lastCandle ? Number(rawHistory[rawHistory.length - 1]?.volume || 0) : null,
    });

    // 8. Interactive Multi-Step AI Forecast Prediction Cone (Daily only)
    if (isDaily && prediction?.predicted_price_7d > 0 && rawHistory.length > 0 && Number(rawHistory[rawHistory.length - 1]?.close) > 0) {
      const lastD     = rawHistory[rawHistory.length - 1];
      const lastTime  = toChartTime(lastD.date, false);
      const lastClose = Number(lastD.close);

      const targetPrice = prediction.predicted_price_7d;
      const upperTarget = prediction.predicted_upper_price_7d ?? prediction.high_bound ?? targetPrice * 1.03;
      const lowerTarget = prediction.predicted_lower_price_7d ?? prediction.low_bound  ?? targetPrice * 0.97;

      const predTrajectory  = [{ time: lastTime, value: lastClose }];
      const upperTrajectory = [{ time: lastTime, value: lastClose }];
      const lowerTrajectory = [{ time: lastTime, value: lastClose }];

      const totalDays = 7;
      for (let day = 1; day <= totalDays; day++) {
        const stepTime = addBusinessDays(lastD.date, day);
        const progress = day / totalDays;
        const sqrtProgress = Math.sqrt(progress);

        // Expected mid path
        const stepPred = lastClose + (targetPrice - lastClose) * progress;
        predTrajectory.push({ time: stepTime, value: Number(stepPred.toFixed(2)) });

        // Expanding 95% confidence bounds
        const stepUpper = stepPred + (upperTarget - targetPrice) * sqrtProgress;
        const stepLower = stepPred - (targetPrice - lowerTarget) * sqrtProgress;

        upperTrajectory.push({ time: stepTime, value: Number(stepUpper.toFixed(2)) });
        lowerTrajectory.push({ time: stepTime, value: Number(Math.max(stepLower, 0.1).toFixed(2)) });
      }

      try {
        predLineRef.current?.setData(predTrajectory);
        upperLineRef.current?.setData(upperTrajectory);
        lowerLineRef.current?.setData(lowerTrajectory);
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
  }, [rawHistory, prediction, interval, showVolume, showSMA, showEMA, showBB, showRSI, showMACD, showALMA, showKeyLevels, showPatterns]);

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

    const last = rawHistory[rawHistory.length - 1];
    if (!last || last.close == null) return;
    const lastClose = parseNum(last.close);

    // Sanity check: ignore out-of-range live ticks (> 20% deviation from recent reference)
    const refPrice = activeCandleRef.current?.close || lastClose;
    if (refPrice > 0 && Math.abs(livePrice - refPrice) / refPrice > 0.20) {
      console.warn(`⚠️ [LiveTick] Dropping anomalous live price tick ${livePrice} for ${selectedSymbol} (ref: ${refPrice})`);
      return;
    }

    try {
      if (isDaily) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const lastDateStr = String(last.date).substring(0, 10);

        const targetTime = todayStr >= lastDateStr ? todayStr : lastDateStr;
        const isNewBar = !activeCandleRef.current || activeCandleRef.current.time !== targetTime;

        if (isNewBar) {
          const initialOpen = targetTime === lastDateStr ? Number(last.open) : livePrice;
          const initialHigh = targetTime === lastDateStr ? Math.max(Number(last.high), livePrice) : livePrice;
          const initialLow  = targetTime === lastDateStr ? Math.min(Number(last.low),  livePrice) : livePrice;
          activeCandleRef.current = {
            time  : targetTime,
            open  : initialOpen,
            high  : initialHigh,
            low   : initialLow,
            close : livePrice,
          };
        } else {
          activeCandleRef.current = {
            ...activeCandleRef.current,
            high  : Math.max(activeCandleRef.current.high, livePrice),
            low   : Math.min(activeCandleRef.current.low,  livePrice),
            close : livePrice,
          };
        }
      } else {
        // Intraday bucketing
        const intervalSecondsMap = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
        const bucketSize = intervalSecondsMap[interval] || 300;
        const currentSec = Math.floor(Date.now() / 1000);
        const currentBucket = Math.floor(currentSec / bucketSize) * bucketSize;
        const lastBarSec = toChartTime(last.date, true) || currentBucket;

        const targetSec = currentBucket >= lastBarSec ? currentBucket : lastBarSec;
        const isNewBar = !activeCandleRef.current || activeCandleRef.current.time !== targetSec;

        if (isNewBar) {
          const initialOpen = targetSec === lastBarSec ? Number(last.open) : livePrice;
          const initialHigh = targetSec === lastBarSec ? Math.max(Number(last.high), livePrice) : livePrice;
          const initialLow  = targetSec === lastBarSec ? Math.min(Number(last.low),  livePrice) : livePrice;
          activeCandleRef.current = {
            time  : targetSec,
            open  : initialOpen,
            high  : initialHigh,
            low   : initialLow,
            close : livePrice,
          };
        } else {
          activeCandleRef.current = {
            ...activeCandleRef.current,
            high  : Math.max(activeCandleRef.current.high, livePrice),
            low   : Math.min(activeCandleRef.current.low,  livePrice),
            close : livePrice,
          };
        }
      }

      if (activeCandleRef.current) {
        candleRef.current.update(activeCandleRef.current);
      }
    } catch (err) {
      console.error('Error updating live candle:', err);
    }

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
  }, [livePrice, interval, isDaily, selectedSymbol]);

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

      {/* ── TradingView Style In-Chart Header ── */}
      <div style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        flexWrap:'wrap',
        gap:12,
        background:'#0F1424',
        border:'1px solid #1E2538',
        borderRadius:10,
        padding:'8px 14px',
        position: 'relative',
        zIndex: 50,
      }}>
        {/* Left: Symbol Selector · Interval · Exchange + Live OHLC Readout */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          {/* Symbol Selector Dropdown (TradingView Style with Realtime Suggestions) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowSymbolModal(!showSymbolModal);
                setShowIndicatorDropdown(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#F0F0FF',
                fontSize: '0.92rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
              }}
            >
              <Search size={13} style={{ color: '#60A5FA' }} />
              {selectedSymbol || 'STOCK'}
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>▾</span>
            </button>

            {/* Quick Symbol & Autocomplete Dropdown */}
            {showSymbolModal && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: 320,
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 10,
                  padding: 10,
                  zIndex: 300,
                  boxShadow: '0 16px 36px rgba(0,0,0,0.85)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: '#64748B' }} />
                  <input
                    type="text"
                    placeholder="Search any NSE stock (e.g. TATA, INFY)..."
                    value={symbolModalFilter}
                    onChange={(e) => setSymbolModalFilter(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 30px',
                      borderRadius: 6,
                      border: '1px solid rgba(99,102,241,0.25)',
                      background: '#090C18',
                      color: '#fff',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (searchResults.length > 0) {
                          setSelectedSymbol(searchResults[0].ticker.toUpperCase());
                          setShowSymbolModal(false);
                          setSymbolModalFilter('');
                        } else if (symbolModalFilter.trim()) {
                          setSelectedSymbol(symbolModalFilter.trim().toUpperCase());
                          setShowSymbolModal(false);
                          setSymbolModalFilter('');
                        }
                      }
                    }}
                  />
                  {symbolModalFilter && (
                    <button
                      onClick={() => setSymbolModalFilter('')}
                      style={{
                        position: 'absolute', right: 8, top: 7,
                        background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer'
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Search Results / Suggestions List */}
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {isSearching && (
                    <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: '#818CF8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="spinner" style={{ width: 12, height: 12 }} /> Searching NSE Universe...
                    </div>
                  )}

                  {/* If user typed a search query, show live server search suggestions */}
                  {symbolModalFilter.trim() && searchResults.length > 0 && (
                    searchResults.map((item) => (
                      <div
                        key={item.ticker}
                        onClick={() => {
                          setSelectedSymbol(item.ticker.toUpperCase());
                          setShowSymbolModal(false);
                          setSymbolModalFilter('');
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          backgroundColor: selectedSymbol === item.ticker ? 'rgba(59,130,246,0.18)' : 'transparent',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.14)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === item.ticker ? 'rgba(59,130,246,0.18)' : 'transparent'}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: '#60A5FA', fontFamily: 'JetBrains Mono, monospace' }}>
                            {item.ticker}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#94A3B8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
                          {item.exchange || 'NSE'}
                        </span>
                      </div>
                    ))
                  )}

                  {/* Fallback to popular stocks list when search query is empty or no server results */}
                  {(!symbolModalFilter.trim() || (searchResults.length === 0 && !isSearching)) && (
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, padding: '4px 8px', letterSpacing: '0.05em' }}>
                        POPULAR NSE TICKERS
                      </div>
                      {POPULAR_STOCKS
                        .filter((s) => !symbolModalFilter || s.toLowerCase().includes(symbolModalFilter.toLowerCase()))
                        .map((sym) => (
                          <div
                            key={sym}
                            onClick={() => {
                              setSelectedSymbol(sym);
                              setShowSymbolModal(false);
                              setSymbolModalFilter('');
                            }}
                            style={{
                              padding: '7px 10px',
                              borderRadius: 4,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: selectedSymbol === sym ? '#60A5FA' : '#E2E8F0',
                              backgroundColor: selectedSymbol === sym ? 'rgba(59,130,246,0.2)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.12)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === sym ? 'rgba(59,130,246,0.2)' : 'transparent'}
                          >
                            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{sym}</span>
                            <span style={{ fontSize: '0.65rem', color: '#64748B' }}>NSE</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#3B82F6' }}>
            · {interval ? interval.toUpperCase() : '1D'} · NSE
          </span>

          {/* OHLC Readout Bar */}
          {curPrice != null && (
            <div style={{
              display:'flex',
              alignItems:'center',
              gap:10,
              fontSize:'0.73rem',
              fontFamily:'JetBrains Mono, monospace',
              color:'#94A3B8',
              borderLeft:'1px solid #1E2538',
              paddingLeft:12,
            }}>
              <span>O <strong style={{ color:'#F0F0FF' }}>{(activeCandleRef.current?.open ?? lastCandleClose ?? curPrice)?.toFixed(2)}</strong></span>
              <span>H <strong style={{ color:'#10B981' }}>{(activeCandleRef.current?.high ?? curPrice)?.toFixed(2)}</strong></span>
              <span>L <strong style={{ color:'#EF5350' }}>{(activeCandleRef.current?.low ?? curPrice)?.toFixed(2)}</strong></span>
              <span>C <strong style={{ color: changeUp ? '#10B981' : '#EF5350' }}>{curPrice?.toFixed(2)}</strong></span>
              <span style={{ color: changeUp ? '#10B981' : '#EF5350', fontWeight:700 }}>
                {changeUp ? '+' : ''}{(liveChange ?? 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Interval Buttons, Indicators Dropdown, TradingView Grid Switcher, Scalper Mode, Fullscreen */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Timeframe Interval Buttons */}
          <div style={{ display:'flex', gap:2, background:'#0A0D1A', padding:'2px', borderRadius:6, border:'1px solid #1E2538' }}>
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => handleIntervalChange(iv.value)}
                style={{
                  padding:'4px 8px',
                  borderRadius:4,
                  border:'none',
                  background: interval === iv.value ? 'rgba(59,130,246,0.25)' : 'transparent',
                  color: interval === iv.value ? '#3B82F6' : '#64748B',
                  fontSize:'0.72rem',
                  fontWeight: interval === iv.value ? 800 : 500,
                  cursor:'pointer',
                }}
              >
                {iv.label}
              </button>
            ))}
          </div>

          {/* ── TradingView Style Indicators Modal Button ── */}
          <button
            onClick={() => setShowIndicatorsModal(true)}
            title="Indicators, metrics, and strategies"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              border: showIndicatorsModal ? '1px solid #2962FF' : '1px solid #1E2538',
              background: showIndicatorsModal ? 'rgba(41,98,255,0.2)' : 'rgba(255,255,255,0.03)',
              color: showIndicatorsModal ? '#60A5FA' : '#E2E8F0',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Activity size={13} style={{ color: '#2962FF' }} />
            <span>Indicators</span>
            {Object.values(activeIndicatorsMap).filter(Boolean).length > 0 && (
              <span style={{ backgroundColor: '#2962FF', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: 10, fontWeight: 800 }}>
                {Object.values(activeIndicatorsMap).filter(Boolean).length}
              </span>
            )}
          </button>

          {/* TradingView Multi-Chart Layout Switcher [ 1x1 | 1x2 | 2x1 | 2x2 ] */}
          <div style={{ display:'flex', alignItems:'center', gap:2, background:'#0A0D1A', padding:'2px', borderRadius:6, border:'1px solid #1E2538' }}>
            <button
              onClick={() => setChartLayout('1x1')}
              title="Single Chart (1x1)"
              style={{
                padding:'4px 7px',
                borderRadius:4,
                border:'none',
                background: chartLayout === '1x1' ? '#2962FF' : 'transparent',
                color: chartLayout === '1x1' ? '#fff' : '#64748B',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
              }}
            >
              <Square size={13} />
            </button>
            <button
              onClick={() => setChartLayout('1x2')}
              title="Side-by-Side (1x2)"
              style={{
                padding:'4px 7px',
                borderRadius:4,
                border:'none',
                background: chartLayout === '1x2' ? '#2962FF' : 'transparent',
                color: chartLayout === '1x2' ? '#fff' : '#64748B',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
              }}
            >
              <Columns size={13} />
            </button>
            <button
              onClick={() => setChartLayout('2x1')}
              title="Stacked (2x1)"
              style={{
                padding:'4px 7px',
                borderRadius:4,
                border:'none',
                background: chartLayout === '2x1' ? '#2962FF' : 'transparent',
                color: chartLayout === '2x1' ? '#fff' : '#64748B',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
              }}
            >
              <Rows size={13} />
            </button>
            <button
              onClick={() => setChartLayout('2x2')}
              title="Quad Grid (2x2)"
              style={{
                padding:'4px 7px',
                borderRadius:4,
                border:'none',
                background: chartLayout === '2x2' ? '#2962FF' : 'transparent',
                color: chartLayout === '2x2' ? '#fff' : '#64748B',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
              }}
            >
              <Grid2X2 size={13} />
            </button>
          </div>

          {/* Snapshot Camera */}
          <button
            onClick={handleSnapshot}
            title="Download Snapshot"
            style={{ padding:'5px', borderRadius:6, border:'1px solid #1E2538', background:'transparent', color:'#94A3B8', cursor:'pointer' }}
          >
            <Camera size={14} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Fullscreen Chart"
            style={{ padding:'5px', borderRadius:6, border:'1px solid #1E2538', background:'transparent', color:'#94A3B8', cursor:'pointer' }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>


      {/* ── Main Chart Body: Multi-Chart Grid OR Single Chart Workstation ── */}
      {chartLayout !== '1x1' ? (
        <div style={{ flex: 1, minHeight: 650, height: 'calc(100vh - 120px)', width: '100%' }}>
          <MultiChartGrid layout={chartLayout} onLayoutChange={setChartLayout} />
        </div>
      ) : (
      <div style={{ display:'grid', gridTemplateColumns: isSplitView ? '1fr 1fr' : '1fr', gap:16 }}>
        
        {/* Chart 1 Container with TradingView Left Drawing Sidebar */}
        <div style={{
          background:'rgba(255,255,255,0.015)',
          border:'1px solid rgba(168,85,247,0.10)',
          borderRadius:18, overflow:'hidden',
          position:'relative',
          display: 'flex',
          height: 600,
        }}>

          {/* ── TradingView Style Vertical Left Drawing Sidebar ── */}
          <DrawingTools
            chartRef={chartRef}
            candleRef={candleRef}
            symbol={selectedSymbol}
            interval={interval}
            onOpenSettings={() => setShowChartSettingsModal(true)}
          />

          {/* ── Center Chart Canvas ── */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
            {/* ── TradingView Style On-Chart Active Indicators Legend ── */}
            <div style={{
              position: 'absolute',
              top: 10,
              left: 12,
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              pointerEvents: 'auto',
              userSelect: 'none',
            }}>
              {showSMA && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(0, 229, 255, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#00E5FF', fontWeight: 700 }}>SMA 20</span>
                  <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>{indicatorValues.sma ? `₹${indicatorValues.sma.toFixed(2)}` : '—'}</span>
                  <button onClick={() => setShowSMA(false)} title="Remove SMA" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showEMA && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(255, 145, 0, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#FF9100', fontWeight: 700 }}>EMA 20</span>
                  <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>{indicatorValues.ema ? `₹${indicatorValues.ema.toFixed(2)}` : '—'}</span>
                  <button onClick={() => setShowEMA(false)} title="Remove EMA" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showALMA && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(250, 204, 21, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#FACC15', fontWeight: 700 }}>ALMA 9</span>
                  <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>{indicatorValues.alma ? `₹${indicatorValues.alma.toFixed(2)}` : '—'}</span>
                  <button onClick={() => setShowALMA(false)} title="Remove ALMA" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showBB && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(224, 64, 251, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#E040FB', fontWeight: 700 }}>BB (20, 2)</span>
                  <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>
                    {indicatorValues.bb ? `U: ₹${indicatorValues.bb.upper.toFixed(1)} L: ₹${indicatorValues.bb.lower.toFixed(1)}` : '—'}
                  </span>
                  <button onClick={() => setShowBB(false)} title="Remove Bollinger Bands" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showRSI && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(244, 63, 94, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#F43F5E', fontWeight: 700 }}>RSI 14</span>
                  <span style={{ 
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: indicatorValues.rsi > 70 ? '#EF5350' : indicatorValues.rsi < 30 ? '#10B981' : '#E2E8F0' 
                  }}>
                    {indicatorValues.rsi ? indicatorValues.rsi.toFixed(1) : '—'}
                  </span>
                  <button onClick={() => setShowRSI(false)} title="Remove RSI" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showMACD && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#38BDF8', fontWeight: 700 }}>MACD (12, 26, 9)</span>
                  <span style={{ 
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: indicatorValues.macd?.hist >= 0 ? '#10B981' : '#EF5350' 
                  }}>
                    {indicatorValues.macd ? `${indicatorValues.macd.hist >= 0 ? '+' : ''}${indicatorValues.macd.hist.toFixed(2)}` : '—'}
                  </span>
                  <button onClick={() => setShowMACD(false)} title="Remove MACD" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showKeyLevels && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(234, 179, 8, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#EAB308', fontWeight: 700 }}>Auto Key Levels</span>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>S/R Active</span>
                  <button onClick={() => setShowKeyLevels(false)} title="Remove Key Levels" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showVolume && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(38, 166, 154, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#26A69A', fontWeight: 700 }}>Volume</span>
                  <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>
                    {indicatorValues.volume ? Number(indicatorValues.volume).toLocaleString() : '—'}
                  </span>
                  <button onClick={() => setShowVolume(false)} title="Remove Volume" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
              {showPatterns && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(10, 14, 26, 0.85)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)', border: '1px solid rgba(16, 185, 129, 0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                  <span style={{ color: '#10B981', fontWeight: 700 }}>AI Patterns</span>
                  <span style={{ color: '#E2E8F0' }}>Auto Detect</span>
                  <button onClick={() => setShowPatterns(false)} title="Remove AI Patterns" style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 11, display: 'flex', alignItems: 'center' }}>✕</button>
                </div>
              )}
            </div>

            {loading && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(9,12,24,0.75)', zIndex:10 }}>
                <div style={{ width:38, height:38, borderRadius:'50%', border:'3px solid rgba(168,85,247,0.15)', borderTopColor:'#A855F7', animation:'spin 0.75s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
          </div>
          
          {/* ── Right Docked Pro Indicator Panel (Volume Profile, Order Flow, AI Patterns, MTF, Backtest) ── */}
          {showAdvancedPanel && (
            <div style={{
              width: 320,
              height: '100%',
              background: 'rgba(9,12,24,0.98)',
              borderLeft: '1px solid rgba(168,85,247,0.2)',
              zIndex: 35,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
              flexShrink: 0,
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
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A855F7', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={13} />
                  {advancedPanelTab === 'volume' ? 'VOLUME PROFILE (VPVR)' :
                   advancedPanelTab === 'order' ? 'ORDER FLOW DELTA' :
                   advancedPanelTab === 'patterns' ? 'AI PATTERN SCANNER' :
                   advancedPanelTab === 'mtf' ? 'MTF CORRELATION' :
                   advancedPanelTab === 'backtest' ? 'STRATEGY BACKTEST' : 'INDICATOR PANEL'}
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
      )}

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

      {/* ── Compact Space-Saving Bottom Status Bar with Expandable Insights ── */}
      {isDaily && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 14px',
            backgroundColor: '#0F121A',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            fontSize: '0.74rem',
            color: '#94A3B8',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span>LTP: <strong style={{ color: '#FFF' }}>{curPrice ? `₹${curPrice.toFixed(2)}` : '—'}</strong></span>
              <span>7D Target: <strong style={{ color: '#A855F7' }}>{prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toFixed(2)}` : '—'}</strong></span>
              <span>Return: <strong style={{ color: (prediction?.predicted_return_7d || 0) >= 0 ? '#26A69A' : '#EF5350' }}>{prediction?.predicted_return_7d != null ? `${prediction.predicted_return_7d >= 0 ? '+' : ''}${(prediction.predicted_return_7d * 100).toFixed(2)}%` : '—'}</strong></span>
              <span>Signal: <strong style={{ color: sigMeta.color }}>{predLoading ? 'Loading…' : sigMeta.label}</strong></span>
              <span>Confidence: <strong style={{ color: scoreColor }}>{score}/100</strong></span>
            </div>

            <button
              onClick={() => setShowBottomStats(!showBottomStats)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                padding: '3px 8px',
                color: '#60A5FA',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {showBottomStats ? '▴ Collapse Panel' : '▾ Expand Stats'}
            </button>
          </div>

          {/* Expanded Cards (Shown only on demand) */}
          {showBottomStats && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(138px, 1fr))', gap:8 }}>
              {[
                { label:'CURRENT PRICE',   value: curPrice ? `₹${curPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—', color:'#F0F0FF' },
                { label:'AI TARGET (7D)',  value: prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : predLoading ? 'Loading…' : '—', color:'#A855F7' },
                { label:'EXPECTED RETURN', value: prediction?.predicted_return_7d != null ? `${prediction.predicted_return_7d>=0?'+':''}${(prediction.predicted_return_7d*100).toFixed(2)}%` : predLoading ? 'Loading…' : '—',
                  color: prediction?.predicted_return_7d >= 0 ? '#26A69A' : '#EF5350' },
                { label:'AI CONFIDENCE',   value: prediction?.ai_confidence_score != null ? `${prediction.ai_confidence_score}/100` : predLoading ? 'Loading…' : '—', color:scoreColor },
                { label:'95% UPPER',       value:(prediction?.predicted_upper_price_7d??prediction?.high_bound) ? `₹${(prediction.predicted_upper_price_7d??prediction.high_bound).toFixed(2)}` : predLoading?'Loading…':'—', color:'#26A69A' },
                { label:'95% LOWER',       value:(prediction?.predicted_lower_price_7d??prediction?.low_bound)  ? `₹${(prediction.predicted_lower_price_7d??prediction.low_bound).toFixed(2)}`  : predLoading?'Loading…':'—', color:'#EF5350' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background:'rgba(255,255,255,0.02)', border:'1px solid rgba(168,85,247,0.09)',
                  borderRadius:8, padding:'8px 12px',
                }}>
                  <div style={{ fontSize:'0.62rem', color:'#64748B', letterSpacing:'0.06em', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color, fontFamily:'JetBrains Mono, monospace' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TradingView Indicators, Metrics, and Strategies Modal ── */}
      <IndicatorsModal
        isOpen={showIndicatorsModal}
        onClose={() => setShowIndicatorsModal(false)}
        activeIndicators={activeIndicatorsMap}
        onToggleIndicator={handleToggleIndicator}
      />

      {/* ── TradingView Chart Settings Modal ── */}
      <ChartSettingsModal
        isOpen={showChartSettingsModal}
        onClose={() => setShowChartSettingsModal(false)}
        chartRef={chartRef}
        candleSeriesRef={candleRef}
      />

    </div>
  );
}
