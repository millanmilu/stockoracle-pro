import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { 
  Maximize2, Minimize2, Camera, Bell, Search, 
  Columns, Rows, Grid2X2, Square, Eye, EyeOff, Sparkles, TrendingUp,
  ZoomIn, ZoomOut, Move, RotateCcw, Zap, Activity, Check,
  BarChart3, Layers, Target, ChevronRight, ChevronLeft, X, FlaskConical,
  Play, Pause, SkipForward, FastForward, ShieldAlert, Sliders
} from 'lucide-react';
import toast from 'react-hot-toast';
import MultiChartGrid from './MultiChartGrid';
import DrawingTools from './chart-tools/DrawingTools';
import TradingViewAdvancedChart from './chart-tools/TradingViewAdvancedChart';
import IndicatorsModal from './IndicatorsModal';
import ChartSettingsModal from './ChartSettingsModal';
import AIPatternRecognition from './chart-tools/AIPatternRecognition';
import TrustBadge from './TrustBadge';
import { parseNum, toChartTime, addBusinessDays, POPULAR_STOCKS, INTERVALS, SIG, CHART_OPTIONS, CANDLE_STYLE } from '../utils/chartHelpers';
import { calculateSMA, calculateEMA, calculateBollingerBands, calculateRSI, calculateMACD, calculateALMA, calculateKeyLevels, detectPatterns } from '../utils/chartIndicators';
import SymbolSearchModal from './chart-tools/SymbolSearchModal';
import { playAlertChime } from '../utils/soundChime';

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
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
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
  const [dataSource,  setDataSource]  = useState('unknown');

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
  
  // Historical Bar Replay Simulator (Practice Mode)
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1); // 1x, 2x, 5x

  // 5. Interactive Canvas Price Alerts & Audio Chime
  const [priceAlerts, setPriceAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('stockoracle_price_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('stockoracle_price_alerts', JSON.stringify(priceAlerts));
    } catch {}
  }, [priceAlerts]);
  
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

  // Chart Scale & Navigation
  const [isLogScale, setIsLogScale] = useState(false);

  // Chart Navigation State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);

  // Advanced Features State
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [advancedPanelTab, setAdvancedPanelTab] = useState('patterns');

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
  const [chartEngine, setChartEngine] = useState(() => localStorage.getItem('stockoracle_chart_engine') || 'tradingview');

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
  const [chartReady, setChartReady] = useState(0);
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
  const alertLinesRef  = useRef([]);
  const lastTriggeredMap = useRef(new Set());

  const predLineRef    = useRef(null);
  const upperLineRef   = useRef(null);
  const lowerLineRef   = useRef(null);
  const livePriceLineRef = useRef(null);
  const activeCandleRef  = useRef(null);
  const hudRef           = useRef(null);

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

  /* ── Interactive Keymap & Hotkeys Listener ──────────────────── */
  useEffect(() => {
    const handleChartKeys = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (isInput) return;

      // Timeframe Hotkeys: 1 (1m), 2 (5m), 3 (15m), 4 (1H), D (1D)
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === '1') { handleIntervalChange('1m'); toast('1m Interval', { icon: '⏱️' }); }
        else if (e.key === '2') { handleIntervalChange('5m'); toast('5m Interval', { icon: '⏱️' }); }
        else if (e.key === '3') { handleIntervalChange('15m'); toast('15m Interval', { icon: '⏱️' }); }
        else if (e.key === '4') { handleIntervalChange('1h'); toast('1H Interval', { icon: '⏱️' }); }
        else if (e.key.toLowerCase() === 'd') { handleIntervalChange('1d'); toast('1D Daily Candles', { icon: '📅' }); }
        else if (e.key.toLowerCase() === 'f') { toggleFullscreen(); }
      }

      // Pro Feature Alt Hotkeys
      if (e.altKey) {
        if (e.key.toLowerCase() === 'r') { e.preventDefault(); setIsReplayMode(p => !p); setIsReplayPlaying(false); }
        else if (e.key.toLowerCase() === 'a') { e.preventDefault(); setShowAlertModal(true); }
        else if (e.key.toLowerCase() === 'l') { e.preventDefault(); toggleLogScale(); }
      }
    };
    window.addEventListener('keydown', handleChartKeys);
    return () => window.removeEventListener('keydown', handleChartKeys);
  }, [handleIntervalChange, isLogScale]);

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

    // Crosshair HUD subscription (direct 0ms DOM update, no React re-render lag)
    chart.subscribeCrosshairMove((param) => {
      if (!hudRef.current) return;
      if (!param || !param.time || !param.point) {
        hudRef.current.style.display = 'none';
        return;
      }
      const candleData = param.seriesData.get(candle);
      if (candleData && typeof candleData.open === 'number') {
        hudRef.current.style.display = 'flex';
        const chg = candleData.open ? ((candleData.close - candleData.open) / candleData.open) * 100 : 0;
        const isUp = chg >= 0;
        const upCol = '#10B981';
        const dnCol = '#EF5350';
        hudRef.current.innerHTML = `
          <span style="color:#94A3B8">O: <strong style="color:#F1F5F9">₹${candleData.open.toFixed(2)}</strong></span>
          <span style="color:#94A3B8">H: <strong style="color:${upCol}">₹${candleData.high.toFixed(2)}</strong></span>
          <span style="color:#94A3B8">L: <strong style="color:${dnCol}">₹${candleData.low.toFixed(2)}</strong></span>
          <span style="color:#94A3B8">C: <strong style="color:${isUp ? upCol : dnCol}">₹${candleData.close.toFixed(2)}</strong></span>
          <span style="color:${isUp ? upCol : dnCol};font-weight:700">${isUp ? '+' : ''}${chg.toFixed(2)}%</span>
        `;
      } else {
        hudRef.current.style.display = 'none';
      }
    });

    let roAnimFrame = null;
    const ro = new ResizeObserver(entries => {
      if (entries[0] && chartRef.current) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          if (roAnimFrame) cancelAnimationFrame(roAnimFrame);
          roAnimFrame = requestAnimationFrame(() => {
            if (chartRef.current) {
              chartRef.current.applyOptions({ width, height });
            }
          });
        }
      }
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    setChartReady((c) => c + 1);

    return () => {
      if (roAnimFrame) cancelAnimationFrame(roAnimFrame);
      setChartReady(0);
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
      smcLinesRef.current = [];
      optionsLinesRef.current = [];
      vpvrLinesRef.current = [];
      alertLinesRef.current = [];
      predLineRef.current = null;
      upperLineRef.current = null;
      lowerLineRef.current = null;
      livePriceLineRef.current = null;
      activeCandleRef.current = null;
      backtestEquityRef.current = null;
    };
  }, []);

  /* ── Auto Resize & Re-fit on Engine Switch ────────────────── */
  useEffect(() => {
    if (chartEngine === 'stockoracle' && chartRef.current && containerRef.current) {
      const timer = setTimeout(() => {
        try {
          const w = containerRef.current.clientWidth || 800;
          const h = containerRef.current.clientHeight || 600;
          chartRef.current.applyOptions({ width: w, height: h });
          chartRef.current.timeScale().fitContent();
        } catch (_) {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [chartEngine]);

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

    let ro2AnimFrame = null;
    const ro2 = new ResizeObserver(entries => {
      if (entries[0] && chartRef2.current) {
        const w = entries[0].contentRect.width;
        if (w > 0) {
          if (ro2AnimFrame) cancelAnimationFrame(ro2AnimFrame);
          ro2AnimFrame = requestAnimationFrame(() => {
            if (chartRef2.current) {
              chartRef2.current.applyOptions({ width: w });
            }
          });
        }
      }
    });
    if (containerRef2.current) {
      ro2.observe(containerRef2.current);
    }

    return () => {
      if (ro2AnimFrame) cancelAnimationFrame(ro2AnimFrame);
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

    fetchHistory(selectedSymbol, interval, timeframe).then(result => {
      setRawHistory(result?.candles ?? []);
      if (result?.dataSource) setDataSource(result.dataSource);
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
    fetchHistory(compareSymbol, interval, timeframe).then(result => {
      setRawHistoryCompare(result?.candles ?? []);
    });
  }, [isSplitView, compareSymbol, interval, timeframe]);

  /* ── WebSocket Feed with Auto-Reconnect & Heartbeat ─────────── */

  useEffect(() => {
    let unmounted = false;
    let reconnectTimeout = null;
    let pingInterval = null;
    let retryDelay = 1000;

    const connectWs = () => {
      if (unmounted) return;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        useStore.getState().setWsConnected?.(true);
        retryDelay = 1000;
        const subs = [selectedSymbol];
        if (isSplitView && compareSymbol) {
          subs.push(compareSymbol);
        }
        try {
          ws.send(JSON.stringify({ subscribe: subs }));
        } catch {}
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        useStore.getState().setWsConnected?.(false);
        reconnectTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 15000);
          connectWs();
        }, retryDelay);
      };

      ws.onerror = () => {
        if (unmounted) return;
        setWsConnected(false);
        useStore.getState().setWsConnected?.(false);
        try { ws.close(); } catch {}
      };

      ws.onmessage = e => {
        try {
          const { ticker, price, change_pct, is_live } = JSON.parse(e.data);
          const isLiveTick = is_live !== false; // treat missing flag as live (legacy compat)
          useStore.getState().setWsLiveData?.(isLiveTick);

          if (ticker === selectedSymbol) {
            // Always update the displayed price number
            setLivePrice(price);
            setLiveChange(change_pct);

            // Block chart candle updates for stale fallback prices —
            // the candle stays at last historical close, which is more accurate
            if (!isLiveTick) {
              console.debug(`[WS] Stale fallback price for ${ticker}: ${price} (is_live=false) — skipping candle update`);
              return;
            }

            // Real-time Canvas Price Alert Trigger & Chime
            setPriceAlerts(prevAlerts => {
              let changed = false;
              const updated = prevAlerts.map(alert => {
                if (alert.ticker === selectedSymbol && !alert.triggered) {
                  const target = Number(alert.price);
                  const isHit = Math.abs(price - target) <= Math.max(0.5, target * 0.002) || 
                                (alert.direction === 'above' && price >= target) ||
                                (alert.direction === 'below' && price <= target);
                  if (isHit && !lastTriggeredMap.current.has(alert.id)) {
                    lastTriggeredMap.current.add(alert.id);
                    changed = true;
                    playAlertChime();
                    toast.success(`🔔 PRICE ALERT TRIGGERED: ${selectedSymbol} reached ₹${price.toFixed(2)} (Target ₹${target})`, {
                      duration: 6000,
                      icon: '🚨',
                    });
                    return { ...alert, triggered: true, triggeredAt: new Date().toISOString() };
                  }
                }
                return alert;
              });
              return changed ? updated : prevAlerts;
            });
          }
        } catch {}
      };
    };

    connectWs();

    pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try { wsRef.current.send('ping'); } catch {}
      }
    }, 20_000);

    return () => {
      unmounted = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      setWsConnected(false);
      useStore.getState().setWsConnected?.(false);
    };
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
    
    // Bar Replay Active Candle Slicing
    const activeCandles = isReplayMode
      ? dedupedCandles.slice(0, Math.min(Math.max(5, replayIndex || dedupedCandles.length - 30), dedupedCandles.length))
      : dedupedCandles;

    try { 
      candleRef.current.setData(activeCandles); 
      if (!isReplayMode) {
        chartRef.current?.timeScale().fitContent();
      }
    } catch (e) {}

    // Pattern Badges Overlay
    if (showPatterns) {
      try {
        const patternMarkers = detectPatterns(activeCandles);
        candleRef.current.setMarkers(patternMarkers);
      } catch {}
    } else {
      try { candleRef.current.setMarkers([]); } catch {}
    }

    // 2. Volume Bars
    if (showVolume && volumeRef.current) {
      const volumeData = (isReplayMode ? rawHistory.slice(0, activeCandles.length) : rawHistory)
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
    if (showSMA && smaRef.current && activeCandles.length > 20) {
      try { smaRef.current.setData(calculateSMA(activeCandles, 20)); } catch {}
    } else { try { smaRef.current?.setData([]); } catch {} }

    if (showEMA && emaRef.current && activeCandles.length > 20) {
      try { emaRef.current.setData(calculateEMA(activeCandles, 20)); } catch {}
    } else { try { emaRef.current?.setData([]); } catch {} }

    if (showBB && bbUpperRef.current && bbLowerRef.current && activeCandles.length > 20) {
      const { upper, lower } = calculateBollingerBands(activeCandles, 20, 2);
      try {
        bbUpperRef.current.setData(upper);
        bbLowerRef.current.setData(lower);
      } catch {}
    } else {
      try { bbUpperRef.current?.setData([]); bbLowerRef.current?.setData([]); } catch {}
    }

    // RSI Sub-chart
    let currentRSI = null;
    if (showRSI && rsiRef.current && activeCandles.length > 14) {
      const rsiVals = calculateRSI(activeCandles, 14);
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

    // 9. MACD Sub-chart
    let currentMACD = null;
    if (showMACD && macdRef.current && macdSignalRef.current && macdHistRef.current && activeCandles.length > 35) {
      const macdData = calculateMACD(activeCandles, 12, 26, 9);
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

    // 10. ALMA Overlay
    let currentALMA = null;
    if (showALMA && almaRef.current && activeCandles.length > 10) {
      const almaVals = calculateALMA(activeCandles, 9, 0.85, 6);
      try {
        almaRef.current.setData(almaVals);
        if (almaVals.length > 0) currentALMA = almaVals[almaVals.length - 1].value;
      } catch {}
    } else {
      try { almaRef.current?.setData([]); } catch {}
    }

    // 11. Auto Support & Resistance Key Levels
    if (showKeyLevels && candleRef.current && activeCandles.length > 25) {
      if (keyLevelLinesRef.current && keyLevelLinesRef.current.length > 0) {
        keyLevelLinesRef.current.forEach(line => {
          try { candleRef.current?.removePriceLine(line); } catch {}
        });
        keyLevelLinesRef.current = [];
      }
      const keyLevels = calculateKeyLevels(activeCandles);
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
    const lastCandle = activeCandles[activeCandles.length - 1];
    const smaCalculated = showSMA && activeCandles.length > 20 ? calculateSMA(activeCandles, 20) : [];
    const emaCalculated = showEMA && activeCandles.length > 20 ? calculateEMA(activeCandles, 20) : [];
    const bbCalculated  = showBB && activeCandles.length > 20 ? calculateBollingerBands(activeCandles, 20, 2) : null;

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
        if (chartRef.current && activeCandles.length > 0) {
          const total = activeCandles.length;
          const visibleCount = Math.min(total, 120);
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: total - visibleCount,
            to: total + 3,
          });
        }
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [rawHistory, prediction, interval, showVolume, showSMA, showEMA, showBB, showRSI, showMACD, showALMA, showKeyLevels, showPatterns, isReplayMode, replayIndex]);

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

  /* ── 4. Bar Replay Auto-Play Loop ────────────────────────── */
  useEffect(() => {
    if (!isReplayMode || !isReplayPlaying || !rawHistory?.length) return;
    const baseDelay = 700; // 700ms at 1x
    const delay = Math.max(70, Math.round(baseDelay / replaySpeed));
    const intervalId = setInterval(() => {
      setReplayIndex(prev => {
        const next = (prev || 10) + 1;
        if (next >= rawHistory.length) {
          setIsReplayPlaying(false);
          toast.success('🎉 Replay completed to the latest candle!');
          return rawHistory.length;
        }
        return next;
      });
    }, delay);
    return () => clearInterval(intervalId);
  }, [isReplayMode, isReplayPlaying, replaySpeed, rawHistory]);

  /* ── 5. Canvas Price Alert Visual Lines ───────────────────── */
  useEffect(() => {
    if (!candleRef.current) return;
    alertLinesRef.current.forEach(l => { try { candleRef.current?.removePriceLine(l); } catch {} });
    alertLinesRef.current = [];

    const stockAlerts = priceAlerts.filter(a => a.ticker === selectedSymbol && !a.triggered);
    stockAlerts.forEach(alert => {
      try {
        const pLine = candleRef.current.createPriceLine({
          price: Number(alert.price),
          color: '#A855F7',
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `🔔 Alert ₹${Number(alert.price).toFixed(1)}`,
        });
        alertLinesRef.current.push(pLine);
      } catch {}
    });
  }, [priceAlerts, selectedSymbol, chartReady]);

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

  const toggleLogScale = () => {
    if (!chartRef.current) return;
    const nextMode = isLogScale ? 0 : 1; // 0 = Normal, 1 = Logarithmic
    chartRef.current.priceScale('right').applyOptions({
      mode: nextMode,
    });
    setIsLogScale(!isLogScale);
    toast.success(nextMode === 1 ? 'Logarithmic Price Scale ON' : 'Linear Price Scale ON');
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
    <div ref={cardContainerRef} style={{
      padding: '6px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      height: '100%',
      maxHeight: '100%',
      width: '100%',
      background: '#07090F',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>

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
        .lc-stat:hover { border-color:rgba(99,102,241,0.28)!important; background:rgba(99,102,241,0.05)!important; }
        .lc-btn  { transition:all 0.15s; }
        .lc-btn:hover { opacity:1!important; }
        .pill-btn { transition:all 0.2s; cursor:pointer; }
        .pill-btn:hover { background:rgba(99,102,241,0.2)!important; color:#818CF8!important; }
      `}</style>

      {/* ── TradingView Style Clean Compact Toolbar ── */}
      <div style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        flexWrap:'nowrap',
        gap:8,
        background:'#0B0F1C',
        border:'1px solid rgba(99, 102, 241, 0.15)',
        borderRadius:6,
        padding:'4px 8px',
        position: 'relative',
        zIndex: 50,
        flexShrink: 0,
        height: 38,
      }}>
        {/* Left: Ticker Search Option + Timeframe Selector (Side-by-Side) */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink: 0 }}>
          {/* Symbol Search / Selector Dropdown */}
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
                borderRadius: 5,
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.35)',
                color: '#F0F0FF',
                fontSize: '0.86rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
              }}
              title="Search & Change Stock Ticker"
            >
              <Search size={13} style={{ color: '#818CF8' }} />
              <span>{selectedSymbol || 'STOCK'}</span>
              <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>▾</span>
            </button>

            {/* Quick Symbol Search & Autocomplete Modal */}
            {showSymbolModal && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: 'min(90vw, 320px)',
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 8,
                  padding: 8,
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
                      boxSizing: 'border-box',
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
                          backgroundColor: selectedSymbol === item.ticker ? 'rgba(99,102,241,0.18)' : 'transparent',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.14)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === item.ticker ? 'rgba(99,102,241,0.18)' : 'transparent'}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
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
                              color: selectedSymbol === sym ? '#818CF8' : '#E2E8F0',
                              backgroundColor: selectedSymbol === sym ? 'rgba(99,102,241,0.2)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.12)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedSymbol === sym ? 'rgba(99,102,241,0.2)' : 'transparent'}
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

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          {/* Dual Engine Switcher: TradingView Full Heavy Engine vs StockOracle AI Engine */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.95)',
            padding: '2px',
            borderRadius: 6,
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}>
            <button
              type="button"
              onClick={() => {
                setChartEngine('tradingview');
                localStorage.setItem('stockoracle_chart_engine', 'tradingview');
                toast.success('🚀 Switched to TradingView Full Engine (100+ Indicators, 80+ Drawing Tools)');
              }}
              style={{
                padding: '3px 9px',
                borderRadius: 4,
                border: 'none',
                background: chartEngine === 'tradingview' ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'transparent',
                color: chartEngine === 'tradingview' ? '#FFFFFF' : '#94A3B8',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: chartEngine === 'tradingview' ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
              }}
              title="Full TradingView Engine (80+ Drawing Tools, 100+ Built-in Indicators)"
            >
              <span>🔥 TV Full Engine</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setChartEngine('stockoracle');
                localStorage.setItem('stockoracle_chart_engine', 'stockoracle');
                toast.success('⚡ Switched to StockOracle AI & SMC Terminal Engine');
              }}
              style={{
                padding: '3px 9px',
                borderRadius: 4,
                border: 'none',
                background: chartEngine === 'stockoracle' ? 'linear-gradient(135deg, #A855F7, #6366F1)' : 'transparent',
                color: chartEngine === 'stockoracle' ? '#FFFFFF' : '#94A3B8',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: chartEngine === 'stockoracle' ? '0 2px 8px rgba(168,85,247,0.4)' : 'none',
              }}
              title="StockOracle AI Engine (SMC, Order Flow, Volume Profile, AI Forecasts)"
            >
              <span>⚡ AI / SMC Engine</span>
            </button>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          {/* Timeframe Interval Buttons */}
          <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.03)', padding:'2px', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => handleIntervalChange(iv.value)}
                style={{
                  padding:'3px 8px',
                  borderRadius:4,
                  border:'none',
                  background: interval === iv.value ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: interval === iv.value ? '#818CF8' : '#64748B',
                  fontSize:'0.72rem',
                  fontWeight: interval === iv.value ? 800 : 600,
                  cursor:'pointer',
                }}
              >
                {iv.label}
              </button>
            ))}
          </div>

          {/* Chart Style: Pure Candlestick */}
          <div
            title="Chart Style: Standard Japanese Candlesticks"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#818CF8',
              fontSize: '0.72rem', fontWeight: 700, userSelect: 'none'
            }}
          >
            <span>🕯️ Candlestick</span>
          </div>
        </div>

        {/* Right: Indicators, AI Overlays, Grid Switcher, Snapshot, Fullscreen */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink: 0 }}>
          {/* Historical Bar Replay Simulator Toggle */}
          <button
            onClick={() => {
              const nextState = !isReplayMode;
              setIsReplayMode(nextState);
              if (nextState) {
                // Ensure AI / SMC Engine is active for canvas interactive playback
                setChartEngine('stockoracle');
                localStorage.setItem('stockoracle_chart_engine', 'stockoracle');
                const startIdx = Math.max(5, (rawHistory?.length || 100) - 60);
                setReplayIndex(startIdx);
                setIsReplayPlaying(true);
                toast.success('▶️ Auto-Play Bar Replay Mode Started!');
              } else {
                setIsReplayPlaying(false);
                toast.success('Exited Bar Replay Mode');
              }
            }}
            title="Historical Bar Replay Simulator — Watch Candles Form Live"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 4,
              border: isReplayMode ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
              background: isReplayMode ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
              color: isReplayMode ? '#818CF8' : '#CBD5E1',
              fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <RotateCcw size={12} style={{ color: '#818CF8' }} className={isReplayMode && isReplayPlaying ? 'broker-spin' : ''} />
            <span>Replay</span>
          </button>

          {/* 5. Interactive Canvas Price Alert Button */}
          <button
            onClick={() => setShowAlertModal(true)}
            title="Set Price Alert with Sound Chime"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 4,
              border: '1px solid rgba(168,85,247,0.3)',
              background: 'rgba(168,85,247,0.12)',
              color: '#A855F7',
              fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Bell size={12} style={{ color: '#A855F7' }} />
            <span>Alert</span>
            {priceAlerts.filter(a => a.ticker === selectedSymbol && !a.triggered).length > 0 && (
              <span style={{ backgroundColor: '#A855F7', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: 8, fontWeight: 800 }}>
                {priceAlerts.filter(a => a.ticker === selectedSymbol && !a.triggered).length}
              </span>
            )}
          </button>

          {/* Logarithmic Scale Toggle */}
          <button
            onClick={toggleLogScale}
            title="Toggle Logarithmic Price Scale"
            style={{
              padding: '3px 6px', borderRadius: 4,
              border: isLogScale ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
              background: isLogScale ? 'rgba(99,102,241,0.25)' : 'transparent',
              color: isLogScale ? '#818CF8' : '#94A3B8',
              fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
            }}
          >
            LOG
          </button>

          {/* Indicators Modal Button */}
          <button
            onClick={() => setShowIndicatorsModal(true)}
            title="Indicators, metrics, and strategies"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 5,
              border: showIndicatorsModal ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
              background: showIndicatorsModal ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
              color: showIndicatorsModal ? '#818CF8' : '#E2E8F0',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Activity size={13} style={{ color: '#818CF8' }} />
            <span>Indicators</span>
            {Object.values(activeIndicatorsMap).filter(Boolean).length > 0 && (
              <span style={{ backgroundColor: '#6366F1', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: 10, fontWeight: 800 }}>
                {Object.values(activeIndicatorsMap).filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Auto-Drawing AI Overlays (S/R, Pivots, Fibs) */}
          <button
            onClick={() => {
              setShowKeyLevels((prev) => !prev);
              toast.success(!showKeyLevels ? "🪄 AI Technical Overlays Enabled (S/R, Pivots, Fibs)" : "AI Overlays Disabled");
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 5,
              border: showKeyLevels ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
              background: showKeyLevels ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
              color: showKeyLevels ? '#818CF8' : '#E2E8F0',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Auto-draw Support/Resistance & Fibonacci Overlays"
          >
            <Sparkles size={13} style={{ color: '#818CF8' }} />
            <span>AI Overlays</span>
          </button>

          {/* TradingView Multi-Chart Layout Switcher [ 1x1 | 1x2 | 2x1 | 2x2 ] */}
          <div style={{ display:'flex', alignItems:'center', gap:2, background:'rgba(255,255,255,0.03)', padding:'2px', borderRadius:5, border:'1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setChartLayout('1x1')}
              title="Single Chart (1x1)"
              style={{
                padding:'3px 6px',
                borderRadius:3,
                border:'none',
                background: chartLayout === '1x1' ? '#6366F1' : 'transparent',
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
                padding:'3px 6px',
                borderRadius:3,
                border:'none',
                background: chartLayout === '1x2' ? '#6366F1' : 'transparent',
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
                padding:'3px 6px',
                borderRadius:3,
                border:'none',
                background: chartLayout === '2x1' ? '#6366F1' : 'transparent',
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
                padding:'3px 6px',
                borderRadius:3,
                border:'none',
                background: chartLayout === '2x2' ? '#6366F1' : 'transparent',
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
            style={{ padding:'4px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'#94A3B8', cursor:'pointer' }}
          >
            <Camera size={13} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Fullscreen Chart"
            style={{ padding:'4px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'#94A3B8', cursor:'pointer' }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* ── Floating Bar Replay Auto-Play Control Bar ── */}
      {isReplayMode && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))',
          border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
          flexShrink: 0, gap: 10, zIndex: 40, flexWrap: 'wrap',
        }}>
          {/* Left Title & Current Date/Bar Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 5 }}>
              <RotateCcw size={14} className={isReplayPlaying ? 'broker-spin' : ''} />
              <span>BAR REPLAY</span>
            </span>
            <div style={{
              fontSize: '0.7rem', color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              📅 {rawHistory && rawHistory[replayIndex - 1] ? (rawHistory[replayIndex - 1].date || rawHistory[replayIndex - 1].time) : 'Live'}
              <span style={{ color: '#64748B', marginLeft: 6 }}>({replayIndex || 0}/{rawHistory?.length || 0} bars)</span>
            </div>
          </div>

          {/* Center Playback Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Rewind to Start */}
            <button
              onClick={() => {
                setIsReplayPlaying(false);
                setReplayIndex(5);
                toast('Rewound to oldest candle');
              }}
              title="Jump to oldest candle"
              style={{ padding: '4px 8px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              ⏮ Start
            </button>

            {/* Step Back -10 */}
            <button
              onClick={() => {
                setIsReplayPlaying(false);
                setReplayIndex(prev => Math.max(5, (prev || 10) - 10));
              }}
              title="Jump back 10 bars"
              style={{ padding: '4px 8px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              ⏪ -10
            </button>

            {/* Play / Pause Auto Play Button */}
            <button
              onClick={() => setIsReplayPlaying(!isReplayPlaying)}
              style={{
                padding: '5px 16px', borderRadius: 6,
                background: isReplayPlaying ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFF', border: 'none', fontWeight: 800, fontSize: '0.76rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: isReplayPlaying ? '0 2px 10px rgba(239,68,68,0.4)' : '0 2px 10px rgba(168,85,247,0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              {isReplayPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isReplayPlaying ? 'PAUSE' : 'AUTO PLAY'}
            </button>

            {/* Step Forward +1 */}
            <button
              onClick={() => {
                setIsReplayPlaying(false);
                setReplayIndex(prev => Math.min((rawHistory?.length || 100), (prev || 10) + 1));
              }}
              title="Step forward 1 bar"
              style={{ padding: '4px 9px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
            >
              <SkipForward size={13} /> +1
            </button>

            {/* Step Forward +10 */}
            <button
              onClick={() => {
                setIsReplayPlaying(false);
                setReplayIndex(prev => Math.min((rawHistory?.length || 100), (prev || 10) + 10));
              }}
              title="Jump forward 10 bars"
              style={{ padding: '4px 8px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              ⏩ +10
            </button>

            {/* Speed Selector Pills */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.4)', padding: '2px 4px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }}>
              {[0.5, 1, 2, 3, 5, 10].map(spd => (
                <button
                  key={spd}
                  onClick={() => setReplaySpeed(spd)}
                  style={{
                    padding: '3px 6px', borderRadius: 3, border: 'none',
                    background: replaySpeed === spd ? '#6366F1' : 'transparent',
                    color: replaySpeed === spd ? '#FFF' : '#94A3B8',
                    fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Scrubber Timeline Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <input
                type="range"
                min="5"
                max={rawHistory?.length || 100}
                value={replayIndex || (rawHistory?.length || 100)}
                onChange={(e) => {
                  setIsReplayPlaying(false);
                  setReplayIndex(Number(e.target.value));
                }}
                style={{ width: 140, cursor: 'pointer', accentColor: '#818CF8' }}
              />
            </div>
          </div>

          {/* Exit Button */}
          <button
            onClick={() => {
              setIsReplayMode(false);
              setIsReplayPlaying(false);
            }}
            style={{
              padding: '4px 10px', borderRadius: 5,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer'
            }}
          >
            ✕ Exit Replay
          </button>
        </div>
      )}

      {/* ── Main Chart Body: Multi-Chart Grid OR Single Chart Workstation (Fills Available Height) ── */}
      {chartLayout !== '1x1' ? (
        <div style={{ flex: 1, minHeight: 0, height: '100%', width: '100%', overflow: 'hidden' }}>
          <MultiChartGrid layout={chartLayout} onLayoutChange={setChartLayout} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
          
          {/* 1. TradingView Full Heavy Engine Container */}
          <div style={{
            position: 'absolute', inset: 0,
            display: chartEngine === 'tradingview' && !isSplitView ? 'block' : 'none',
            borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)',
            background: '#070A14',
            overflow: 'hidden',
            zIndex: chartEngine === 'tradingview' && !isSplitView ? 2 : 0,
          }}>
            <TradingViewAdvancedChart
              symbol={selectedSymbol}
              interval={interval}
              onOpenSettings={() => setShowChartSettingsModal(true)}
            />
          </div>

          {/* 2. StockOracle AI Engine (Lightweight Chart + Drawing Tools) */}
          <div style={{
            position: 'absolute', inset: 0,
            display: chartEngine === 'stockoracle' || isSplitView ? 'grid' : 'none',
            gridTemplateColumns: isSplitView ? '1fr 1fr' : '1fr',
            gap: 6, overflow: 'hidden',
            zIndex: chartEngine === 'stockoracle' || isSplitView ? 2 : 0,
          }}>
            {/* Chart 1 Container with TradingView Left Drawing Sidebar */}
            <div style={{
              background:'rgba(255,255,255,0.015)',
              border:'1px solid rgba(99,102,241,0.12)',
              borderRadius: 8, overflow:'hidden',
              position:'relative',
              display: 'flex',
              height: '100%',
              flex: 1,
              minHeight: 0,
            }}>
              {/* ── TradingView Style Vertical Left Drawing Sidebar ── */}
              <DrawingTools
                chartRef={chartRef}
                candleRef={candleRef}
                candles={rawHistory || []}
                symbol={selectedSymbol}
                interval={interval}
                chartReady={chartReady}
                onOpenSettings={() => setShowChartSettingsModal(true)}
              />

              {/* ── Center Chart Canvas ── */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
                {/* ── TradingView Style On-Chart Active Indicators Legend & HUD ── */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: 12,
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}>
                  {/* Ultra-Fast Live Hover OHLCV HUD (Direct 0ms DOM Ref) */}
                  <div
                    ref={hudRef}
                    style={{
                      display: 'none',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      background: 'rgba(7, 10, 20, 0.92)',
                      padding: '3px 10px',
                      borderRadius: 4,
                      backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                      fontFamily: 'JetBrains Mono, monospace',
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                {loading && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(9,12,24,0.75)', zIndex:10 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', border:'3px solid rgba(168,85,247,0.15)', borderTopColor:'#A855F7', animation:'spin 0.75s linear infinite' }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}

                <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
              </div>
              
              {/* ── Right Docked Pro Indicator Panel (AI Patterns, Backtest) ── */}
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
                      {advancedPanelTab === 'patterns' ? 'AI PATTERN SCANNER' :
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

            {/* Comparison Chart 2 Container (Split View Only) */}
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
        </div>
      )}

      {/* ── Interactive Canvas Price Alert & Sound Chime Manager Modal ── */}
      {showAlertModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150 }}>
          <div style={{ background:'#0D1322', border:'1px solid rgba(168,85,247,0.4)', borderRadius:14, padding:20, width:380, maxWidth:'92vw', display:'flex', flexDirection:'column', gap:12, boxShadow:'0 20px 40px rgba(0,0,0,0.8)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, color:'#F0F0FF', fontSize:'1rem', display:'flex', alignItems:'center', gap:8 }}>
                <Bell size={16} color="#A855F7" /> Price Alerts: {selectedSymbol}
              </h3>
              <button
                onClick={() => {
                  playAlertChime();
                  toast.success('🔔 Alert Chime Tested');
                }}
                title="Test Crystal Audio Chime"
                style={{ padding:'2px 8px', borderRadius:4, background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.3)', color:'#A855F7', fontSize:'0.68rem', cursor:'pointer', fontWeight:700 }}
              >
                🔊 Test Chime
              </button>
            </div>

            <p style={{ margin:0, color:'#94A3B8', fontSize:'0.74rem' }}>
              Set an alert line on the chart canvas. Rings audio chime & sends toast notification on price hit:
            </p>

            {/* Quick Price Percentage Presets */}
            {curPrice && (
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {[-5, -2, -1, 1, 2, 5].map(pct => {
                  const targetP = (curPrice * (1 + pct / 100)).toFixed(2);
                  return (
                    <button
                      key={pct}
                      onClick={() => setTargetAlertPrice(targetP)}
                      style={{
                        padding:'3px 6px', borderRadius:4, border:'1px solid rgba(255,255,255,0.1)',
                        background:'rgba(255,255,255,0.04)', color: pct > 0 ? '#10B981' : '#EF5350',
                        fontSize:'0.68rem', fontWeight:700, cursor:'pointer'
                      }}
                    >
                      {pct > 0 ? `+${pct}%` : `${pct}%`} (₹{Number(targetP).toFixed(0)})
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display:'flex', gap:6 }}>
              <input
                type="number"
                step="0.05"
                placeholder={`Target Price (LTP ₹${curPrice?.toFixed(2) || '0.00'})`}
                value={targetAlertPrice}
                onChange={e => setTargetAlertPrice(e.target.value)}
                style={{ flex:1, padding:'8px 12px', borderRadius:6, border:'1px solid rgba(168,85,247,0.3)', background:'#060913', color:'#fff', fontSize:'0.86rem', outline:'none', fontFamily:'JetBrains Mono, monospace' }}
              />
              <button
                onClick={() => {
                  const p = Number(targetAlertPrice);
                  if (p > 0) {
                    const newAlert = {
                      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                      ticker: selectedSymbol,
                      price: p,
                      direction: curPrice && p > curPrice ? 'above' : 'below',
                      triggered: false,
                      createdAt: new Date().toISOString(),
                    };
                    setPriceAlerts(prev => [...prev, newAlert]);
                    toast.success(`🔔 Alert line created for ${selectedSymbol} at ₹${p.toFixed(2)}`);
                    setTargetAlertPrice('');
                  }
                }}
                style={{ padding:'8px 16px', borderRadius:6, border:'none', background:'#A855F7', color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}
              >
                + Add Alert
              </button>
            </div>

            {/* Active Alerts List for this Symbol */}
            <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:4, marginTop:4 }}>
              <div style={{ fontSize:'0.66rem', color:'#64748B', fontWeight:700, letterSpacing:'0.05em' }}>
                ACTIVE ALERTS ({priceAlerts.filter(a => a.ticker === selectedSymbol).length})
              </div>
              {priceAlerts.filter(a => a.ticker === selectedSymbol).length === 0 ? (
                <div style={{ fontSize:'0.72rem', color:'#475569', padding:'6px 0', fontStyle:'italic' }}>
                  No alerts set for {selectedSymbol}.
                </div>
              ) : (
                priceAlerts.filter(a => a.ticker === selectedSymbol).map(alert => (
                  <div key={alert.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'5px 8px', borderRadius:4, background:'rgba(255,255,255,0.03)',
                    border: alert.triggered ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(168,85,247,0.2)',
                    fontSize:'0.74rem'
                  }}>
                    <span style={{ color: alert.triggered ? '#10B981' : '#F0F0FF', fontFamily:'JetBrains Mono, monospace', fontWeight:700 }}>
                      ₹{Number(alert.price).toFixed(2)} {alert.triggered ? '✓ (Triggered)' : '⏳ Active'}
                    </span>
                    <button
                      onClick={() => setPriceAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      style={{ background:'none', border:'none', color:'#EF5350', cursor:'pointer', fontSize:'0.72rem', padding:'0 4px' }}
                      title="Delete Alert"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
              <button
                onClick={() => setShowAlertModal(false)}
                style={{ padding:'6px 14px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#CBD5E1', cursor:'pointer', fontSize:'0.76rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact Space-Saving Bottom Status Bar with Expandable Insights ── */}
      {isDaily && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 10px',
            backgroundColor: '#0B0F1C',
            border: '1px solid rgba(99,102,241,0.12)',
            borderRadius: 6,
            fontSize: '0.72rem',
            color: '#94A3B8',
            height: 26,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span>LTP: <strong style={{ color: '#FFF', fontFamily: 'JetBrains Mono, monospace' }}>{curPrice ? `₹${curPrice.toFixed(2)}` : '—'}</strong></span>
              <span>7D Target: <strong style={{ color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>{prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toFixed(2)}` : '—'}</strong></span>
              <span>Return: <strong style={{ color: (prediction?.predicted_return_7d || 0) >= 0 ? '#10B981' : '#EF5350' }}>{prediction?.predicted_return_7d != null ? `${prediction.predicted_return_7d >= 0 ? '+' : ''}${(prediction.predicted_return_7d * 100).toFixed(2)}%` : '—'}</strong></span>
              <span>Signal: <strong style={{ color: sigMeta.color }}>{predLoading ? 'Loading…' : sigMeta.label}</strong></span>
              <span>Confidence: <strong style={{ color: scoreColor }}>{score}/100</strong></span>
            </div>

            <button
              onClick={() => setShowBottomStats(!showBottomStats)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                padding: '2px 6px',
                color: '#818CF8',
                cursor: 'pointer',
                fontSize: '0.68rem',
                fontWeight: 600,
              }}
            >
              {showBottomStats ? '▴ Hide' : '▾ Stats'}
            </button>
          </div>

          {/* Expanded Cards (Shown only on demand) */}
          {showBottomStats && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:6 }}>
              {[
                { label:'CURRENT PRICE',   value: curPrice ? `₹${curPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—', color:'#F0F0FF' },
                { label:'AI TARGET (7D)',  value: prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : predLoading ? 'Loading…' : '—', color:'#818CF8' },
                { label:'EXPECTED RETURN', value: prediction?.predicted_return_7d != null ? `${prediction.predicted_return_7d>=0?'+':''}${(prediction.predicted_return_7d*100).toFixed(2)}%` : predLoading ? 'Loading…' : '—',
                  color: prediction?.predicted_return_7d >= 0 ? '#10B981' : '#EF5350' },
                { label:'AI CONFIDENCE',   value: prediction?.ai_confidence_score != null ? `${prediction.ai_confidence_score}/100` : predLoading ? 'Loading…' : '—', color:scoreColor },
                { label:'95% UPPER',       value:(prediction?.predicted_upper_price_7d??prediction?.high_bound) ? `₹${(prediction.predicted_upper_price_7d??prediction.high_bound).toFixed(2)}` : predLoading?'Loading…':'—', color:'#10B981' },
                { label:'95% LOWER',       value:(prediction?.predicted_lower_price_7d??prediction?.low_bound)  ? `₹${(prediction.predicted_lower_price_7d??prediction.low_bound).toFixed(2)}`  : predLoading?'Loading…':'—', color:'#EF5350' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background:'rgba(255,255,255,0.02)', border:'1px solid rgba(99,102,241,0.12)',
                  borderRadius:6, padding:'6px 10px',
                }}>
                  <div style={{ fontSize:'0.58rem', color:'#64748B', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:'0.78rem', fontWeight:700, color, fontFamily:'JetBrains Mono, monospace' }}>{value}</div>
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
