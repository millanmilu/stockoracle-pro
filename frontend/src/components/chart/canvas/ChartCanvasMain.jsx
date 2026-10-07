import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback, memo } from 'react';
import { isCryptoSymbol } from '../../../utils/chartHelpers';
import { loadChartSettings, subscribeChartSettings, buildChartOptions, buildSeriesOptions, resolvePrecision, applyScalePlacement } from '../../../utils/chartSettings';
import '../../../utils/aiIndicatorEngine.js';
import { getThemeTokens, applyChartTheme } from '../../../utils/theme';
import useStore from '../../../store/useStore';
import { formatVolume, formatIndicatorValue, decimalsForPrice } from './chartFormat';
import { useIndicatorGroups } from './useIndicatorGroups';
import { createImperativeApi } from './imperativeApi';
import { initChart } from './chartInit';
import { syncCandlesData } from './candlesDataSync';
import { restoreChartVisibility, switchChartType, applyPriceScaleMode } from './chartMaintenanceEffects';
import { updateIndicatorOverlays, updateAiMarkers } from './indicatorOverlayEffects';
import { updatePaperPositionLines } from './paperPositionEffect';
import { chartCanvasPropsEqual } from './chartCanvasMemo';
import ChartCanvasOverlays from './ChartCanvasOverlays';

/**
 * ChartCanvas — TradingView-Grade High Performance Candlestick Chart
 * Features:
 * - Smooth pan, scroll-wheel zoom, magnet crosshair
 * - Synchronized timeScale and synced crosshair support for stacked sub-panes
 * - Unified top-left legend displaying Symbol, OHLC, % Change, Volume, and active overlay indicators
 * - 0ms DOM update latency for 60 FPS fluidity
 */
const ChartCanvas = forwardRef(function ChartCanvas({
  candles = [],
  activeCandleRef,
  interval = '1d',
  selectedSymbol = 'RELIANCE',
  chartType = 'candlestick',
  priceScaleMode = 'normal',
  invertScale = false,
  showVolume = true,
  volumeMA = 20,
  timezone = 'Asia/Kolkata',
  livePrice = null,
  liveChange = null,
  activeIndicators = [],
  hiddenIndicators = [],
  indicatorOverrides = {},
  customIndicators = [],
  onToggleHideIndicator = () => {},
  onRemoveIndicator = () => {},
  onVisibleRangeChange = () => {},
  onCrosshairMove = () => {},
  onChartClick = () => {},
  onNeedOlderData = () => {},
  paperPosition = null,
}, ref) {
  const containerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const syncedHairlineRef = useRef(null);
  const indicatorSeriesRef = useRef({}); // id -> series or array of series
  const smcSeriesRef = useRef({}); // id -> SMC marker/price-line series group
  const aiZoneSeriesRef = useRef({}); // id -> AI S/R zone price-line series group
  const aiSeriesRef = useRef({}); // id -> AI overlay series group (signal levels, S/R zones)
  const engineValueRef = useRef({}); // id -> last computed engine value (legend)
  const paperPriceLinesRef = useRef({ entry: null, stopLoss: null, target: null });
  const chartTypeRef = useRef(chartType);
  chartTypeRef.current = chartType;
  const intervalRef = useRef(interval);
  intervalRef.current = interval;
  const timezoneRef = useRef(timezone);
  timezoneRef.current = timezone;
  const appliedPrecisionRef = useRef(null); // last priceFormat precision pushed to the series

  // TradingView chart-settings (utils/chartSettings.js). `settingsRef` is what
  // chart/series creation code reads; `chartSettings` state drives the legend
  // + watermark DOM so status-line toggles re-render without a chart rebuild.
  const [chartSettings, setChartSettings] = useState(() => loadChartSettings());
  const settingsRef = useRef(chartSettings);
  settingsRef.current = chartSettings;

  // Push matching priceFormat (axis labels + crosshair + last-value tag) to
  // the primary series. No-ops unless the decimal count actually changed.
  const syncSeriesPrecision = useCallback((dec) => {
    const series = candleSeriesRef.current;
    if (!series || dec == null) return;
    if (appliedPrecisionRef.current === dec) return;
    appliedPrecisionRef.current = dec;
    try {
      series.applyOptions({
        priceFormat: { type: 'price', precision: dec, minMove: dec === 0 ? 1 : 1 / Math.pow(10, dec) },
      });
    } catch {}
  }, []);

  // DOM refs for zero-latency legend updates without triggering React re-renders
  const openRef = useRef(null);
  const highRef = useRef(null);
  const lowRef = useRef(null);
  const closeRef = useRef(null);
  const chgRef = useRef(null);
  const volRef = useRef(null);
  const timeRef = useRef(null);
  const indicatorValRefs = useRef({});

  const isHoveringRef = useRef(false);
  const candlesRef = useRef(candles);
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Live-apply light/dark colors without recreating the chart (preserves zoom/scroll)
  useEffect(() => {
    if (chartInstanceRef.current) applyChartTheme(chartInstanceRef.current, theme);
  }, [theme]);

  const { overlayIndicators, smcIndicators, aiZoneIndicators, aiMarkerIndicators, aiOverlays } =
    useIndicatorGroups(activeIndicators, indicatorOverrides, interval, customIndicators);

  // Update top-left legend in DOM at 0ms latency
  const isCrypto = isCryptoSymbol(selectedSymbol);
  const currSym = isCrypto ? '$' : '₹';
  // Status-line toggles (Chart Settings → Status Line)
  const legendVisible = !!(
    chartSettings.showLegendTitle ||
    chartSettings.showOHLC ||
    chartSettings.showBarChange ||
    chartSettings.showVolumeLegend
  );

  const updateLegend = useCallback((candle) => {
    if (!candle) return;
    const o = Number(candle.open);
    const h = Number(candle.high);
    const l = Number(candle.low);
    const c = Number(candle.close);
    const v = Number(candle.volume || 0);
    const dec = decimalsForPrice(c, isCrypto);

    if (openRef.current && !isNaN(o)) openRef.current.textContent = `${currSym}${o.toFixed(dec)}`;
    if (highRef.current && !isNaN(h)) highRef.current.textContent = `${currSym}${h.toFixed(dec)}`;
    if (lowRef.current && !isNaN(l)) lowRef.current.textContent = `${currSym}${l.toFixed(dec)}`;
    if (closeRef.current && !isNaN(c)) closeRef.current.textContent = `${currSym}${c.toFixed(dec)}`;

    const diff = c - o;
    const chgPct = o > 0 ? (diff / o) * 100 : 0;
    const isUp = diff >= 0;
    const sign = isUp ? '+' : '';
    if (chgRef.current && !isNaN(diff)) {
      chgRef.current.textContent = `${sign}${currSym}${diff.toFixed(dec)} (${sign}${chgPct.toFixed(2)}%)`;
      chgRef.current.style.color = isUp ? '#26A69A' : '#EF5350';
    }
    if (volRef.current) {
      volRef.current.textContent = formatVolume(v);
    }
    if (timeRef.current) {
      const t = candle.time;
      const formattedTime = typeof t === 'object'
        ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
        : (typeof t === 'number'
            ? new Date(t * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : String(t));
      timeRef.current.textContent = formattedTime;
    }

    // Update overlay indicators in DOM
    overlayIndicators.forEach((ind) => {
      const el = indicatorValRefs.current[ind.id];
      if (el) {
        el.textContent = formatIndicatorValue(ind, candle, currSym, engineValueRef.current[ind.id]);
      }
    });
  }, [overlayIndicators, currSym, isCrypto]);

  // Reset legend to latest candle or active candle
  const resetLegendToLatest = useCallback(() => {
    const latest = activeCandleRef?.current || (candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length - 1] : null);
    if (latest) {
      updateLegend(latest);
    }
  }, [activeCandleRef, updateLegend]);

  // Latest-callback refs: the chart is created ONCE and must NEVER be destroyed
  // just because a legend-updating callback identity changed (e.g. an indicator
  // was toggled). Handlers read the fresh version via refs instead.
  const updateLegendRef = useRef(updateLegend);
  updateLegendRef.current = updateLegend;
  const resetLegendRef = useRef(resetLegendToLatest);
  resetLegendRef.current = resetLegendToLatest;
  const crosshairMoveRef = useRef(onCrosshairMove);
  crosshairMoveRef.current = onCrosshairMove;
  const visibleRangeRef = useRef(onVisibleRangeChange);
  visibleRangeRef.current = onVisibleRangeChange;
  const chartClickRef = useRef(onChartClick);
  chartClickRef.current = onChartClick;
  const needOlderDataRef = useRef(onNeedOlderData);
  needOlderDataRef.current = onNeedOlderData;

  // Expose imperative methods to parent controller
  useImperativeHandle(ref, () => createImperativeApi({
    chartInstanceRef,
    candleSeriesRef,
    syncedHairlineRef,
    isHoveringRef,
    candlesRef,
    chartTypeRef,
    updateLegend,
    resetLegendToLatest,
  }), [updateLegend, resetLegendToLatest, activeCandleRef]);

  // NOTE: There is deliberately NO subscribeLiveTick consumer in ChartCanvas.
  // LiveChartView is the single tick consumer: it runs spike protection,
  // market-hours and session-bucket rollover logic, then calls
  // chartCanvasRef.current?.updateActiveCandle(). A second raw subscriber here
  // would double-apply ticks (double volume, spike leaks, bucket drift).

  // 1. Initialize Lightweight Charts instance
  useEffect(() => initChart({
    theme,
    chartType,
    isCrypto,
    containerRef,
    chartInstanceRef,
    candleSeriesRef,
    indicatorSeriesRef,
    smcSeriesRef,
    aiSeriesRef,
    isHoveringRef,
    syncedHairlineRef,
    candlesRef,
    updateLegendRef,
    resetLegendRef,
    crosshairMoveRef,
    visibleRangeRef,
    chartClickRef,
    needOlderDataRef,
    intervalRef,
    timezoneRef,
    settingsRef,
  }), []);

  // Every series this chart owns (primary + overlays + SMC/AI groups) so a
  // "Scale Axis Position: Left" flip can move them all in one pass.
  const collectAllSeries = useCallback(() => {
    const out = [];
    const push = (v) => {
      if (Array.isArray(v)) v.forEach(push);
      else if (v && !v.__isDisposed) out.push(v);
    };
    push(candleSeriesRef.current);
    Object.values(indicatorSeriesRef.current || {}).forEach(push);
    Object.values(smcSeriesRef.current || {}).forEach((g) => push(g?.lineSeries));
    Object.values(aiZoneSeriesRef.current || {}).forEach((g) => push(g?.lineSeries));
    Object.values(aiSeriesRef.current || {}).forEach((g) => push(g?.lineSeries));
    return out;
  }, []);

  const syncScalePlacement = useCallback((s) => {
    const chart = chartInstanceRef.current;
    if (!chart || chart.__isDisposed) return;
    applyScalePlacement(chart, s || settingsRef.current, collectAllSeries());
  }, [collectAllSeries]);

  // Live apply of TradingView chart settings (ChartSettingsModal writes to
  // utils/chartSettings → this subscriber patches the live instance). Re-runs
  // on theme change too, so applyChartTheme can never wipe user overrides.
  useEffect(() => {
    return subscribeChartSettings((next) => {
      settingsRef.current = next;
      setChartSettings(next);
      const chart = chartInstanceRef.current;
      if (chart && !chart.__isDisposed) {
        try { chart.applyOptions(buildChartOptions(next, theme)); } catch {}
        applyScalePlacement(chart, next, collectAllSeries());
      }
      const series = candleSeriesRef.current;
      if (series && !series.__isDisposed) {
        try { series.applyOptions(buildSeriesOptions(next, chartTypeRef.current)); } catch {}
        appliedPrecisionRef.current = null;
        const rows = candlesRef.current;
        const last = Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null;
        try { syncSeriesPrecision(resolvePrecision(next, decimalsForPrice(last?.close, isCrypto))); } catch {}
      }
    });
  }, [theme, isCrypto, syncSeriesPrecision, collectAllSeries]);

  // Update timeScale options when interval changes
  useEffect(() => {
    if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
      try {
        chartInstanceRef.current.timeScale().applyOptions({
          timeVisible: interval !== '1d',
          secondsVisible: interval === '1s' || interval === '30s',
        });
      } catch {}
    }
  }, [interval]);

  // Load Historical Candles into Series
  // Incremental live-bar appends (same first bar, small growth) must NOT
  // steal the viewport — only full reloads re-fit the visible range.
  // Left-pan backfills (older bars prepended, same last bar) shift the
  // viewport forward by the prepend count so the user keeps looking at the
  // exact same bars — no jump, no snap to the right edge.
  const candlesMetaRef = useRef({ firstTime: null, lastTime: null, length: 0 });
  useEffect(() => syncCandlesData({
    candles,
    isCrypto,
    syncSeriesPrecision,
    candleSeriesRef,
    chartInstanceRef,
    candlesRef,
    candlesMetaRef,
    settingsRef,
    chartTypeRef,
    resetLegendRef,
  }), [candles, isCrypto, syncSeriesPrecision]);

  // Tab-return restore: browsers may discard the canvas bitmap while the tab
  // is hidden, leaving a blank chart even though candle state is intact.
  // On return, re-apply the container size and re-push the last good data.
  useEffect(() => restoreChartVisibility({
    chartInstanceRef,
    candleSeriesRef,
    containerRef,
    candlesRef,
    chartTypeRef,
  }), []);

  // Dynamic Chart Type Switcher (Candles, Hollow, Bar, Line, Area, Baseline)
  useEffect(() => switchChartType({
    chartType,
    isCrypto,
    syncSeriesPrecision,
    syncScalePlacement,
    chartInstanceRef,
    candleSeriesRef,
    candlesRef,
    settingsRef,
    appliedPrecisionRef,
  }), [chartType, isCrypto, syncSeriesPrecision, syncScalePlacement]);

  // Apply Price Scale Mode (Normal, Logarithmic, Percentage) & Invert
  useEffect(() => applyPriceScaleMode({
    priceScaleMode,
    invertScale,
    chartInstanceRef,
  }), [priceScaleMode, invertScale]);

  // Dynamically manage and render Indicator Overlays
  // Re-sync them after chart-type changes because the primary series is replaced
  // while Lightweight Charts keeps a shared time scale across all series.
  useEffect(() => updateIndicatorOverlays({
    chartInstanceRef,
    indicatorSeriesRef,
    smcSeriesRef,
    aiZoneSeriesRef,
    aiSeriesRef,
    engineValueRef,
    resetLegendRef,
    settingsRef,
    syncScalePlacement,
    activeIndicators,
    hiddenIndicators,
    overlayIndicators,
    smcIndicators,
    aiOverlays,
    aiZoneIndicators,
    candles,
  }), [activeIndicators, hiddenIndicators, overlayIndicators, smcIndicators, aiOverlays, aiZoneIndicators, candles, chartType, syncScalePlacement]);

  // Advanced AI markers (breakout BRK / exhaustion EXH / pattern shapes),
  // merged onto the primary price series. Re-applied on chart-type switches
  // (which recreate the primary series) and every data rollover.
  useEffect(() => updateAiMarkers({
    candleSeriesRef,
    candlesRef,
    aiMarkerIndicators,
    candles,
  }), [candles, aiMarkerIndicators, chartType]);

  // On-Chart Paper Trading Position Lines (Entry, Stop Loss, Target Price)
  useEffect(() => updatePaperPositionLines({
    candleSeriesRef,
    paperPriceLinesRef,
    paperPosition,
    livePrice,
    selectedSymbol,
  }), [paperPosition, livePrice, selectedSymbol, chartType]);

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onMouseLeave={() => {
        isHoveringRef.current = false;
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        resetLegendToLatest();
        onCrosshairMove({ x: null, time: null, source: 'main' });
      }}
    >
      {/* 1. Synchronized Vertical Crosshair Hairline (when cursor is in sub-pane) */}
      <div
        ref={syncedHairlineRef}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 1,
          borderLeft: '1px dashed #787B86',
          pointerEvents: 'none',
          display: 'none',
          zIndex: 14,
        }}
      />

      <ChartCanvasOverlays
        chartSettings={chartSettings}
        legendVisible={legendVisible}
        tk={tk}
        selectedSymbol={selectedSymbol}
        interval={interval}
        overlayIndicators={overlayIndicators}
        hiddenIndicators={hiddenIndicators}
        indicatorValRefs={indicatorValRefs}
        onToggleHideIndicator={onToggleHideIndicator}
        onRemoveIndicator={onRemoveIndicator}
        openRef={openRef}
        highRef={highRef}
        lowRef={lowRef}
        closeRef={closeRef}
        chgRef={chgRef}
        volRef={volRef}
        timeRef={timeRef}
      />

      {/* 3. Main Lightweight Charts Canvas */}
      <style>{`.tv-ind-row:hover .tv-legend-action{opacity:1 !important;}`}</style>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
});

export default memo(ChartCanvas, chartCanvasPropsEqual);
