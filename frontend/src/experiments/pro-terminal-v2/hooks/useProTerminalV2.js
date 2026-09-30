// Pro Terminal V2 — Main Hook
// Manages all state for the experimental terminal module.
// Self-contained — no imports from existing project code.

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { generateCandles, generateEMA, generateRSI, generateMACD, generateVolume, generateAITrend } from '../data/mockCandles';
import { mockFundamentals } from '../data/mockFundamentals';
import { mockAIAnalysis } from '../data/mockAI';
import { mockNews } from '../data/mockNews';
import { mockScreenerResults } from '../data/mockScreener';
import { mockMarketIndices, mockSectors } from '../data/mockAI';
import { V2_INDICATORS } from '../utils/constants';

const SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'WIPRO', 'HCLTECH'];

export function useProTerminalV2() {
  // Symbol & interval
  const [symbol, setSymbol] = useState('RELIANCE');
  const [interval, setInterval] = useState('5m');
  const [chartType, setChartType] = useState('candlestick');

  // Candles
  const [candles, setCandles] = useState(() => generateCandles('RELIANCE', 200, '5m'));

  // Indicators
  const [activeIndicators, setActiveIndicators] = useState(() =>
    V2_INDICATORS.filter((i) => i.defaultVisible).map((i) => i.id)
  );

  // Drawing tools
  const [activeDrawingTool, setActiveDrawingTool] = useState('cursor');
  const [drawings, setDrawings] = useState([]);

  // UI state
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bottomTab, setBottomTab] = useState('screener');
  const [rightPanelTab, setRightPanelTab] = useState('overview');
  const [objectTreeTab, setObjectTreeTab] = useState('objects');

  // Pane sizes
  const [volumeHeight, setVolumeHeight] = useState(100);
  const [rsiHeight, setRsiHeight] = useState(80);
  const [macdHeight, setMacdHeight] = useState(80);
  const [aiTrendHeight, setAiTrendHeight] = useState(80);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Screener
  const [screenerFilters, setScreenerFilters] = useState([]);
  const [screenerResults, setScreenerResults] = useState(mockScreenerResults);

  // Refs
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);
  const aiTrendContainerRef = useRef(null);

  // Derived data
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const previousPrice = candles[candles.length - 2]?.close || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePct = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;

  const lastCandle = candles[candles.length - 1] || {};
  const firstCandle = candles[0] || {};

  const fundamentals = mockFundamentals[symbol] || mockFundamentals.RELIANCE;
  const aiAnalysis = mockAIAnalysis[symbol] || mockAIAnalysis.RELIANCE;
  const news = mockNews;

  // Indicator data
  const ema20 = useMemo(() => generateEMA(candles, 20), [candles]);
  const ema50 = useMemo(() => generateEMA(candles, 50), [candles]);
  const ema200 = useMemo(() => generateEMA(candles, 200), [candles]);
  const rsiData = useMemo(() => generateRSI(candles, 14), [candles]);
  const macdData = useMemo(() => generateMACD(candles), [candles]);
  const volumeData = useMemo(() => generateVolume(candles), [candles]);
  const aiTrendData = useMemo(() => generateAITrend(candles), [candles]);

  // Actions
  const handleSymbolChange = useCallback((newSymbol) => {
    setSymbol(newSymbol);
    setCandles(generateCandles(newSymbol, 200, interval));
  }, [interval]);

  const handleIntervalChange = useCallback((newInterval) => {
    setInterval(newInterval);
    setCandles(generateCandles(symbol, 200, newInterval));
  }, [symbol]);

  const handleChartTypeChange = useCallback((type) => {
    setChartType(type);
  }, []);

  const toggleIndicator = useCallback((id) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleDrawingToolChange = useCallback((toolId) => {
    setActiveDrawingTool(toolId);
  }, []);

  const addDrawing = useCallback((drawing) => {
    setDrawings((prev) => [...prev, { ...drawing, id: Date.now() }]);
  }, []);

  const removeDrawing = useCallback((id) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const toggleDrawingVisibility = useCallback((id) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, visible: !d.visible } : d))
    );
  }, []);

  const addScreenerFilter = useCallback((filter) => {
    setScreenerFilters((prev) => [...prev, { ...filter, id: Date.now() }]);
  }, []);

  const removeScreenerFilter = useCallback((id) => {
    setScreenerFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Save mock
      }
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        setShowIndicatorModal((s) => !s);
      }
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        setShowAIModal((s) => !s);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowIndicatorModal(false);
        setShowAIModal(false);
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    // Symbol & interval
    symbol,
    interval,
    chartType,
    symbols: SYMBOLS,
    handleSymbolChange,
    handleIntervalChange,
    handleChartTypeChange,

    // Candles
    candles,
    currentPrice,
    previousPrice,
    priceChange,
    priceChangePct,
    lastCandle,
    firstCandle,

    // Indicators
    activeIndicators,
    toggleIndicator,
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

    // Drawing
    activeDrawingTool,
    handleDrawingToolChange,
    drawings,
    addDrawing,
    removeDrawing,
    toggleDrawingVisibility,

    // UI
    showSettings,
    setShowSettings,
    isFullscreen,
    setIsFullscreen,
    bottomTab,
    setBottomTab,
    rightPanelTab,
    setRightPanelTab,
    objectTreeTab,
    setObjectTreeTab,

    // Pane sizes
    volumeHeight,
    setVolumeHeight,
    rsiHeight,
    setRsiHeight,
    macdHeight,
    setMacdHeight,
    aiTrendHeight,
    setAiTrendHeight,
    rightPanelWidth,
    setRightPanelWidth,

    // Search
    searchQuery,
    setSearchQuery,
    showSearch,
    setShowSearch,

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
    setScreenerResults,

    // Refs
    chartContainerRef,
    rsiContainerRef,
    macdContainerRef,
    aiTrendContainerRef,
  };
}
