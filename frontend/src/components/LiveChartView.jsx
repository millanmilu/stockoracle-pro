import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import useStore from '../store/useStore';
import { useStock } from '../hooks/useStock';
import { Activity, X } from 'lucide-react';
import toast from 'react-hot-toast';
import MultiChartGrid from './MultiChartGrid';
import DrawingTools from './chart-tools/DrawingTools';
import TradingViewAdvancedChart from './chart-tools/TradingViewAdvancedChart';
import IndicatorsModal from './IndicatorsModal';
import IndicatorSettingsModal from './IndicatorSettingsModal';
import ChartSettingsModal from './ChartSettingsModal';
import AIPatternRecognition from './chart-tools/AIPatternRecognition';
import TrustBadge from './TrustBadge';
import { parseNum, toChartTime, addBusinessDays, getSessionBucketStart, POPULAR_STOCKS, INTERVALS, SIG, CHART_OPTIONS, CANDLE_STYLE } from '../utils/chartHelpers';
import { calculateSMA, calculateEMA, calculateBollingerBands, calculateRSI, calculateMACD, calculateALMA, calculateKeyLevels, detectPatterns, calculateVWAP, calculateSupertrend } from '../utils/chartIndicators';
import SymbolSearchModal from './chart-tools/SymbolSearchModal';
import { playAlertChime } from '../utils/soundChime';
import { getWsUrl } from '../utils/api';

// Subcomponents modularized for maintainability & clean testing
import BacktestOverlayPanel from './chart/BacktestOverlayPanel';
import PriceAlertModal from './chart/PriceAlertModal';
import BarReplayControl from './chart/BarReplayControl';
import ChartToolbar from './chart/ChartToolbar';
import ChartLegendHUD from './chart/ChartLegendHUD';
import ChartFeedStatus from './chart/ChartFeedStatus';
import ChartBottomStats from './chart/ChartBottomStats';

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export default function LiveChartView() {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const wsLiveData = useStore(s => s.wsLiveData);
  const { fetchHistory, fetchPredict, searchStock, searchStocks, fetchBacktest } = useStock();

  const [interval,    setInterval]    = useState('1d');
  const [timeframe,   setTimeframe]   = useState('2Y');
  const [rawHistory,  setRawHistory]  = useState(null);
  const [prediction,  setPrediction]  = useState(null);
  const storeLive = useStore(s => s.livePrices?.[selectedSymbol]);
  // Live tick for the comparison chart (split view). The WS handler stores every subscribed
  // ticker, so the compare symbol carries its own price / session OHLC / liveness flag.
  const compareLive = useStore(s => (isSplitView ? s.livePrices?.[compareSymbol] : null));
  const [localLivePrice, setLocalLivePrice] = useState(null);
  const [localLiveChange, setLocalLiveChange] = useState(null);

  const livePrice = storeLive?.price ?? localLivePrice;
  const liveChange = storeLive?.change_pct ?? localLiveChange;

  const setLivePrice = useCallback((p) => {
    setLocalLivePrice(p);
  }, []);
  const setLiveChange = useCallback((c) => {
    setLocalLiveChange(c);
  }, []);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsIsLive, setWsIsLive] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [dataSource,  setDataSource]  = useState('unknown');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFetchError, setHistoryFetchError] = useState(null);

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
  const [showVolume,       setShowVolume]       = useState(false);
  const [showVWAP,         setShowVWAP]         = useState(false);
  const [showSupertrend,   setShowSupertrend]   = useState(false);
  const [showSMA,          setShowSMA]          = useState(false);
  const [showEMA,          setShowEMA]          = useState(false);
  const [showBB,           setShowBB]           = useState(false);
  const [showRSI,          setShowRSI]          = useState(false);
  const [showMACD,         setShowMACD]         = useState(false);
  const [showALMA,         setShowALMA]         = useState(false);
  const [showKeyLevels,    setShowKeyLevels]    = useState(false);
  const [showPatterns,     setShowPatterns]     = useState(false);
  const [showAICone,       setShowAICone]       = useState(true);
  const [showIndicatorSettingsModal, setShowIndicatorSettingsModal] = useState(false);

  // Customizable Indicator Parameters
  const [indicatorParams, setIndicatorParams] = useState({
    smaPeriod: 20,
    emaPeriod: 20,
    bbPeriod: 20,
    bbStdDev: 2,
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
  });

  const handleUpdateParams = useCallback((newVals) => {
    setIndicatorParams(prev => ({ ...prev, ...newVals }));
  }, []);

  const handleResetDefaults = useCallback(() => {
    setIndicatorParams({
      smaPeriod: 20,
      emaPeriod: 20,
      bbPeriod: 20,
      bbStdDev: 2,
      rsiPeriod: 14,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
    });
    toast.success('Indicator parameters reset to default values');
  }, []);
  
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
    vwap: null,
    supertrend: null,
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
    vwap: showVWAP,
    supertrend: showSupertrend,
    sma_20: showSMA,
    ema_20: showEMA,
    boll: showBB,
    rsi_14: showRSI,
    macd: showMACD,
    alma: showALMA,
    auto_key_levels: showKeyLevels,
    ai_patterns: showPatterns || (showAdvancedPanel && advancedPanelTab === 'patterns'),
    backtester: showAdvancedPanel && advancedPanelTab === 'backtest',
  }), [showVolume, showVWAP, showSupertrend, showSMA, showEMA, showBB, showRSI, showMACD, showALMA, showKeyLevels, showPatterns, showAdvancedPanel, advancedPanelTab]);

  const handleToggleIndicator = useCallback((id) => {
    switch (id) {
      case 'vol_24h':
      case 'volume':
        setShowVolume(prev => !prev);
        break;
      case 'vwap':
        setShowVWAP(prev => !prev);
        break;
      case 'supertrend':
        setShowSupertrend(prev => !prev);
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
  const [chartEngine, setChartEngine] = useState(() => localStorage.getItem('stockoracle_chart_engine') || 'stockoracle');

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
  const bbMiddleRef    = useRef(null);
  const bbLowerRef     = useRef(null);
  const rsiRef         = useRef(null);
  const rsiPriceLinesRef = useRef([]);
  const rsiLine70Ref   = useRef(null);
  const rsiLine30Ref   = useRef(null);
  const macdRef        = useRef(null);
  const macdSignalRef  = useRef(null);
  const macdHistRef    = useRef(null);
  const almaRef        = useRef(null);
  const vwapRef        = useRef(null);
  const supertrendRef  = useRef(null);
  const keyLevelLinesRef = useRef([]);
  const alertLinesRef  = useRef([]);
  const lastTriggeredMap = useRef(new Set());

  const predLineRef    = useRef(null);
  const upperLineRef   = useRef(null);
  const lowerLineRef   = useRef(null);
  const livePriceLineRef = useRef(null);
  const activeCandleRef  = useRef(null);
  const sessionOHLCRef   = useRef(null);
  // True only when the MOST RECENT tick for the active symbol carried is_live === true.
  // Used to gate daily "today" bar creation so cached/fallback ticks never fabricate bars.
  const lastTickLiveRef  = useRef(false);
  // Monotonic request counters: a slow/stale history response must never overwrite the
  // chart of a newer request (rapid symbol/interval switching returns out of order).
  const historyReqSeqRef = useRef(0);
  const compareHistoryReqSeqRef = useRef(0);
  const hudRef           = useRef(null);

  // Chart 2 (Comparison) Refs
  const containerRef2  = useRef(null);
  const chartRef2      = useRef(null);
  const candleRef2     = useRef(null);
  // Signature of the last bound dataset head — lets the bind effect fit zoom only on
  // real data changes (symbol/interval/first rows), not on every live tick merge.
  const compareChartHeadRef = useRef(null);

  const wsRef          = useRef(null);
  const selectedSymbolRef = useRef(selectedSymbol);
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  const isDaily = interval === '1d';

  /* ── Interval Handler ─────────────────────────────────────── */

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
    activeCandleRef.current = null;
    sessionOHLCRef.current = null;
    lastTickLiveRef.current = false;
    setLocalLivePrice(null);
    setLocalLiveChange(null);
    if (chartRef.current) {
      try {
        chartRef.current.applyOptions({
          timeScale: {
            timeVisible: iv !== '1d',
            secondsVisible: false,
          }
        });
      } catch {}
    }
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
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeRef.current = volume;

    // SMA, EMA, BB, ALMA, VWAP, Supertrend
    const sma = chart.addLineSeries({ color: '#00E5FF', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    smaRef.current = sma;

    const ema = chart.addLineSeries({ color: '#FF9100', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    emaRef.current = ema;

    const alma = chart.addLineSeries({ color: '#FACC15', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    almaRef.current = alma;

    const vwap = chart.addLineSeries({ color: '#06B6D4', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    vwapRef.current = vwap;

    const supertrend = chart.addLineSeries({ color: '#10B981', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    supertrendRef.current = supertrend;

    const bbUpper = chart.addLineSeries({ color: '#E040FB', lineWidth: 1.2, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbUpperRef.current = bbUpper;

    const bbMiddle = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.85)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbMiddleRef.current = bbMiddle;

    const bbLower = chart.addLineSeries({ color: '#E040FB', lineWidth: 1.2, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
    bbLowerRef.current = bbLower;

    // RSI Sub-chart (overlay scale with scaleMargins)
    const rsi = chart.addLineSeries({
      color: '#F43F5E', lineWidth: 1.5,
      priceScaleId: '',
      scaleMargins: { top: 0.82, bottom: 0 },
      priceLineVisible: false,
      lastValueVisible: true,
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
      priceLineVisible: false,
      lastValueVisible: false,
    });
    macdRef.current = macd;

    const macdSignal = chart.addLineSeries({
      color: '#F97316', lineWidth: 1.5,
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    macdSignalRef.current = macdSignal;

    const macdHist = chart.addHistogramSeries({
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
      priceLineVisible: false,
      lastValueVisible: false,
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
      vwapRef.current = null;
      supertrendRef.current = null;
      smaRef.current = null;
      emaRef.current = null;
      almaRef.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      rsiRef.current = null;
      rsiPriceLinesRef.current = [];
      rsiLine70Ref.current = null;
      rsiLine30Ref.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      keyLevelLinesRef.current = [];
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
    if (!selectedSymbol) return;
    setLoading(true);
    setPredLoading(true);
    setHistoryFetchError(null);
    // Clear old candles immediately on symbol change to prevent stale/single-candle ghost
    activeCandleRef.current = null;
    sessionOHLCRef.current = null;
    lastTickLiveRef.current = false;
    setRawHistory(null);
    setPrediction(null);

    // Preload live price from store if available for the new symbol, otherwise clear to prevent cross-symbol price contamination
    const storedLive = useStore.getState().livePrices?.[selectedSymbol];
    setLocalLivePrice(storedLive && storedLive.price > 0 ? storedLive.price : null);
    setLocalLiveChange(storedLive && storedLive.price > 0 ? storedLive.change_pct : null);

    console.log('[LiveChart] Fetching history for:', selectedSymbol, interval, timeframe);
    const seq = ++historyReqSeqRef.current;
    fetchHistory(selectedSymbol, interval, timeframe).then(result => {
      // Drop stale responses — a newer symbol/interval request superseded this one
      if (seq !== historyReqSeqRef.current) return;
      const candleCount = result?.candles?.length ?? 0;
      console.log(`[API] History loaded for ${selectedSymbol}: ${candleCount} candles (source: ${result?.dataSource ?? '?'})`);
      if (candleCount === 0) {
        console.warn(`[API] ⚠️ No candles returned for ${selectedSymbol}. Backend may lack historical data.`);
        setHistoryFetchError(`No historical data found for "${selectedSymbol}". Try a different symbol or check backend connection.`);
      } else if (candleCount <= 1) {
        console.warn(`[API] ⚠️ Only ${candleCount} candle(s) returned for ${selectedSymbol}. Backend may lack historical data.`);
      }
      setRawHistory(result?.candles ?? []);
      if (result?.dataSource) setDataSource(result.dataSource);
      setLoading(false);
    }).catch(err => {
      if (seq !== historyReqSeqRef.current) return;
      console.error('[API] History fetch failed:', err);
      const errMsg = err?.response?.data?.detail || err?.message || 'Failed to load chart data';
      setHistoryFetchError(`Chart data could not be loaded: ${errMsg}. Check backend connection.`);
      setRawHistory([]);
      setLoading(false);
    });

    if (isDaily) {
      fetchPredict(selectedSymbol).then(pred => {
        // Ignore predictions for a symbol the user already navigated away from
        if (seq !== historyReqSeqRef.current) return;
        setPrediction(pred);
        setPredLoading(false);
      }).catch(() => {
        if (seq !== historyReqSeqRef.current) return;
        setPredLoading(false);
      });
    } else {
      setPrediction(null);
      setPredLoading(false);
    }

    // Invalidate any in-flight request when params change again or on unmount
    return () => { historyReqSeqRef.current += 1; };
  }, [selectedSymbol, interval, timeframe]);

  /* ── Comparison Stock Data Fetch ──────────────────────────── */

  useEffect(() => {
    // Clear immediately so a stale dataset never mixes with the new symbol's live ticks.
    // The bind effect keeps prior candles visible until fresh rows arrive (like the main chart).
    setRawHistoryCompare(null);
    if (!isSplitView) return;
    const seq = ++compareHistoryReqSeqRef.current;
    fetchHistory(compareSymbol, interval, timeframe).then(result => {
      // Drop stale responses — comparison symbol/interval changed meanwhile
      if (seq !== compareHistoryReqSeqRef.current) return;
      setRawHistoryCompare(result?.candles ?? []);
    });
    return () => { compareHistoryReqSeqRef.current += 1; };
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
        const subs = [selectedSymbolRef.current];
        if (isSplitView && compareSymbol) {
          subs.push(compareSymbol);
        }
        try {
          ws.send(JSON.stringify({ subscribe: subs }));
          console.log('[WS] Connected & Subscribed to:', subs);
        } catch {}
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        setWsIsLive(false);
        lastTickLiveRef.current = false;
        useStore.getState().setWsConnected?.(false);
        useStore.getState().setWsLiveData?.(false);
        reconnectTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 15000);
          connectWs();
        }, retryDelay);
      };

      ws.onerror = () => {
        if (unmounted) return;
        setWsConnected(false);
        setWsIsLive(false);
        lastTickLiveRef.current = false;
        useStore.getState().setWsConnected?.(false);
        try { ws.close(); } catch {}
      };

      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const { ticker, price, change_pct, is_live, open: dayOpen, high: dayHigh, low: dayLow } = data;

          // LIVE only when the server confirms a real-time feed (is_live: true).
          // Fallback ticks (Angel One session down, market closed/holiday, stale DB price)
          // carry is_live: false and must never be labeled live. The market-hours check is
          // done server-side in strict IST (backend/data/market_calendar.py), so the server
          // flag is authoritative — do NOT OR it with a client clock check here.
          const isLiveTick = is_live === true;
          useStore.getState().setWsLiveData?.(isLiveTick);
          setWsIsLive(isLiveTick);

          // Persist every subscribed ticker's tick — the comparison chart (split view)
          // consumes its own symbol's entry for live candle updates.
          useStore.getState().setLivePrice?.(ticker, {
            price, change_pct,
            is_live: isLiveTick,
            open: dayOpen, high: dayHigh, low: dayLow,
          });

          // Always read fresh active symbol directly from store & ref to eliminate any closure issue
          const currentSym = useStore.getState().selectedSymbol || selectedSymbolRef.current;
          if (ticker === currentSym) {
            // Record whether THIS tick is confirmed live (gates daily bar creation below)
            lastTickLiveRef.current = isLiveTick;
            // Anchor session OHLC if provided by server feed
            if (dayOpen > 0 || dayHigh > 0 || dayLow > 0) {
              sessionOHLCRef.current = {
                open: dayOpen > 0 ? Number(dayOpen) : null,
                high: dayHigh > 0 ? Number(dayHigh) : null,
                low: dayLow > 0 ? Number(dayLow) : null,
              };
            }

            // Always update live price — stale prices still form candles
            setLivePrice(price);
            setLiveChange(change_pct);

            // Real-time Canvas Price Alert Trigger & Chime
            setPriceAlerts(prevAlerts => {
              let changed = false;
              const updated = prevAlerts.map(alert => {
                if (alert.ticker === currentSym && !alert.triggered) {
                  const target = Number(alert.price);
                  const isHit = Math.abs(price - target) <= Math.max(0.5, target * 0.002) || 
                                (alert.direction === 'above' && price >= target) ||
                                (alert.direction === 'below' && price <= target);
                  if (isHit && !lastTriggeredMap.current.has(alert.id)) {
                    lastTriggeredMap.current.add(alert.id);
                    changed = true;
                    playAlertChime();
                    toast.success(`🔔 PRICE ALERT TRIGGERED: ${currentSym} reached ₹${price.toFixed(2)} (Target ₹${target})`, {
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
      setWsIsLive(false);
      lastTickLiveRef.current = false;
      useStore.getState().setWsConnected?.(false);
      useStore.getState().setWsLiveData?.(false);
    };
  }, []); // Persistent connection on mount

  // Dedicated Re-subscribe on Symbol or Split-view Change
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const subs = [selectedSymbol];
    if (isSplitView && compareSymbol) {
      subs.push(compareSymbol);
    }
    try {
      wsRef.current.send(JSON.stringify({ subscribe: subs }));
      console.log('[WS] Re-subscribed on symbol change:', subs);
    } catch (e) {
      console.error('[WS] Subscribe failed:', e);
    }
  }, [selectedSymbol, compareSymbol, isSplitView, wsConnected]);

  /* ── Primary Chart Data Binding & Pattern Markers ─────────── */

  useEffect(() => {
    if (!candleRef.current) return;
    // rawHistory === null means data is still loading (symbol changed) — don't clear chart yet,
    // as that causes a blank flash between symbol switches. Only clear when explicitly empty [].
    if (rawHistory === null) return;
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
    // NOTE: activeCandleRef is intentionally NOT reset here.
    // It is only reset in handleIntervalChange() and when selectedSymbol changes.
    // Resetting it here wipes the live candle every time rawHistory refetches (prediction update, etc.)


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
      ? dedupedCandles.slice(0, Math.min(Math.max(5, replayIndex || (dedupedCandles.length - 60)), dedupedCandles.length))
      : dedupedCandles;

    try { 
      candleRef.current.setData(activeCandles); 
      if (isReplayMode && chartRef.current && activeCandles.length > 0) {
        const total = activeCandles.length;
        const visibleCount = Math.min(total, 80);
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(0, total - visibleCount),
          to: total + 3,
        });
      } else if (!isReplayMode && chartRef.current && activeCandles.length > 0) {
        const total = activeCandles.length;
        const visibleCount = Math.min(total, intraday ? 80 : 90);
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(0, total - visibleCount),
          to: total + (isDaily ? 8 : 4),
        });
      }
    } catch (e) {
      console.error('Error binding candle data:', e);
    }

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

    // 3. Technical Indicators (SMA, EMA, BB, VWAP, Supertrend)
    const smaLen = indicatorParams.smaPeriod || 20;
    if (showSMA && smaRef.current && activeCandles.length >= smaLen) {
      try { smaRef.current.setData(calculateSMA(activeCandles, smaLen)); } catch {}
    } else { try { smaRef.current?.setData([]); } catch {} }

    const emaLen = indicatorParams.emaPeriod || 20;
    if (showEMA && emaRef.current && activeCandles.length >= emaLen) {
      try { emaRef.current.setData(calculateEMA(activeCandles, emaLen)); } catch {}
    } else { try { emaRef.current?.setData([]); } catch {} }

    const bbLen = indicatorParams.bbPeriod || 20;
    const bbMult = indicatorParams.bbStdDev || 2;
    if (showBB && bbUpperRef.current && bbLowerRef.current && bbMiddleRef.current && activeCandles.length >= bbLen) {
      const { upper, middle, lower } = calculateBollingerBands(activeCandles, bbLen, bbMult);
      try {
        bbUpperRef.current.setData(upper);
        bbMiddleRef.current.setData(middle);
        bbLowerRef.current.setData(lower);
      } catch {}
    } else {
      try {
        bbUpperRef.current?.setData([]);
        bbMiddleRef.current?.setData([]);
        bbLowerRef.current?.setData([]);
      } catch {}
    }

    // VWAP Overlay
    let currentVWAP = null;
    if (showVWAP && vwapRef.current && activeCandles.length > 5) {
      const vwapVals = calculateVWAP(activeCandles);
      try {
        vwapRef.current.setData(vwapVals);
        if (vwapVals.length > 0) currentVWAP = vwapVals[vwapVals.length - 1].value;
      } catch {}
    } else {
      try { vwapRef.current?.setData([]); } catch {}
    }

    // Supertrend Overlay
    let currentSupertrend = null;
    if (showSupertrend && supertrendRef.current && activeCandles.length > 10) {
      const stVals = calculateSupertrend(activeCandles, 10, 3);
      try {
        supertrendRef.current.setData(stVals);
        if (stVals.length > 0) currentSupertrend = stVals[stVals.length - 1].value;
      } catch {}
    } else {
      try { supertrendRef.current?.setData([]); } catch {}
    }

    // RSI Sub-chart with Persistent 70 / 50 / 30 Benchmark Reference Lines
    let currentRSI = null;
    const rsiLen = indicatorParams.rsiPeriod || 14;
    if (showRSI && rsiRef.current && activeCandles.length >= rsiLen) {
      const rsiVals = calculateRSI(activeCandles, rsiLen);
      try {
        rsiRef.current.setData(rsiVals);
        if (rsiVals.length > 0) {
          currentRSI = rsiVals[rsiVals.length - 1].value;
          // Create persistent infinite price lines on RSI series if not created yet
          if (!rsiPriceLinesRef.current || rsiPriceLinesRef.current.length === 0) {
            const l70 = rsiRef.current.createPriceLine({
              price: 70, color: 'rgba(239, 83, 80, 0.45)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70 OB'
            });
            const l50 = rsiRef.current.createPriceLine({
              price: 50, color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false
            });
            const l30 = rsiRef.current.createPriceLine({
              price: 30, color: 'rgba(16, 185, 129, 0.45)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30 OS'
            });
            rsiPriceLinesRef.current = [l70, l50, l30];
          }
        }
      } catch {}
    } else {
      try {
        rsiRef.current?.setData([]);
        if (rsiPriceLinesRef.current && rsiPriceLinesRef.current.length > 0) {
          rsiPriceLinesRef.current.forEach(line => {
            try { rsiRef.current?.removePriceLine(line); } catch {}
          });
          rsiPriceLinesRef.current = [];
        }
      } catch {}
    }

    // 9. MACD Sub-chart (MACD Line, Signal Line, and Positive/Negative Colored Histogram)
    let currentMACD = null;
    const mFast = indicatorParams.macdFast || 12;
    const mSlow = indicatorParams.macdSlow || 26;
    const mSig  = indicatorParams.macdSignal || 9;
    if (showMACD && macdRef.current && macdSignalRef.current && macdHistRef.current && activeCandles.length > mSlow) {
      const macdData = calculateMACD(activeCandles, mFast, mSlow, mSig);
      try {
        const histArr = macdData.hist || macdData.histogram || [];
        macdRef.current.setData(macdData.macd || []);
        macdSignalRef.current.setData(macdData.signal || []);
        macdHistRef.current.setData(histArr);
        if (histArr.length > 0) {
          const lastHist = histArr[histArr.length - 1];
          const lastMacd = (macdData.macd || [])[macdData.macd.length - 1];
          const lastSig  = (macdData.signal || [])[macdData.signal.length - 1];
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
            title: lvl.title || lvl.label,
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
    const smaCalculated = showSMA && activeCandles.length >= smaLen ? calculateSMA(activeCandles, smaLen) : [];
    const emaCalculated = showEMA && activeCandles.length >= emaLen ? calculateEMA(activeCandles, emaLen) : [];
    const bbCalculated  = showBB && activeCandles.length >= bbLen ? calculateBollingerBands(activeCandles, bbLen, bbMult) : null;

    setIndicatorValues({
      sma: smaCalculated.length > 0 ? smaCalculated[smaCalculated.length - 1].value : null,
      ema: emaCalculated.length > 0 ? emaCalculated[emaCalculated.length - 1].value : null,
      bb: bbCalculated && bbCalculated.upper.length > 0 ? {
        upper: bbCalculated.upper[bbCalculated.upper.length - 1].value,
        middle: bbCalculated.middle ? bbCalculated.middle[bbCalculated.middle.length - 1]?.value : null,
        lower: bbCalculated.lower[bbCalculated.lower.length - 1].value,
      } : null,
      rsi: currentRSI,
      macd: currentMACD,
      alma: currentALMA,
      vwap: currentVWAP,
      supertrend: currentSupertrend,
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

  }, [rawHistory, prediction, interval, showVolume, showSMA, showEMA, showBB, showRSI, showMACD, showALMA, showVWAP, showSupertrend, showKeyLevels, showPatterns, indicatorParams, isReplayMode, replayIndex, chartReady]);

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
      // Fit zoom only when the dataset head actually changed (symbol/interval/first rows) —
      // NOT on every live tick merge, which would yank the user's zoom/pan position around.
      const lastCandle = candles2[candles2.length - 1];
      const headSig = `${candles2.length}:${lastCandle ? lastCandle.time : ''}`;
      if (compareChartHeadRef.current !== headSig) {
        compareChartHeadRef.current = headSig;
        chartRef2.current?.timeScale().fitContent();
      }
    } catch {}
  }, [isSplitView, rawHistoryCompare, interval]);

  /* ── Comparison Chart Real-time Candle Updates (split view) ── */

  useEffect(() => {
    if (!isSplitView || !compareLive || !rawHistoryCompare?.length || !candleRef2.current) return;
    const numLivePrice = Number(compareLive.price);
    if (isNaN(numLivePrice) || numLivePrice <= 0) return;

    const last = rawHistoryCompare[rawHistoryCompare.length - 1];
    if (!last || last.close == null) return;
    const lastClose = parseNum(last.close);

    // Same out-of-range guard as the main chart (>20% deviation from reference price)
    if (lastClose > 0 && Math.abs(numLivePrice - lastClose) / lastClose > 0.20) return;

    const tickIsLive = compareLive.is_live === true;
    const sessionOpen = Number(compareLive.open);
    const sessionHigh = Number(compareLive.high);
    const sessionLow  = Number(compareLive.low);

    // IST wall clock (UTC + 5:30), same conventions as the primary chart
    const istDate = new Date(Date.now() + 5.5 * 3600 * 1000);
    const istDay = istDate.getUTCDay();
    const istHour = istDate.getUTCHours();
    const istMin = istDate.getUTCMinutes();
    const isMarketHours = istDay >= 1 && istDay <= 5 &&
      ((istHour > 9 || (istHour === 9 && istMin >= 15)) && (istHour < 15 || (istHour === 15 && istMin <= 30)));
    const todayStr = istDate.toISOString().substring(0, 10);

    const lowsFrom = (vals) => { const v = vals.filter(x => x > 0); return v.length ? Math.min(...v) : numLivePrice; };
    let nextRow = null;
    let append = false;

    if (isDaily) {
      const lastDateStr = String(last.date).substring(0, 10);
      const isTodayHistorical = todayStr === lastDateStr;
      // Mirror the primary chart: cached/fallback ticks never fabricate a new "today" bar
      if (!isTodayHistorical && !(isMarketHours && tickIsLive)) return;

      if (isTodayHistorical) {
        nextRow = {
          ...last,
          high: Math.max(Number(last.high) || 0, sessionHigh, numLivePrice),
          low : lowsFrom([Number(last.low), sessionLow, numLivePrice]),
          close: numLivePrice,
        };
      } else {
        // Brand-new session bar — open anchored by the server session open, else the tick price
        const open = sessionOpen > 0 ? sessionOpen : numLivePrice;
        nextRow = {
          date: todayStr,
          open,
          high: Math.max(sessionHigh, open, numLivePrice),
          low : lowsFrom([sessionLow, open, numLivePrice]),
          close: numLivePrice,
          volume: 0,
        };
        append = true;
      }
    } else {
      // Intraday: session-anchored buckets identical to the primary chart's live logic
      const bucketSize = ({ '1m': 60, '5m': 300, '15m': 900, '1h': 3600 })[interval] || 300;
      const currentBucket = getSessionBucketStart(interval, Date.now());
      const lastBarSec = toChartTime(last.date, true) || currentBucket;

      // Skip disconnected off-market ticks several buckets after the session's last bar
      if (!isMarketHours && currentBucket > lastBarSec + bucketSize * 2) return;

      if (currentBucket >= lastBarSec) {
        if (currentBucket === lastBarSec) {
          nextRow = {
            ...last,
            high: Math.max(Number(last.high) || 0, numLivePrice),
            low : lowsFrom([Number(last.low), numLivePrice]),
            close: numLivePrice,
          };
        } else {
          // New bucket bar — only a CONFIRMED LIVE tick may open it (cached ticks after the
          // close would otherwise mint ghost hourly bars at session end)
          if (!tickIsLive) return;
          // New bucket bar (same IST-labeled format the backend rows use)
          const barDate = new Date((currentBucket + 5.5 * 3600) * 1000).toISOString().substring(0, 19).replace('T', ' ');
          nextRow = {
            date: barDate,
            open: numLivePrice, high: numLivePrice, low: numLivePrice, close: numLivePrice,
            volume: 0,
          };
          append = true;
        }
      } else {
        // History head is slightly ahead of the clock — merge into the last row anyway
        nextRow = {
          ...last,
          high: Math.max(Number(last.high) || 0, numLivePrice),
          low : lowsFrom([Number(last.low), numLivePrice]),
          close: numLivePrice,
        };
      }
    }

    if (!nextRow) return;
    // Loop protection: skip when this tick produced no net change (the state update below
    // re-runs this effect without a new tick; identical values must not re-trigger setState)
    if (!append && String(nextRow.date) === String(last.date) &&
        Number(nextRow.open) === Number(last.open) &&
        Number(nextRow.high) === Number(last.high) &&
        Number(nextRow.low) === Number(last.low) &&
        Number(nextRow.close) === Number(last.close)) return;

    setRawHistoryCompare(append
      ? [...rawHistoryCompare, nextRow]
      : [...rawHistoryCompare.slice(0, -1), nextRow]);
  }, [isSplitView, compareSymbol, interval, isDaily, rawHistoryCompare, compareLive]);

  /* ── Real-time Price Update ───────────────────────────────── */

  useEffect(() => {
    if (!candleRef.current || !rawHistory || !Array.isArray(rawHistory) || !rawHistory.length || livePrice == null) return;
    const numLivePrice = Number(livePrice);
    if (isNaN(numLivePrice) || numLivePrice <= 0) return;

    const last = rawHistory[rawHistory.length - 1];
    if (!last || last.close == null) return;
    const lastClose = parseNum(last.close);

    // Sanity check: ignore out-of-range live ticks (> 20% deviation from recent reference)
    const refPrice = activeCandleRef.current?.close || lastClose;
    if (refPrice > 0 && Math.abs(numLivePrice - refPrice) / refPrice > 0.20) {
      console.warn(`⚠️ [LiveTick] Dropping anomalous live price tick ${numLivePrice} for ${selectedSymbol} (ref: ${refPrice})`);
      return;
    }

    try {
      // Calculate current IST date & time strictly (UTC + 5:30)
      const nowUtc = Date.now();
      const istOffsetMs = 5.5 * 3600 * 1000;
      const istDate = new Date(nowUtc + istOffsetMs);
      const istDay = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const istHour = istDate.getUTCHours();
      const istMin = istDate.getUTCMinutes();
      const isMarketHours = istDay >= 1 && istDay <= 5 && 
        ((istHour > 9 || (istHour === 9 && istMin >= 15)) && (istHour < 15 || (istHour === 15 && istMin <= 30)));
      const todayStr = istDate.toISOString().substring(0, 10);
      const lastDateStr = String(last.date).substring(0, 10);

      const serverOpen = sessionOHLCRef.current?.open;
      const serverHigh = sessionOHLCRef.current?.high;
      const serverLow  = sessionOHLCRef.current?.low;

      if (isDaily) {
        // SAFEGUARD: A brand-new "today" bar may only be opened by a CONFIRMED LIVE tick
        // (is_live: true from server) arriving during market hours. Cached/fallback ticks —
        // broker session down, market closed, trading holiday, pre-open auction — must never
        // fabricate a bar for a session that has no real data. If today's bar is already in
        // history (isTodayHistorical), any tick may still update that existing real bar.
        const isTodayHistorical = (todayStr === lastDateStr);
        const shouldHaveTodayBar = isTodayHistorical || (isMarketHours && lastTickLiveRef.current === true);

        if (!shouldHaveTodayBar) {
          // Off-market/weekend fallback: update price line but do NOT append fake date bars
          if (activeCandleRef.current && activeCandleRef.current.time === lastDateStr) {
            activeCandleRef.current = {
              ...activeCandleRef.current,
              close: numLivePrice,
            };
            try { candleRef.current.update(activeCandleRef.current); } catch {}
          }
          return;
        }

        const targetTime = isTodayHistorical ? lastDateStr : todayStr;
        const isNewBar = !activeCandleRef.current || activeCandleRef.current.time !== targetTime;

        const histMatch = isTodayHistorical ? last : null;
        if (isNewBar) {
          // Open is anchored by: authoritative historical bar open > server session open > current live price
          const initialOpen = (histMatch && Number(histMatch.open) > 0)
            ? Number(histMatch.open)
            : (serverOpen && serverOpen > 0 ? serverOpen : numLivePrice);

          const initialHigh = Math.max(
            histMatch && Number(histMatch.high) > 0 ? Number(histMatch.high) : 0,
            serverHigh && serverHigh > 0 ? serverHigh : 0,
            initialOpen,
            numLivePrice
          );

          const candidateLows = [
            histMatch && Number(histMatch.low) > 0 ? Number(histMatch.low) : null,
            serverLow && serverLow > 0 ? serverLow : null,
            initialOpen,
            numLivePrice
          ].filter(v => v != null && v > 0);
          const initialLow = candidateLows.length > 0 ? Math.min(...candidateLows) : numLivePrice;

          activeCandleRef.current = {
            time  : targetTime,
            open  : initialOpen,
            high  : Math.max(initialHigh, initialOpen, numLivePrice),
            low   : Math.min(initialLow, initialOpen, numLivePrice),
            close : numLivePrice,
          };
        } else {
          // Existing bar: Open is permanent! Never overwrite it with fluctuating live ticks
          const currentOpen = activeCandleRef.current.open || (histMatch && Number(histMatch.open) > 0 ? Number(histMatch.open) : numLivePrice);
          const currentHigh = Math.max(
            activeCandleRef.current.high,
            histMatch && Number(histMatch.high) > 0 ? Number(histMatch.high) : 0,
            serverHigh && serverHigh > 0 ? serverHigh : 0,
            numLivePrice
          );
          const candidateLows = [
            activeCandleRef.current.low,
            histMatch && Number(histMatch.low) > 0 ? Number(histMatch.low) : null,
            serverLow && serverLow > 0 ? serverLow : null,
            numLivePrice
          ].filter(v => v != null && v > 0);
          const currentLow = candidateLows.length > 0 ? Math.min(...candidateLows) : numLivePrice;

          activeCandleRef.current = {
            time  : targetTime,
            open  : currentOpen,
            high  : Math.max(currentHigh, currentOpen, numLivePrice),
            low   : Math.min(currentLow, currentOpen, numLivePrice),
            close : numLivePrice,
          };
        }
      } else {
        // Intraday bucketing anchored to the NSE session grid (bars start 09:15 IST daily)
        // — naive epoch-hour floors put 1h boundaries at IST :30, but history bars are labeled
        // 09:15/10:15/…, which spawned duplicate ghost bars at session end.
        const bucketSize = ({ '1m': 60, '5m': 300, '15m': 900, '1h': 3600 })[interval] || 300;
        const currentBucket = getSessionBucketStart(interval, Date.now());
        const lastBarSec = toChartTime(last.date, true) || currentBucket;

        // Skip appending disconnected off-market intraday bars hours after close
        if (!isMarketHours && currentBucket > lastBarSec + bucketSize * 2) {
          return;
        }

        // A brand-new bucket bar may only be opened by a CONFIRMED LIVE tick — cached ticks
        // after the close must not keep minting ghost bars (mirrors the daily live guard).
        if (currentBucket > lastBarSec && !lastTickLiveRef.current) {
          return;
        }

        const targetSec = currentBucket >= lastBarSec ? currentBucket : lastBarSec;
        const isNewBar = !activeCandleRef.current || activeCandleRef.current.time !== targetSec;

        if (isNewBar) {
          const isLastMatch = targetSec === lastBarSec;
          const initialOpen = isLastMatch && Number(last.open) > 0 ? Number(last.open) : numLivePrice;
          const initialHigh = isLastMatch && Number(last.high) > 0 ? Math.max(Number(last.high), initialOpen, numLivePrice) : numLivePrice;
          const initialLow  = isLastMatch && Number(last.low) > 0 ? Math.min(Number(last.low), initialOpen, numLivePrice) : numLivePrice;
          activeCandleRef.current = {
            time  : targetSec,
            open  : initialOpen,
            high  : Math.max(initialHigh, initialOpen, numLivePrice),
            low   : Math.min(initialLow, initialOpen, numLivePrice),
            close : numLivePrice,
          };
        } else {
          const currentOpen = activeCandleRef.current.open || numLivePrice;
          activeCandleRef.current = {
            ...activeCandleRef.current,
            open  : currentOpen,
            high  : Math.max(activeCandleRef.current.high, currentOpen, numLivePrice),
            low   : Math.min(activeCandleRef.current.low, currentOpen, numLivePrice),
            close : numLivePrice,
          };
        }
      }

      if (
        activeCandleRef.current &&
        activeCandleRef.current.time != null &&
        typeof activeCandleRef.current.open === 'number' && !isNaN(activeCandleRef.current.open) && activeCandleRef.current.open > 0 &&
        typeof activeCandleRef.current.high === 'number' && !isNaN(activeCandleRef.current.high) && activeCandleRef.current.high > 0 &&
        typeof activeCandleRef.current.low === 'number' && !isNaN(activeCandleRef.current.low) && activeCandleRef.current.low > 0 &&
        typeof activeCandleRef.current.close === 'number' && !isNaN(activeCandleRef.current.close) && activeCandleRef.current.close > 0
      ) {
        // Enforce strict OHLC consistency invariant required by lightweight-charts
        activeCandleRef.current.high = Math.max(activeCandleRef.current.high, activeCandleRef.current.open, activeCandleRef.current.close);
        activeCandleRef.current.low = Math.min(activeCandleRef.current.low, activeCandleRef.current.open, activeCandleRef.current.close);

        try { candleRef.current.update(activeCandleRef.current); } catch {}

        // Real-time dynamic indicator line updates with incoming live tick
        const sP = indicatorParams.smaPeriod || 20;
        const eP = indicatorParams.emaPeriod || 20;
        const bbP = indicatorParams.bbPeriod || 20;
        const bbM = indicatorParams.bbStdDev || 2;

        if (rawHistory && rawHistory.length >= 10) {
          const liveT = activeCandleRef.current.time;
          const liveC = Number(activeCandleRef.current.close);

          // Real-time SMA update
          if (showSMA && smaRef.current && rawHistory.length >= sP) {
            const sliceSma = rawHistory.slice(-(sP - 1));
            const sumSma = sliceSma.reduce((acc, b) => acc + Number(b.close || 0), 0) + liveC;
            try { smaRef.current.update({ time: liveT, value: Number((sumSma / sP).toFixed(2)) }); } catch {}
          }

          // Real-time EMA update
          if (showEMA && emaRef.current && rawHistory.length >= eP) {
            const k = 2 / (eP + 1);
            const prevSlice = rawHistory.slice(0, -1);
            if (prevSlice.length >= eP) {
              const prevEmas = calculateEMA(prevSlice, eP);
              if (prevEmas.length > 0) {
                const lastEmaVal = prevEmas[prevEmas.length - 1].value;
                const liveEma = Number((liveC * k + lastEmaVal * (1 - k)).toFixed(2));
                try { emaRef.current.update({ time: liveT, value: liveEma }); } catch {}
              }
            }
          }

          // Real-time Bollinger Bands update
          if (showBB && bbUpperRef.current && bbLowerRef.current && bbMiddleRef.current && rawHistory.length >= bbP) {
            const sliceBb = rawHistory.slice(-(bbP - 1));
            const closes = sliceBb.map(b => Number(b.close || 0)).concat([liveC]);
            const mean = closes.reduce((a, b) => a + b, 0) / bbP;
            const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / bbP;
            const stdDev = Math.sqrt(variance);
            try {
              bbUpperRef.current.update({ time: liveT, value: Number((mean + stdDev * bbM).toFixed(2)) });
              bbMiddleRef.current.update({ time: liveT, value: Number(mean.toFixed(2)) });
              bbLowerRef.current.update({ time: liveT, value: Number((mean - stdDev * bbM).toFixed(2)) });
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Error updating live candle:', err);
    }

    if (livePriceLineRef.current) {
      try { candleRef.current.removePriceLine(livePriceLineRef.current); } catch {}
      livePriceLineRef.current = null;
    }
    const displayPrice = numLivePrice;
    if (typeof displayPrice === 'number' && !isNaN(displayPrice) && displayPrice > 0) {
      try {
        livePriceLineRef.current = candleRef.current.createPriceLine({
          price               : displayPrice,
          color               : (liveChange ?? 0) >= 0 ? '#26A69A' : '#EF5350',
          lineWidth           : 1,
          lineStyle           : LineStyle.Dashed,
          axisLabelVisible    : true,
          axisLabelColor      : (liveChange ?? 0) >= 0 ? '#26A69A' : '#EF5350',
          axisLabelTextColor  : '#fff',
          title               : wsLiveData ? 'LIVE' : 'CLOSE',
        });
      } catch {}
    }
  }, [livePrice, interval, isDaily, selectedSymbol, showSMA, showEMA, showBB, indicatorParams, rawHistory]);

  /* ── 4. Bar Replay Auto-Play Loop ────────────────────────── */
  useEffect(() => {
    if (!isReplayMode || !isReplayPlaying || !rawHistory || rawHistory.length < 5) return;

    const baseDelay = 500; // 500ms at 1x
    const delay = Math.max(50, Math.round(baseDelay / replaySpeed));

    const intervalId = setInterval(() => {
      setReplayIndex(prev => {
        const total = rawHistory.length;
        const current = (typeof prev === 'number' && prev > 0) ? prev : Math.max(5, total - 60);
        if (current >= total) {
          setIsReplayPlaying(false);
          toast.success('🎉 Replay completed to the latest candle!');
          return total;
        }
        return current + 1;
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

  const handleSelectSymbol = useCallback((ticker) => {
    if (!ticker) return;
    const clean = ticker.toUpperCase().trim();
    activeCandleRef.current = null;
    sessionOHLCRef.current = null;
    lastTickLiveRef.current = false;
    setSelectedSymbol(clean);
    setShowSymbolModal(false);
    setSymbolModalFilter('');
    setTimeout(() => {
      if (chartRef.current && !isReplayMode) {
        chartRef.current.timeScale().fitContent();
      }
    }, 120);
  }, [setSelectedSymbol, isReplayMode]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const res = await searchStock(searchQuery.trim());
    setIsSearching(false);
    if (res?.ticker) {
      handleSelectSymbol(res.ticker);
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

  const lastCandleClose = Array.isArray(rawHistory) && rawHistory.length ? parseNum(rawHistory[rawHistory.length - 1]?.close) : null;
  const curPrice  = (wsLiveData && livePrice != null ? livePrice : null) ?? (lastCandleClose != null ? lastCandleClose : livePrice) ?? prediction?.current_price;
  const changeUp  = (liveChange ?? 0) >= 0;
  const sig       = prediction?.signal;
  const sigMeta   = SIG[sig] ?? SIG.hold;
  const score     = prediction?.ai_confidence_score ?? 0;
  const scoreColor = score >= 70 ? '#26A69A' : score >= 50 ? '#F59E0B' : '#EF5350';

  /* ── Comparison chart (split view) live header values ─────── */
  const compareLastRow  = Array.isArray(rawHistoryCompare) && rawHistoryCompare.length ? rawHistoryCompare[rawHistoryCompare.length - 1] : null;
  const comparePrevRow  = Array.isArray(rawHistoryCompare) && rawHistoryCompare.length > 1 ? rawHistoryCompare[rawHistoryCompare.length - 2] : null;
  const compareHistClose = compareLastRow ? parseNum(compareLastRow.close) : null;
  const compareHistPrev  = comparePrevRow ? parseNum(comparePrevRow.close) : null;
  const compareTickPrice = compareLive ? Number(compareLive.price) : NaN;
  const compareHasTick   = !isNaN(compareTickPrice) && compareTickPrice > 0;
  const compareIsLiveTick = compareHasTick && compareLive?.is_live === true;
  // Show the live tick only when the server confirms it is live — never present a cached /
  // stale price as the current price (mirrors the main chart header behaviour).
  const compareDisplayPrice = compareIsLiveTick
    ? compareTickPrice
    : (compareHistClose ?? (compareHasTick ? compareTickPrice : null));
  const compareChangePct = compareIsLiveTick && compareLive?.change_pct != null
    ? Number(compareLive.change_pct)
    : (compareDisplayPrice != null && compareHistPrev != null && compareHistPrev > 0
        ? ((compareDisplayPrice - compareHistPrev) / compareHistPrev) * 100
        : null);
  const compareChangeUp = (compareChangePct ?? 0) >= 0;

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
      <ChartToolbar
        selectedSymbol={selectedSymbol}
        handleSelectSymbol={handleSelectSymbol}
        showSymbolModal={showSymbolModal}
        setShowSymbolModal={setShowSymbolModal}
        symbolModalFilter={symbolModalFilter}
        setSymbolModalFilter={setSymbolModalFilter}
        searchResults={searchResults}
        isSearching={isSearching}
        chartEngine={chartEngine}
        setChartEngine={setChartEngine}
        interval={interval}
        handleIntervalChange={handleIntervalChange}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        isReplayMode={isReplayMode}
        setIsReplayMode={setIsReplayMode}
        isReplayPlaying={isReplayPlaying}
        setIsReplayPlaying={setIsReplayPlaying}
        setReplayIndex={setReplayIndex}
        rawHistory={rawHistory}
        setShowAlertModal={setShowAlertModal}
        priceAlerts={priceAlerts}
        isLogScale={isLogScale}
        toggleLogScale={toggleLogScale}
        showIndicatorsModal={showIndicatorsModal}
        setShowIndicatorsModal={setShowIndicatorsModal}
        activeIndicatorsCount={Object.values(activeIndicatorsMap).filter(Boolean).length}
        showIndicatorSettingsModal={showIndicatorSettingsModal}
        setShowIndicatorSettingsModal={setShowIndicatorSettingsModal}
        showKeyLevels={showKeyLevels}
        setShowKeyLevels={setShowKeyLevels}
        chartLayout={chartLayout}
        setChartLayout={setChartLayout}
        handleSnapshot={handleSnapshot}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
      />

      {/* ── Floating Bar Replay Auto-Play Control Bar ── */}
      <BarReplayControl
        isReplayMode={isReplayMode}
        setIsReplayMode={setIsReplayMode}
        isReplayPlaying={isReplayPlaying}
        setIsReplayPlaying={setIsReplayPlaying}
        replayIndex={replayIndex}
        setReplayIndex={setReplayIndex}
        replaySpeed={replaySpeed}
        setReplaySpeed={setReplaySpeed}
        rawHistory={rawHistory}
      />

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
                <ChartLegendHUD
                  hudRef={hudRef}
                  showSMA={showSMA}
                  showEMA={showEMA}
                  showBB={showBB}
                  showVWAP={showVWAP}
                  showSupertrend={showSupertrend}
                  showALMA={showALMA}
                  showRSI={showRSI}
                  showMACD={showMACD}
                  indicatorValues={indicatorValues}
                  indicatorParams={indicatorParams}
                />

                {/* ── Feed Overlays & Live Status Badges ── */}
                <ChartFeedStatus
                  loading={loading}
                  selectedSymbol={selectedSymbol}
                  rawHistory={rawHistory}
                  historyFetchError={historyFetchError}
                  setHistoryFetchError={setHistoryFetchError}
                  setLoading={setLoading}
                  fetchHistory={fetchHistory}
                  setRawHistory={setRawHistory}
                  interval={interval}
                  timeframe={timeframe}
                  historyReqSeqRef={historyReqSeqRef}
                  wsConnected={wsConnected}
                  wsIsLive={wsIsLive}
                />

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
                    {advancedPanelTab === 'patterns' && (
                      <AIPatternRecognition 
                        symbol={selectedSymbol}
                        candles={rawHistory || []}
                        onApplyMarkers={(markers) => {
                          try {
                            if (candleRef.current && markers && markers.length > 0) {
                              candleRef.current.setMarkers(markers);
                            }
                          } catch {}
                        }}
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
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:'0.75rem', color:'#60A5FA', fontWeight:700, minWidth:0 }}>
                    <span style={{ whiteSpace:'nowrap' }}>COMPARISON CHART:</span>
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

                  {/* Live price / change / feed status for the comparison symbol */}
                  <div style={{ display:'flex', gap:10, alignItems:'center', fontFamily:'JetBrains Mono, monospace', fontSize:'0.74rem', whiteSpace:'nowrap' }}>
                    <span style={{ color: compareChangeUp ? '#10B981' : '#EF5350', fontWeight:800 }}>
                      {compareDisplayPrice != null && !isNaN(compareDisplayPrice) ? `₹${compareDisplayPrice.toFixed(2)}` : '—'}
                    </span>
                    <span style={{ color: compareChangeUp ? '#10B981' : '#EF5350', fontWeight:700 }}>
                      {compareChangePct != null && !isNaN(compareChangePct) ? `${compareChangeUp ? '+' : ''}${compareChangePct.toFixed(2)}%` : ''}
                    </span>
                    {(() => {
                      let label = '…', dot = '#64748B', bgc = 'transparent', brd = 'transparent', glow = false, tip = 'Waiting for the first price tick for this symbol';
                      if (compareLive) {
                        if (compareIsLiveTick) {
                          label = 'LIVE'; dot = '#10B981'; bgc = 'rgba(16,185,129,0.12)'; brd = 'rgba(16,185,129,0.3)'; glow = true;
                          tip = 'Live NSE price feed — candles updating in real-time';
                        } else {
                          label = 'CACHED'; dot = '#F59E0B'; bgc = 'rgba(245,158,11,0.12)'; brd = 'rgba(245,158,11,0.3)';
                          tip = 'Feed unavailable or market closed — showing last close / cached price';
                        }
                      }
                      return (
                        <span
                          title={tip}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 7px', borderRadius:4, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.04em', background:bgc, border:`1px solid ${brd}`, color:dot, cursor:'help', userSelect:'none' }}
                        >
                          <span style={{
                            width:6, height:6, borderRadius:'50%', background:dot, flexShrink:0,
                            boxShadow: glow ? `0 0 6px ${dot}` : 'none',
                            animation: glow ? 'livePulse 1.5s ease-in-out infinite' : 'none',
                          }} />
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div ref={containerRef2} style={{ width:'100%', height:520 }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Interactive Canvas Price Alert & Sound Chime Manager Modal ── */}
      <PriceAlertModal
        showAlertModal={showAlertModal}
        setShowAlertModal={setShowAlertModal}
        selectedSymbol={selectedSymbol}
        curPrice={curPrice}
        targetAlertPrice={targetAlertPrice}
        setTargetAlertPrice={setTargetAlertPrice}
        priceAlerts={priceAlerts}
        setPriceAlerts={setPriceAlerts}
      />

      {/* ── Compact Space-Saving Bottom Status Bar with Expandable Insights ── */}
      <ChartBottomStats
        isDaily={isDaily}
        wsLiveData={wsLiveData}
        curPrice={curPrice}
        prediction={prediction}
        predLoading={predLoading}
        activeCandleRef={activeCandleRef}
        showBottomStats={showBottomStats}
        setShowBottomStats={setShowBottomStats}
      />

      {/* ── TradingView Indicators, Metrics, and Strategies Modal ── */}
      <IndicatorsModal
        isOpen={showIndicatorsModal}
        onClose={() => setShowIndicatorsModal(false)}
        activeIndicators={activeIndicatorsMap}
        onToggleIndicator={handleToggleIndicator}
      />

      {/* ── Indicator Custom Inputs & Parameters Settings Modal ── */}
      <IndicatorSettingsModal
        isOpen={showIndicatorSettingsModal}
        onClose={() => setShowIndicatorSettingsModal(false)}
        params={indicatorParams}
        onUpdateParams={handleUpdateParams}
        onResetDefaults={handleResetDefaults}
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
