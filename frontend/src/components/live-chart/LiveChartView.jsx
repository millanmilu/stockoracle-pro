import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useStore from '../../store/useStore';
import { getThemeTokens } from '../../utils/theme';
import { useStock } from '../../hooks/useStock';
import { loadChartSettings, saveChartSettings, subscribeChartSettings } from '../../utils/chartSettings';
import { normalizeInterval } from '../../utils/chartHelpers';
import { useWindowSize } from './useWindowSize';
import { useIndicatorLibrary } from './useIndicatorLibrary';
import { usePaperTrading } from './usePaperTrading';
import { useHistoryData } from './useHistoryData';
import { useLiveTicks } from './useLiveTicks';
import { usePaneSync } from './usePaneSync';
import { useDrawingRefSync } from './useDrawingRefSync';
import { useBarReplay } from './useBarReplay';
import ChartShell from './ChartShell';

/**
 * LiveChartView — Rebuilt Clean Master Controller
 * Focused purely on smooth candlestick rendering, accurate historical data,
 * real-time indicators suite, and flicker-free live price tracking.
 *
 * This module owns the top-level state/refs and wires the cohesive engines
 * (history loader, live-tick processor, bar replay, indicator library, paper
 * trading) that live in ./use*.{js,jsx} + the presentational overlays in
 * ./Chart*.jsx. Nothing in this folder imports back from here.
 */
export default function LiveChartView() {
  const selectedSymbol = useStore(s => s.selectedSymbol || 'RELIANCE');
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  const wsLiveData = useStore(s => s.wsLiveData);
  const wsConnected = useStore(s => s.wsConnected);
  // NOTE: no per-tick useStore(s => s.livePrices?.[selectedSymbol]) here —
  // that re-rendered the whole tree dozens/sec on BTC. Live prices
  // flow via LivePriceBadge (toolbar) + the render-free subscribeLiveTick bus
  // (chart) + a 2s-throttled snapshot below (paper P&L lines only).

  const { fetchHistory, preloadStock } = useStock();

  const selectedInterval = useStore(s => s.selectedInterval || '1m');
  const setSelectedInterval = useStore(s => s.setSelectedInterval);
  const setActiveView = useStore(s => s.setActiveView);

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const [interval, setIntervalState] = useState(() => normalizeInterval(selectedInterval, '1m'));
  const intervalRefStable = useRef(null);
  // Stable setter without stale-closure fallback: normalize against the latest
  // committed interval via ref, not the first render's closure value.
  const setInterval = useCallback((newIv) => {
    const fallback = intervalRefStable.current || '1m';
    const clean = normalizeInterval(newIv, fallback);
    setIntervalState(clean);
    setSelectedInterval?.(clean);
  }, [setSelectedInterval]);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proxyWarning, setProxyWarning] = useState(null);
  // Older-history (left-pan backfill) pill: null | { kind: 'loading' | 'end' | 'error' }.
  const [backfillStatus, setBackfillStatus] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Throttled live snapshot for paper P&L price-lines only (2s cadence —
  // ChartCanvas recreates price-lines per change, so raw ticks flickered).
  const [throttledLivePrice, setThrottledLivePrice] = useState(null);

  // Chart Settings (TradingView dialog) — persisted, restored on mount so a
  // reload keeps the user's chart type / scale / timezone choices.
  const [chartType, setChartType] = useState(() => loadChartSettings().chartType || 'candlestick');
  const [priceScaleMode, setPriceScaleMode] = useState(() => loadChartSettings().priceScaleMode || 'normal');
  const [invertScale, setInvertScale] = useState(() => !!loadChartSettings().invertScale);
  // Auto-collapse drawing tools on tablet/mobile (user can re-open).
  // Follows live viewport resizes — shrinking the window collapses the rail
  // instead of overlapping the chart (mount-only init left it stuck open).
  const [showDrawingTools, setShowDrawingTools] = useState(() => window.innerWidth >= 1024);
  const userToggledDrawRef = useRef(false);
  useEffect(() => {
    if (userToggledDrawRef.current) return;
    setShowDrawingTools(windowWidth >= 1024);
  }, [windowWidth]);
  // Shared drawing-tool selection — the top Draw menu and the left rail stay in sync
  const [activeDrawingTool, setActiveDrawingTool] = useState('crosshair');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [volumeHeight, setVolumeHeight] = useState(132);
  const [timezone, setTimezone] = useState(() => loadChartSettings().timezone || 'Asia/Kolkata');
  // Live mirror of the persisted Chart Settings store — used for flags that
  // LiveChartView itself renders (countdown badge), while ChartCanvas
  // subscribes directly for chart/series/legend options.
  const [chartSettings, setChartSettings] = useState(() => loadChartSettings());
  useEffect(() => subscribeChartSettings(setChartSettings), []);

  const handleChartTypeChange = useCallback((nextType) => {
    setChartType(nextType);
    saveChartSettings({ chartType: nextType });
  }, []);
  const handlePriceScaleModeChange = useCallback((nextMode) => {
    setPriceScaleMode(nextMode);
    saveChartSettings({ priceScaleMode: nextMode });
  }, []);

  // ── Live On-Chart Paper Trading ──────────────────────────────────────────
  // Trade bar / docket visibility lives in the chart-settings store so the
  // Chart Settings → Trading tab and the toolbar buttons stay in sync
  // (last writer wins); only pure UI state (collapse) stays local.
  const showTradeBar = !!chartSettings.showTradeButton;
  const showTradeDocket = !!chartSettings.showTradeDocket;
  const [isTradeBarCollapsed, setIsTradeBarCollapsed] = useState(false);
  const { paperPositions, paperAccount, fetchPaperData } = usePaperTrading();

  // Paper-trading poll pauses while the tab is hidden (visibility guard) —
  // no point burning battery/API on an invisible panel.
  useEffect(() => {
    fetchPaperData();
    let intervalId = null;
    const start = () => {
      if (intervalId != null) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        fetchPaperData();
      }, 10000);
    };
    const stop = () => {
      if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') { fetchPaperData(); start(); }
      else stop();
    };
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchPaperData]);

  // ── Advanced indicator library (state, persistence & handlers) ───────────
  const {
    activeIndicators,
    customIndicators,
    setActiveIndicators,
    hiddenIndicators,
    showIndicatorModal,
    setShowIndicatorModal,
    indicatorSettings,
    setIndicatorSettings,
    indicatorParamOverrides,
    activeOscillators,
    showAIDashboard,
    handleToggleIndicator,
    handleClearAllIndicators,
    handleToggleHideIndicator,
    handleRemoveIndicator,
    handleMoveIndicator,
    handleOpenIndicatorSettings,
    handleSaveIndicatorParams,
    handleSaveCustomIndicator,
    handleDeleteCustomIndicator,
    resolveDefinition,
  } = useIndicatorLibrary(interval);

  // Stable drawing-layer refs — DrawingTools needs the SAME ref objects across
  // renders. Passing `{{ current: ... }}` inline would snapshot null on first
  // render and never update (ref changes don't re-render), breaking
  // coordinateToLogical / priceToCoordinate, magnet snapping and drag edits.
  const activeCandleRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const drawingChartRef = useRef(null);
  const drawingCandleRef = useRef(null);
  // Main price-pane wrapper: DrawingTools sizes its SVG overlay to this box so
  // drawings map 1:1 to chart pixels on scroll/zoom (never stretched over
  // volume/oscillator panes).
  const mainChartWrapRef = useRef(null);
  // Last exchange-candle time published to state (crypto liveCandle path)
  const liveCandleTimeRef = useRef(null);
  // Latest-value refs so the live-tick listener NEVER needs re-subscription
  // (ticks flow outside React renders — see processLiveTick below)
  const intervalRef = useRef(interval);
  const symbolRef = useRef(selectedSymbol);
  const readyRef = useRef({ loading: true, hasCandles: false });
  // General oscillator pane refs — keyed by oscType (e.g. 'rsi', 'macd', 'stoch', 'cci', etc.)
  const oscPaneRefs = useRef({});
  const volumePaneRef = useRef(null);
  const containerRef = useRef(null);
  // Rolling window of recent LTPs for adaptive spike detection
  const lastVerifiedPriceRef = useRef(null);
  const recentPricesRef = useRef([]);
  const spikeCountRef = useRef(0);
  // Fill-continuity guard: stall backfill (flat carry-forward bars) is only
  // honest when the previous bucket was actually tick-touched in THIS session.
  // Rollovers from seeded bars (cache/history restore, remount, hidden-tab
  // return, full-frame replace) must leave an honest gap instead of painting
  // a fake flat line at a stale price. Invalidated on long hidden gaps.
  const lastTickBucketRef = useRef(null);
  // Replay cursor (last VISIBLE bar) — owned by useBarReplay, shared with the
  // backfill engine so left-pan requests never fight the replay surface.
  const replayIndexRef = useRef(null);

  // 1. History loading, backfill and their lifecycle effects
  const { loadHistory, handleNeedOlderData } = useHistoryData({
    symbol: selectedSymbol,
    interval,
    fetchHistory,
    candles,
    setCandles,
    loading,
    setLoading,
    error,
    setError,
    setProxyWarning,
    setBackfillStatus,
    activeCandleRef,
    liveCandleTimeRef,
    lastVerifiedPriceRef,
    recentPricesRef,
    spikeCountRef,
    lastTickBucketRef,
    symbolRef,
    intervalRef,
    readyRef,
    replayIndexRef,
  });

  // Keep imperative refs in sync for the render-free tick path
  useEffect(() => {
    intervalRef.current = interval;
    intervalRefStable.current = interval;
  }, [interval]);
  // Throttled live snapshot for paper price-lines (2s cadence, not per tick).
  useEffect(() => {
    const pull = () => {
      try {
        const tick = useStore.getState().livePrices?.[selectedSymbol];
        const p = Number(tick?.price);
        if (isFinite(p) && p > 0) setThrottledLivePrice(p);
      } catch {}
    };
    pull();
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      pull();
    }, 2000);
    return () => clearInterval(id);
  }, [selectedSymbol]);

  // Sync the stable drawing refs from the ChartCanvas imperative handle once
  // the chart instance exists.
  useDrawingRefSync({ loading, candles, interval, selectedSymbol, chartType, chartCanvasRef, drawingChartRef, drawingCandleRef });
  useEffect(() => {
    symbolRef.current = selectedSymbol;
  }, [selectedSymbol]);
  useEffect(() => {
    readyRef.current = { loading, hasCandles: candles.length > 0 };
  }, [loading, candles]);

  // 2. Real-Time Live Tick Processing — render-free path.
  useLiveTicks({
    symbolRef,
    intervalRef,
    readyRef,
    activeCandleRef,
    liveCandleTimeRef,
    lastVerifiedPriceRef,
    recentPricesRef,
    spikeCountRef,
    lastTickBucketRef,
    replayIndexRef,
    chartCanvasRef,
    setCandles,
  });

  // Synchronized range / crosshair across the main chart and every sub-pane
  const { handleVisibleRangeChange, handleCrosshairMove } = usePaneSync({ chartCanvasRef, oscPaneRefs, volumePaneRef });

  // Preload all timeframes and backfill DB for initial symbol
  useEffect(() => {
    if (selectedSymbol) {
      preloadStock(selectedSymbol);
    }
  }, [selectedSymbol, preloadStock]);

  // ── Bar Replay (TradingView parity) ──────────────────────────────────────
  const {
    replayIndex,
    replayPlaying,
    setReplayPlaying,
    replaySpeed,
    isJumpMode,
    isReplaying,
    chartCandles,
    replayBar,
    replayDayChange,
    exitReplay,
    startReplay,
    stepReplay,
    seekReplay,
    cycleReplaySpeed,
    handleChartClick,
  } = useBarReplay({ candles, selectedSymbol, interval, setActiveIndicators, replayIndexRef });

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen to external fullscreen changes (e.g. Esc key)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // 3. Toolbar Handlers
  const handleSelectSymbol = useCallback((sym) => {
    if (sym && sym !== selectedSymbol) {
      preloadStock(sym);
      setSelectedSymbol(sym);
    }
  }, [selectedSymbol, setSelectedSymbol, preloadStock]);

  const handleIntervalChange = useCallback((iv) => {
    setInterval(iv);
  }, [setInterval]);

  const handleResetZoom = useCallback(() => {
    chartCanvasRef.current?.fitContent();
  }, []);

  const lastHistoryClose = candles.length > 0 ? candles[candles.length - 1].close : null;
  // Render-path price: replay cursor when replaying, else the 2s-throttled
  // snapshot (paper lines) falling back to last history close. Per-tick values
  // NEVER live here — LivePriceBadge subscribes separately for the toolbar.
  const curPrice = isReplaying
    ? (replayBar?.close ?? null)
    : (throttledLivePrice ?? lastHistoryClose);

  // Active position for currently viewed symbol with live mark-to-market P&L
  // (throttled snapshot — per-tick updates recreated price-lines + flickered).
  const activeSymbolPosition = useMemo(() => {
    const sym = String(selectedSymbol || '').toUpperCase().trim();
    const found = paperPositions.find((p) => String(p.ticker || '').toUpperCase().trim() === sym);
    if (!found) return null;
    const entryPrice = Number(found.avg_buy_price || 0);
    const ltp = Number(curPrice || found.current_price || entryPrice);
    const pnl = Math.round((ltp - entryPrice) * found.shares * 100) / 100;
    const pnlPct = Math.round(((ltp - entryPrice) / Math.max(0.01, entryPrice)) * 10000) / 100;
    return {
      ...found,
      current_price: ltp,
      unrealized_pnl: pnl,
      unrealized_pnl_pct: pnlPct,
    };
  }, [paperPositions, selectedSymbol, curPrice]);

  return (
    <ChartShell {...{
      tk, containerRef, selectedSymbol, interval, isMobile, isTablet,
      candles, chartCandles, loading, error, setError, proxyWarning, backfillStatus, setBackfillStatus,
      loadHistory, handleNeedOlderData, lastHistoryClose, curPrice, replayDayChange,
      handleSelectSymbol, handleIntervalChange, handleResetZoom,
      handleChartTypeChange, handlePriceScaleModeChange,
      chartType, setChartType, priceScaleMode, setPriceScaleMode, invertScale, setInvertScale,
      timezone, setTimezone, showVolume, setShowVolume, volumeHeight, setVolumeHeight,
      showDrawingTools, setShowDrawingTools, userToggledDrawRef, activeDrawingTool, setActiveDrawingTool,
      showSettingsModal, setShowSettingsModal, showIndicatorModal, setShowIndicatorModal,
      activeIndicators, hiddenIndicators, indicatorParamOverrides, indicatorSettings, setIndicatorSettings,
      customIndicators, handleSaveCustomIndicator, handleDeleteCustomIndicator,
      handleToggleIndicator, handleClearAllIndicators, handleToggleHideIndicator, handleRemoveIndicator,
      handleMoveIndicator, handleOpenIndicatorSettings, handleSaveIndicatorParams,
      activeOscillators, resolveDefinition, showAIDashboard,
      smcProOn: activeIndicators.includes('smc_pro'),
      onToggleSmcPro: () => handleToggleIndicator('smc_pro'),
      onOpenAlerts: () => setActiveView('Price Alerts'),
      showTradeBar, showTradeDocket, paperPositions, paperAccount, fetchPaperData,
      isTradeBarCollapsed, setIsTradeBarCollapsed, activeSymbolPosition,
      isReplaying, isJumpMode, replayIndex, replayPlaying, replaySpeed, setReplayPlaying,
      exitReplay, startReplay, stepReplay, seekReplay, cycleReplaySpeed, handleChartClick,
      chartSettings, isFullscreen, handleToggleFullscreen, wsLiveData, wsConnected,
      chartCanvasRef, activeCandleRef, drawingChartRef, drawingCandleRef, mainChartWrapRef,
      oscPaneRefs, volumePaneRef, handleVisibleRangeChange, handleCrosshairMove,
    }} />
  );
}
