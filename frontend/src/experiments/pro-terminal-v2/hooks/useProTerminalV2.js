// Pro Terminal V2 — Main Hook
// Manages all state for the experimental terminal module.
// Self-contained — no imports from existing project code.

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { generateCandles, generateEMA, generateRSI, generateMACD, generateVolume, generateAITrend } from '../data/mockCandles';
import { mockFundamentals, deriveFallbackFundamentals } from '../data/mockFundamentals';
import { mockAIAnalysis, synthesizeAIAnalysis, mockMarketIndices, mockSectors } from '../data/mockAI';
import { mockNews } from '../data/mockNews';
import { mockScreenerResults, applyScreenerFilters } from '../data/mockScreener';
import { V2_INDICATORS, V2_TEMPLATES, getDrawingToolLabel } from '../utils/constants';

const SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'WIPRO', 'HCLTECH'];
// Searchable universe = toolbar symbols + every screener stock (rows are clickable)
const ALL_SYMBOLS = [...new Set([...SYMBOLS, ...mockScreenerResults.map((r) => r.symbol)])];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+05:30 — NSE/IST trading day
const DRAWINGS_KEY = 'stockoracle_pro_v2_drawings';
const WATCHLIST_KEY = 'stockoracle_pro_v2_watchlist';
const FILTERS_KEY = 'stockoracle_pro_v2_screener_filters';

function loadPersistedDrawings() {
  try {
    const raw = localStorage.getItem(DRAWINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* corrupted storage — fall back to empty */ }
  return [];
}

function loadPersistedWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch { /* ignore */ }
  return new Set();
}

function loadPersistedFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

export function useProTerminalV2() {
  // Symbol & timeframe (internal name avoids shadowing global setInterval)
  const [symbol, setSymbol] = useState('RELIANCE');
  const [timeframe, setTimeframe] = useState('5m');
  const [chartType, setChartType] = useState('candlestick');
  const [exchange, setExchange] = useState('NSE');

  // Candles
  const [candles, setCandles] = useState(() => generateCandles('RELIANCE', 200, '5m'));

  // Indicators — ai_trend lives in BOTH lists and stays synced (see toggles)
  const [activeIndicators, setActiveIndicators] = useState(() =>
    V2_INDICATORS.filter((i) => i.defaultVisible).map((i) => i.id)
  );
  const [activeAiIndicators, setActiveAiIndicators] = useState(() => ['ai_sr']);

  // Drawing tools & drawings (persisted + undo/redo)
  const [activeDrawingTool, setActiveDrawingTool] = useState('cursor');
  const [drawings, setDrawings] = useState(loadPersistedDrawings);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [allDrawingsHidden, setAllDrawingsHidden] = useState(false);
  const [orderModalSide, setOrderModalSide] = useState(null); // null | 'BUY' | 'SELL'

  // drawingsRef mirrors drawings so event handlers can read the CURRENT value
  // without stale closures (synced after every state change). Undo/redo history
  // is plain STATE — not refs — so canUndo/canRedo are reactive by construction.
  const drawingsRef = useRef(drawings);
  const idSeqRef = useRef(0);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  // UI overlay state (single source of truth — keyboard shortcuts live here)
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDrawingMenu, setShowDrawingMenu] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bottomTab, setBottomTab] = useState('screener');
  const [rightPanelTab, setRightPanelTab] = useState('overview');
  const [objectTreeTab, setObjectTreeTab] = useState('objects');

  // Top-nav controlled search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pane sizes
  const [volumeHeight, setVolumeHeight] = useState(100);
  const [rsiHeight, setRsiHeight] = useState(80);
  const [macdHeight, setMacdHeight] = useState(80);
  const [aiTrendHeight, setAiTrendHeight] = useState(80);

  // Screener — chips are a draft; Scan applies them (chip removal applies live
  // because that only ever WIDENS the result set). Saved filter sets persist.
  const [screenerFilters, setScreenerFilters] = useState(loadPersistedFilters);
  const [screenerResults, setScreenerResults] = useState(() =>
    applyScreenerFilters(mockScreenerResults, loadPersistedFilters())
  );
  const [scanning, setScanning] = useState(false);
  const filtersRef = useRef(screenerFilters); // mirrors persisted draft filters
  const scanTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(scanTimerRef.current), []);

  // Watchlist (persisted) & paper orders
  const [watchlist, setWatchlist] = useState(loadPersistedWatchlist);
  const [orders, setOrders] = useState([]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const currentPrice = candles[candles.length - 1]?.close || 0;

  // Day change = last close vs the close of the previous trading DAY (matches
  // the main app's header semantics) instead of bar-vs-bar noise. Day grouping
  // uses the IST calendar date — never the UTC date — so the reference bar is
  // always the previous NSE session.
  const referenceClose = useMemo(() => {
    if (!candles.length) return 0;
    const dayOf = (c) =>
      new Date(c.time * 1000 + IST_OFFSET_MS).toISOString().slice(0, 10);
    const lastDay = dayOf(candles[candles.length - 1]);
    for (let i = candles.length - 2; i >= 0; i--) {
      if (dayOf(candles[i]) !== lastDay) return candles[i].close;
    }
    return candles[0].close;
  }, [candles]);
  const priceChange = currentPrice - referenceClose;
  const priceChangePct = referenceClose > 0 ? (priceChange / referenceClose) * 100 : 0;

  const lastCandle = candles[candles.length - 1] || {};

  const fundamentals = useMemo(() => {
    if (mockFundamentals[symbol]) return mockFundamentals[symbol];
    const row = mockScreenerResults.find((r) => r.symbol === symbol);
    return deriveFallbackFundamentals(symbol, row);
  }, [symbol]);

  const aiAnalysis = useMemo(() => {
    if (mockAIAnalysis[symbol]) return mockAIAnalysis[symbol];
    return synthesizeAIAnalysis(candles, priceChangePct);
  }, [symbol, candles, priceChangePct]);

  const news = mockNews;

  // Indicator data
  const ema20 = useMemo(() => generateEMA(candles, 20), [candles]);
  const ema50 = useMemo(() => generateEMA(candles, 50), [candles]);
  const ema200 = useMemo(() => generateEMA(candles, 200), [candles]);
  const rsiData = useMemo(() => generateRSI(candles, 14), [candles]);
  const macdData = useMemo(() => generateMACD(candles), [candles]);
  const volumeData = useMemo(() => generateVolume(candles), [candles]);
  const aiTrendData = useMemo(() => generateAITrend(candles), [candles]);

  // Technical snapshot for the right panel / technicals tab
  const technical = useMemo(() => {
    if (!candles.length) return null;
    const last = candles[candles.length - 1];
    const rsiValue = rsiData[rsiData.length - 1]?.value ?? null;
    const macdValue = macdData.macdLine[macdData.macdLine.length - 1]?.value ?? null;
    const signalValue = macdData.signalLine[macdData.signalLine.length - 1]?.value ?? null;

    const stochSlice = candles.slice(-14);
    const hh = Math.max(...stochSlice.map((c) => c.high));
    const ll = Math.min(...stochSlice.map((c) => c.low));
    const stoch = hh > ll ? ((last.close - ll) / (hh - ll)) * 100 : 50;

    const trSlice = candles.slice(-15);
    let trSum = 0;
    for (let i = 1; i < trSlice.length; i++) {
      const c = trSlice[i];
      const pc = trSlice[i - 1].close;
      trSum += Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
    }
    const atr = trSlice.length > 1 ? trSum / (trSlice.length - 1) : 0;

    const ema20Value = ema20[ema20.length - 1]?.value ?? null;
    return {
      rsi: rsiValue,
      rsiSignal: rsiValue == null ? '—' : rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral',
      macd: macdValue,
      signal: signalValue,
      macdSignal: macdValue == null || signalValue == null ? '—' : macdValue > signalValue ? 'Bullish' : 'Bearish',
      stoch,
      stochSignal: stoch > 80 ? 'Overbought' : stoch < 20 ? 'Oversold' : 'Neutral',
      atr,
      ema20: ema20Value,
      ema50: ema50[ema50.length - 1]?.value ?? null,
      ema200: ema200[ema200.length - 1]?.value ?? null,
      emaSignal: ema20Value == null ? '—' : last.close >= ema20Value ? 'Above EMA20' : 'Below EMA20',
    };
  }, [candles, rsiData, macdData, ema20, ema50, ema200]);

  // ── Symbol / interval / type actions ─────────────────────────────────────
  const handleSymbolChange = useCallback((newSymbol) => {
    setSymbol(newSymbol);
    setCandles(generateCandles(newSymbol, 200, timeframe));
  }, [timeframe]);

  const handleIntervalChange = useCallback((newInterval) => {
    setTimeframe(newInterval);
    setCandles(generateCandles(symbol, 200, newInterval));
  }, [symbol]);

  const handleChartTypeChange = useCallback((type) => {
    setChartType(type);
  }, []);

  // ── Indicators (ai_trend kept in sync across both lists) ─────────────────
  const toggleIndicator = useCallback((id) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    if (id === 'ai_trend') {
      setActiveAiIndicators((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
  }, []);

  const toggleAiIndicator = useCallback((id) => {
    setActiveAiIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    if (id === 'ai_trend') {
      setActiveIndicators((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
  }, []);

  const applyTemplate = useCallback((name) => {
    const tpl = V2_TEMPLATES.find((t) => t.id === name);
    if (!tpl) return;
    setActiveIndicators([...tpl.indicators]);
    setActiveAiIndicators([...tpl.ai]);
  }, []);

  // ── Drawing tools ────────────────────────────────────────────────────────
  const handleDrawingToolChange = useCallback((toolId) => {
    setActiveDrawingTool(toolId);
  }, []);

  const commitDrawings = useCallback((next) => {
    // Snapshot BEFORE mutating the ref — updaters run after this handler.
    const snapshot = drawingsRef.current;
    setPast((p) => [...p, snapshot]);
    setFuture([]);
    drawingsRef.current = next;
    setDrawings(next);
  }, []);

  const addDrawing = useCallback((drawing) => {
    idSeqRef.current += 1;
    const id = `${Date.now()}-${idSeqRef.current}`;
    commitDrawings([
      ...drawingsRef.current,
      {
        ...drawing,
        id,
        name: drawing.name || getDrawingToolLabel(drawing.type),
        symbol,
        visible: true,
        locked: false,
      },
    ]);
  }, [commitDrawings, symbol]);

  const removeDrawing = useCallback((id) => {
    commitDrawings(drawingsRef.current.filter((d) => d.id !== id));
  }, [commitDrawings]);

  const clearDrawings = useCallback(() => {
    if (!drawingsRef.current.length) return;
    commitDrawings([]);
  }, [commitDrawings]);

  const undoDrawings = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    const current = drawingsRef.current; // snapshot before ref mutation
    setPast(past.slice(0, -1));
    setFuture((f) => [...f, current]);
    drawingsRef.current = prev;
    setDrawings(prev);
  }, [past]);

  const redoDrawings = useCallback(() => {
    if (!future.length) return;
    const next = future[future.length - 1];
    const current = drawingsRef.current; // snapshot before ref mutation
    setFuture(future.slice(0, -1));
    setPast((p) => [...p, current]);
    drawingsRef.current = next;
    setDrawings(next);
  }, [future]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Non-structural toggles are not part of undo history.
  const toggleDrawingVisibility = useCallback((id) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, visible: !d.visible } : d))
    );
  }, []);

  const toggleDrawingLock = useCallback((id) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, locked: !d.locked } : d))
    );
  }, []);

  const persistDrawings = useCallback(() => {
    try {
      localStorage.setItem(DRAWINGS_KEY, JSON.stringify(drawingsRef.current));
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleMagnet = useCallback(() => setMagnetEnabled((v) => !v), []);
  const toggleDrawingsLocked = useCallback(() => setDrawingsLocked((v) => !v), []);
  const toggleAllDrawingsHidden = useCallback(() => setAllDrawingsHidden((v) => !v), []);

  // ── Screener ─────────────────────────────────────────────────────────────
  const addScreenerFilter = useCallback((filter) => {
    idSeqRef.current += 1;
    const next = [...filtersRef.current, { ...filter, id: `${Date.now()}-${idSeqRef.current}` }];
    filtersRef.current = next;
    setScreenerFilters(next); // draft — applied on Scan
  }, []);

  const removeScreenerFilter = useCallback((id) => {
    const next = filtersRef.current.filter((f) => f.id !== id);
    filtersRef.current = next;
    setScreenerFilters(next);
    // Removing a filter only widens the universe — apply immediately.
    setScreenerResults(applyScreenerFilters(mockScreenerResults, next));
    clearTimeout(scanTimerRef.current);
    setScanning(false);
  }, []);

  const runScreenerScan = useCallback(() => {
    clearTimeout(scanTimerRef.current);
    setScanning(true);
    scanTimerRef.current = setTimeout(() => {
      setScreenerResults(applyScreenerFilters(mockScreenerResults, filtersRef.current));
      setScanning(false);
    }, 450);
  }, []);

  const saveScreenerFilters = useCallback(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filtersRef.current));
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Watchlist & paper orders ─────────────────────────────────────────────
  const toggleWatchlist = useCallback((sym) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const placeOrder = useCallback((order) => {
    idSeqRef.current += 1;
    setOrders((prev) => [
      {
        id: `${Date.now()}-${idSeqRef.current}`,
        time: Date.now(),
        symbol,
        status: 'FILLED',
        ...order,
      },
      ...prev,
    ].slice(0, 20));
    setOrderModalSide(null);
  }, [symbol]);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // ── Keyboard shortcuts (capture phase so the app-level Command Palette's
  //    bubble listener never sees Ctrl+K while this terminal is mounted) ─────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const key = (e.key || '').toLowerCase();

      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSearchOpen((s) => !s);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        persistDrawings();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !isInput) {
        e.preventDefault();
        if (e.shiftKey) redoDrawings();
        else undoDrawings();
        return;
      }
      if (e.altKey && key === 'i') {
        e.preventDefault();
        setShowIndicatorModal((s) => !s);
        return;
      }
      if (e.altKey && key === 'a') {
        e.preventDefault();
        setShowAIModal((s) => !s);
        return;
      }
      if (e.key === 'Escape') {
        setShowIndicatorModal(false);
        setShowAIModal(false);
        setShowSettings(false);
        setShowDrawingMenu(null);
        setSearchOpen(false);
        setOrderModalSide(null);
        setActiveDrawingTool('cursor');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [persistDrawings, undoDrawings, redoDrawings]);

  return {
    // Symbol & timeframe
    symbol,
    interval: timeframe,
    chartType,
    exchange,
    setExchange,
    symbols: ALL_SYMBOLS,
    handleSymbolChange,
    handleIntervalChange,
    handleChartTypeChange,

    // Candles
    candles,
    currentPrice,
    priceChange,
    priceChangePct,
    lastCandle,

    // Indicators
    activeIndicators,
    toggleIndicator,
    activeAiIndicators,
    toggleAiIndicator,
    applyTemplate,
    showIndicatorModal,
    setShowIndicatorModal,
    showAIModal,
    setShowAIModal,
    ema20,
    ema50,
    ema200,
    rsiData,
    macdData,
    volumeData,
    aiTrendData,
    technical,

    // Drawing
    activeDrawingTool,
    handleDrawingToolChange,
    drawings,
    addDrawing,
    removeDrawing,
    clearDrawings,
    undoDrawings,
    redoDrawings,
    canUndo,
    canRedo,
    toggleDrawingVisibility,
    toggleDrawingLock,
    persistDrawings,
    magnetEnabled,
    toggleMagnet,
    drawingsLocked,
    toggleDrawingsLocked,
    allDrawingsHidden,
    toggleAllDrawingsHidden,

    // UI
    showSettings,
    setShowSettings,
    showDrawingMenu,
    setShowDrawingMenu,
    isFullscreen,
    handleToggleFullscreen,
    bottomTab,
    setBottomTab,
    rightPanelTab,
    setRightPanelTab,
    objectTreeTab,
    setObjectTreeTab,

    // Search
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,

    // Pane sizes
    volumeHeight,
    setVolumeHeight,
    rsiHeight,
    setRsiHeight,
    macdHeight,
    setMacdHeight,
    aiTrendHeight,
    setAiTrendHeight,

    // Data
    fundamentals,
    aiAnalysis,
    news,
    marketIndices: mockMarketIndices,
    sectors: mockSectors,

    // Screener
    screenerFilters,
    addScreenerFilter,
    removeScreenerFilter,
    screenerResults,
    scanning,
    runScreenerScan,
    saveScreenerFilters,

    // Watchlist & orders
    watchlist,
    toggleWatchlist,
    orders,
    orderModalSide,
    setOrderModalSide,
    placeOrder,
  };
}
