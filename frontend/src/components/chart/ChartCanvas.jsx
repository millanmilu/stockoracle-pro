import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo, memo } from 'react';
import { CrosshairMode, PriceScaleMode, LineStyle } from 'lightweight-charts';
import { safeCreateChart } from '../../utils/safeChart';
import { Eye, EyeOff, X } from 'lucide-react';
import { CHART_OPTIONS, CANDLE_STYLE, isCryptoSymbol, sanitizeCandles, sanitizeSeriesData, compareChartTime, BACKFILL_TRIGGER_BARS } from '../../utils/chartHelpers';
import '../../utils/aiIndicatorEngine.js';
import { getAISupportResistance, getAIBreakoutMarkers, getAIReversalMarkers, getAIPatternMarkers } from '../../utils/aiIndicatorEngine.js';
import { getChartBaseOptions, getThemeTokens, applyChartTheme } from '../../utils/theme';
import useStore from '../../store/useStore';
import { INDICATOR_DEFINITIONS } from './indicatorDefinitions';
import { calculateById } from '../../utils/indicatorEngine';
import { getEngineFallbackId } from './indicatorSettingsSchema';
import { detectSMC } from '../../utils/marketStructure';
import { analyzeSignal } from '../../utils/aiSignalEngine';

/**
 * Format volume into readable K / L / Cr
 */
function formatVolume(vol) {
  if (vol == null || isNaN(vol) || vol <= 0) return '—';
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
  if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toLocaleString();
}

/**
 * Decimals for price display (axis labels + OHLC legend), TradingView-style:
 * large prices drop the noisy decimals (88125 not 88125.00), small coins
 * keep them (0.15 stays 0.15). Equities are always whole rupees.
 */
function decimalsForPrice(value, isCrypto) {
  if (!isCrypto) return 0;
  const a = Math.abs(Number(value) || 0);
  if (a >= 1000) return 0;
  if (a >= 100) return 1;
  return 2;
}

/**
 * Format indicator value for display in the legend badge
 */
function formatIndicatorValue(def, candle, currSym = '₹', engineValue = null) {
  if (!candle || !def) return '—';
  if (def.type === 'overlay') {
    const val = def.field ? candle[def.field] : engineValue;
    if (val == null || isNaN(Number(val))) return '—';
    return `${currSym}${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_supertrend') {
    const val = candle[def.field];
    if (val == null || isNaN(Number(val))) return '—';
    const isBull = Number(candle[def.dirField]) === 1;
    return `${isBull ? '▲' : '▼'} ${currSym}${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_psar') {
    const val = candle[def.field];
    if (val == null || isNaN(Number(val))) return '—';
    return `${currSym}${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_ichimoku') {
    const t = candle.ichimoku_tenkan;
    const k = candle.ichimoku_kijun;
    if (t == null || isNaN(Number(t))) return '—';
    return `T:${Number(t).toFixed(1)} K:${Number(k || 0).toFixed(1)}`;
  }
  if (def.type === 'overlay_multi') {
    if (def.subLines && def.subLines.length >= 3) {
      const u = candle[def.subLines[0].field];
      const m = candle[def.subLines[1].field];
      const l = candle[def.subLines[2].field];
      if (m != null && !isNaN(Number(m))) {
        return `M:${Number(m).toFixed(1)} U:${Number(u).toFixed(1)} L:${Number(l).toFixed(1)}`;
      }
    }
    const u = candle.bb_upper;
    const m = candle.bb_middle;
    const l = candle.bb_lower;
    if (m == null || isNaN(Number(m))) return '—';
    return `B:${Number(m).toFixed(1)} U:${Number(u).toFixed(1)} L:${Number(l).toFixed(1)}`;
  }
  if (def.type === 'levels') {
    if (def.id === 'fibonacci') {
      const f50 = candle.fib_500;
      const f61 = candle.fib_618;
      if (f50 == null || isNaN(Number(f50))) return '—';
      return `50%:${Number(f50).toFixed(1)} 61.8%:${Number(f61).toFixed(1)}`;
    }
    const p = candle.pivot;
    const r1 = candle.r1;
    const s1 = candle.s1;
    if (p == null || isNaN(Number(p))) return '—';
    return `P:${Number(p).toFixed(1)} R1:${Number(r1).toFixed(1)} S1:${Number(s1).toFixed(1)}`;
  }
  const generic = def.field ? candle[def.field] : engineValue;
  return generic != null && !isNaN(Number(generic)) ? Number(generic).toFixed(2) : '—';
}

/**
 * Resolve the display data for a single overlay indicator. When the user has
 * overridden inputs (TradingView Inputs tab), the client engine wins over the
 * stale server field so custom periods actually recompute; otherwise the
 * server field is preferred for speed.
 */
function resolveOverlayData(def, candles) {
  const hasCustomInputs = def.params && Object.keys(def.params).length > 0;
  if (def.engineId && hasCustomInputs) {
    const result = calculateById(def.engineId, candles, def.params || {});
    if (result.valid && result.points) {
      const arr = result.points.main || result.points;
      if (Array.isArray(arr)) {
        const pts = arr
          .filter((p) => p && p.value != null && !isNaN(Number(p.value)))
          .map((p) => ({ time: p.time, value: Number(p.value) }));
        if (pts.length) return sanitizeSeriesData(pts);
      }
    }
    // Fall through to server field if engine yields nothing.
  }
  const colField = def.field;
  if (colField) {
    const pts = candles
      .filter((c) => c[colField] != null && !isNaN(Number(c[colField])))
      .map((c) => ({ time: c.time, value: Number(c[colField]) }));
    if (pts.length) return sanitizeSeriesData(pts);
  }
  if (def.engineId) {
    const result = calculateById(def.engineId, candles, def.params || {});
    if (!result.valid || !result.points) return [];
    const arr = result.points.main || result.points;
    if (!Array.isArray(arr)) return [];
    const pts = arr
      .filter((p) => p && p.value != null && !isNaN(Number(p.value)))
      .map((p) => ({ time: p.time, value: Number(p.value) }));
    return sanitizeSeriesData(pts);
  }
  return [];
}


/**
 * Creates primary price series based on chart type
 */
function createPrimarySeries(chart, type, isCrypto) {
  // NSE equities show rounded whole-rupee labels on the right price axis
  // (slim axis, no decimal clutter); crypto keeps 2-decimal precision.
  const priceFormat = isCrypto
    ? { type: 'price', precision: 2, minMove: 0.01 }
    : { type: 'price', precision: 0, minMove: 1 };
  if (type === 'hollow') {
    return chart.addCandlestickSeries({
      ...CANDLE_STYLE,
      upColor: 'transparent',
      borderUpColor: '#26A69A',
      wickUpColor: '#26A69A',
      downColor: '#EF5350',
      borderDownColor: '#EF5350',
      wickDownColor: '#EF5350',
      priceFormat,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: '#818CF8',
      priceLineStyle: 2,
    });
  }
  if (type === 'bar') {
    return chart.addBarSeries({
      upColor: '#26A69A',
      downColor: '#EF5350',
      priceFormat,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: '#818CF8',
      priceLineStyle: 2,
    });
  }
  if (type === 'line') {
    return chart.addLineSeries({
      color: '#38BDF8',
      lineWidth: 2,
      priceFormat,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: '#38BDF8',
      priceLineStyle: 2,
    });
  }
  if (type === 'area') {
    return chart.addAreaSeries({
      topColor: 'rgba(56, 189, 248, 0.35)',
      bottomColor: 'rgba(56, 189, 248, 0.01)',
      lineColor: '#38BDF8',
      lineWidth: 2,
      priceFormat,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: '#38BDF8',
      priceLineStyle: 2,
    });
  }
  if (type === 'baseline') {
    return chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#26A69A',
      topFillColor1: 'rgba(38, 166, 154, 0.28)',
      topFillColor2: 'rgba(38, 166, 154, 0.05)',
      bottomLineColor: '#EF5350',
      bottomFillColor1: 'rgba(239, 83, 80, 0.05)',
      bottomFillColor2: 'rgba(239, 83, 80, 0.28)',
      priceFormat,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: 2,
    });
  }
  // Default 'candlestick'
  return chart.addCandlestickSeries({
    ...CANDLE_STYLE,
    priceFormat,
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineWidth: 1,
    priceLineColor: '#818CF8',
    priceLineStyle: 2,
  });
}

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


  // Resolve active catalog definitions once (shared by overlays, zones, markers).
  // TradingView parity: flat overrides split into inputs (engine params) +
  // style (`__color`, `__lineWidth`, `__sub_{i}_color`) + visibility
  // (`__vis_{interval} === false` hides on that timeframe).
  const resolvedActive = useMemo(() => {
    const normIv = String(interval || '').toLowerCase();
    return activeIndicators
      .map(id => {
        const def = INDICATOR_DEFINITIONS.find(item => item.id === id);
        if (!def) return null;
        const overrides = indicatorOverrides[id];
        if (!overrides || !Object.keys(overrides).length) return def;
        // Visibility gate
        for (const [k, v] of Object.entries(overrides)) {
          if (k.toLowerCase() === `__vis_${normIv}` && v === false) return null;
        }
        const inputs = {};
        const stylePatch = {};
        for (const [k, v] of Object.entries(overrides)) {
          if (k.startsWith('__')) stylePatch[k] = v;
          else inputs[k] = v;
        }
        let next = { ...def, params: { ...(def.params || {}), ...inputs } };
        // Engine fallback: legacy field-based indicators recompute via the
        // client engine when the user customized inputs (else server field).
        if (!next.engineId && Object.keys(inputs).length) {
          const fb = getEngineFallbackId(next.id);
          if (fb) next = { ...next, engineId: fb };
        }
        if (stylePatch.__color) next = { ...next, color: stylePatch.__color };
        if (stylePatch.__lineWidth != null) next = { ...next, lineWidth: stylePatch.__lineWidth };
        if (stylePatch.__lineStyle != null) next = { ...next, lineStyle: stylePatch.__lineStyle };
        const subKeys = Object.keys(stylePatch).filter((k) => k.startsWith('__sub_'));
        if (subKeys.length && (next.subLines || next.levels)) {
          const applySubs = (list) => list.map((sub, i) => {
            const c = stylePatch[`__sub_${i}_color`];
            return c ? { ...sub, color: c } : sub;
          });
          if (next.subLines) next = { ...next, subLines: applySubs(next.subLines) };
          if (next.levels) next = { ...next, levels: applySubs(next.levels) };
        }
        return next;
      })
      .filter(Boolean);
  }, [activeIndicators, indicatorOverrides, interval]);

  // Filter active indicators to only include overlays (not oscillators which live in sub-panes),
  // applying per-indicator parameter overrides so custom params reflect in rendering.
  // Advanced AI forecast bands render here too (price-scale by construction).
  // The volume profile (type 'profile') renders through its own canvas overlay
  // in LiveChartView — excluded here so no line series is created for it.
  const overlayIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => (!['oscillator', 'smc', 'ai', 'custom', 'profile'].includes(item.type))
        || (item.type === 'ai' && item.aiOverlay === 'bands'));
  }, [resolvedActive]);

  // Market Structure / SMC overlays are rendered separately from the price legend.
  const smcIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => item.type === 'smc');
  }, [resolvedActive]);

  // Advanced AI overlays: zones (S/R lines) and markers (breakout/reversal/pattern).
  // ai_reversal lives in an oscillator sub-pane but still contributes EXH markers.
  const aiZoneIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => item.type === 'ai' && item.aiOverlay === 'zones');
  }, [resolvedActive]);
  const aiMarkerIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => (item.type === 'ai' && item.aiOverlay === 'markers') || item.id === 'ai_reversal');
  }, [resolvedActive]);

  // AI indicators that draw real overlays on the price pane (defs flagged
  // chartOverlay). Their price levels come from analyzeSignal at render time.
  // Advanced AI studies (aiOverlay line/bands/zones/markers) render through
  // their own engine-backed layers below — excluded here to avoid doubles.
  const aiOverlays = useMemo(() => {
    return resolvedActive
      .filter(item => item.type === 'ai' && item.chartOverlay && !item.aiOverlay);
  }, [resolvedActive]);

  // Update top-left legend in DOM at 0ms latency
  const isCrypto = isCryptoSymbol(selectedSymbol);
  const currSym = isCrypto ? '$' : '₹';

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
  useImperativeHandle(ref, () => ({
    fitContent: () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
        try {
          const totalBars = candlesRef.current?.length || 0;
          if (totalBars > 0) {
            const visibleCount = Math.min(totalBars, 80);
            chartInstanceRef.current.timeScale().setVisibleLogicalRange({
              from: totalBars - visibleCount,
              to: totalBars + 4,
            });
          } else {
            chartInstanceRef.current.timeScale().fitContent();
          }
        } catch {}
      }
    },
    updateActiveCandle: (candle) => {
      if (candleSeriesRef.current && !candleSeriesRef.current.__isDisposed && candle && candle.time) {
        try {
          const lastCandle = candlesRef.current && candlesRef.current.length > 0
            ? candlesRef.current[candlesRef.current.length - 1]
            : null;

          // Guard against mixing time types (e.g. string 'YYYY-MM-DD' vs numeric epoch seconds)
          if (lastCandle) {
            const lastIsStr = typeof lastCandle.time === 'string';
            const curIsStr = typeof candle.time === 'string';
            if (lastIsStr !== curIsStr) {
              return;
            }
            if (candle.time < lastCandle.time) {
              return;
            }
          }

          const o = Number(candle.open);
          const c = Number(candle.close);
          const h = Math.max(Number(candle.high), o, c);
          const l = Math.min(Number(candle.low), o, c);

          const isLineType = ['line', 'area', 'baseline'].includes(chartTypeRef.current);
          if (isLineType) {
            candleSeriesRef.current.update({
              time: candle.time,
              value: c,
            });
          } else {
            candleSeriesRef.current.update({
              time: candle.time,
              open: o,
              high: h,
              low: l,
              close: c,
            });
          }

          if (candlesRef.current) {
            const lastIdx = candlesRef.current.length - 1;
            if (lastIdx >= 0 && candlesRef.current[lastIdx].time === candle.time) {
              candlesRef.current[lastIdx] = { ...candlesRef.current[lastIdx], ...candle, open: o, high: h, low: l, close: c };
            } else if (lastIdx >= 0 && candle.time > candlesRef.current[lastIdx].time) {
              // Only follow the live edge when the viewport is ALREADY at the
              // right edge. Panning into history + moving the mouse off-chart
              // must not yank the user back on the next bucket rollover.
              let atRightEdge = true;
              try {
                const range = chartInstanceRef.current && !chartInstanceRef.current.__isDisposed
                  ? chartInstanceRef.current.timeScale().getVisibleLogicalRange()
                  : null;
                if (range) {
                  const totalBars = candlesRef.current.length;
                  atRightEdge = range.to >= totalBars - 2;
                }
              } catch { atRightEdge = true; }
              candlesRef.current.push({ ...candle, open: o, high: h, low: l, close: c });
              if (!isHoveringRef.current && atRightEdge) {
                try {
                  if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
                    chartInstanceRef.current.timeScale().scrollToRealtime();
                  }
                } catch {}
              }
            } else if (lastIdx < 0) {
              candlesRef.current = [{ ...candle, open: o, high: h, low: l, close: c }];
            }
          }
          if (!isHoveringRef.current) {
            updateLegend(candle);
          }
        } catch (err) {
          console.warn('Error updating active candle series:', err);
        }
      }
    },
    setVisibleLogicalRange: (range) => {
      if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed && range) {
        try {
          chartInstanceRef.current.timeScale().setVisibleLogicalRange(range);
        } catch {}
      }
    },
    setSyncedCrosshair: ({ x, time, source }) => {
      if (source === 'main') return;
      if (x != null && x > 0) {
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.left = `${x}px`;
          syncedHairlineRef.current.style.display = 'block';
        }
        isHoveringRef.current = true;
        if (time && candlesRef.current.length > 0) {
          const matched = candlesRef.current.find(c => c.time === time);
          if (matched) {
            updateLegend(matched);
          }
        }
      } else {
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        isHoveringRef.current = false;
        resetLegendToLatest();
      }
    },
    getChart: () => (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed ? chartInstanceRef.current : null),
    getCandleSeries: () => (candleSeriesRef.current && !candleSeriesRef.current.__isDisposed ? candleSeriesRef.current : null),
    getPriceCoordinate: (price) => {
      if (!candleSeriesRef.current || candleSeriesRef.current.__isDisposed || price == null) return null;
      try {
        return candleSeriesRef.current.priceToCoordinate(Number(price));
      } catch {
        return null;
      }
    },
  }), [updateLegend, resetLegendToLatest, activeCandleRef]);

  // NOTE: There is deliberately NO subscribeLiveTick consumer in ChartCanvas.
  // LiveChartView is the single tick consumer: it runs spike protection,
  // market-hours and session-bucket rollover logic, then calls
  // chartCanvasRef.current?.updateActiveCandle(). A second raw subscriber here
  // would double-apply ticks (double volume, spike leaks, bucket drift).

  // 1. Initialize Lightweight Charts instance
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let fitRaf = null;

    containerRef.current.innerHTML = '';

    const themeOpts = getChartBaseOptions(theme);
    const chart = safeCreateChart(containerRef.current, {
      ...CHART_OPTIONS,
      ...themeOpts,
      rightPriceScale: { ...CHART_OPTIONS.rightPriceScale, ...themeOpts.rightPriceScale },
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 500,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(129, 140, 248, 0.45)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e1060',
        },
        horzLine: {
          color: 'rgba(129, 140, 248, 0.45)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e1060',
        },
      },
      timeScale: {
        ...CHART_OPTIONS.timeScale,
        ...themeOpts.timeScale,
        timeVisible: intervalRef.current !== '1d',
        secondsVisible: intervalRef.current === '1s' || intervalRef.current === '30s',
        tickMarkFormatter: (time) => {
          if (typeof time === 'number') {
            const tz = timezoneRef.current || 'Asia/Kolkata';
            const d = new Date(time * 1000);
            return d.toLocaleTimeString('en-IN', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
          }
          return String(time);
        },
      },
      localization: {
        dateFormat: 'yyyy-MM-dd',
        timeFormatter: (time) => {
          if (typeof time === 'number') {
            const tz = timezoneRef.current || 'Asia/Kolkata';
            const d = new Date(time * 1000);
            const curIv = intervalRef.current;
            return d.toLocaleTimeString('en-IN', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              second: (curIv === '1s' || curIv === '30s') ? '2-digit' : undefined,
              hour12: false,
            });
          }
          return String(time);
        },
      },
    });

    // Primary Price Series (Candles / Hollow / Bars / Line / Area / Baseline)
    const candleSeries = createPrimarySeries(chart, chartType, isCrypto);

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    indicatorSeriesRef.current = {};

    // Crosshair Move Event: Synchronize to sub-panes and update legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        isHoveringRef.current = false;
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        resetLegendRef.current();
        crosshairMoveRef.current({ x: null, time: null, source: 'main' });
        return;
      }

      isHoveringRef.current = true;
      const curPrimary = candleSeriesRef.current;
      const cData = curPrimary ? param.seriesData?.get(curPrimary) : null;

      // Broadcast position to sub-panes
      crosshairMoveRef.current({ x: param.point.x, time: param.time, source: 'main' });

      if (cData) {
        const hoveredCandle = candlesRef.current.find((c) => c.time === param.time);
        const o = cData.open !== undefined ? cData.open : hoveredCandle?.open;
        const h = cData.high !== undefined ? cData.high : hoveredCandle?.high;
        const l = cData.low !== undefined ? cData.low : hoveredCandle?.low;
        const c = cData.close !== undefined ? cData.close : (cData.value !== undefined ? cData.value : hoveredCandle?.close);
        const merged = {
          ...(hoveredCandle || {}),
          time: param.time,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: hoveredCandle?.volume,
        };
        updateLegendRef.current(merged);
      }
    });

    // TimeScale Range Synchronization + progressive-history trigger:
    // jab viewport loaded data ke left edge ke andar aa jaye (user history me
    // pan kar raha hai), parent se older candles mangwao. Threshold check
    // sasta hai (ek number compare) — debounce/guards parent me hain.
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) visibleRangeRef.current(range, 'main');
      if (range && typeof range.from === 'number' && range.from < BACKFILL_TRIGGER_BARS) {
        try { needOlderDataRef.current?.(); } catch {}
      }
    });

    // Chart Click Event (e.g. for Jump to Bar in Replay mode)
    chart.subscribeClick((param) => {
      if (param && param.time) {
        chartClickRef.current?.(param);
      }
    });

    // Resize Observer
    let hasFittedInitial = false;
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          try { chart.applyOptions({ width, height }); } catch { return; }
          if (!hasFittedInitial && candlesRef.current && candlesRef.current.length > 0) {
            hasFittedInitial = true;
            if (fitRaf != null) {
              try { cancelAnimationFrame(fitRaf); } catch {}
            }
            fitRaf = requestAnimationFrame(() => {
              if (disposed || chart.__isDisposed) return;
              try {
                const totalBars = candlesRef.current.length;
                const visibleCount = Math.min(totalBars, 80);
                chart.timeScale().setVisibleLogicalRange({
                  from: totalBars - visibleCount,
                  to: totalBars + 4,
                });
              } catch {}
            });
          }
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      if (fitRaf != null) { try { cancelAnimationFrame(fitRaf); } catch {} fitRaf = null; }
      resizeObserver.disconnect();
      try { chart.remove(); } catch {}
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      indicatorSeriesRef.current = {};
      smcSeriesRef.current = {};
      aiSeriesRef.current = {};
    };
  }, []);

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
  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles) || candles.length === 0) {
      return;
    }

    // Captured BEFORE setData: prepend restore needs the pre-replace range.
    let preRange = null;
    try {
      preRange = chartInstanceRef.current && !chartInstanceRef.current.__isDisposed
        ? chartInstanceRef.current.timeScale().getVisibleLogicalRange()
        : null;
    } catch {}

    try {
      // Defense-in-depth: LiveChartView already sorts/dedupes and drops
      // stale live buckets, but any out-of-order bar here would throw
      // "Assertion failed: data must be asc ordered by time" and crash the
      // app. Sanitize so setData always receives strictly ascending data.
      const rawFormatted = candles.map((c) => ({
        time: c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));
      const formattedCandles = sanitizeCandles(rawFormatted);
      if (formattedCandles.length === 0) return;

      if (['line', 'area', 'baseline'].includes(chartTypeRef.current)) {
        try {
          candleSeriesRef.current.setData(sanitizeSeriesData(
            formattedCandles.map(c => ({ time: c.time, value: Number(c.close) }))
          ));
        } catch {}
      } else {
        try {
          candleSeriesRef.current.setData(formattedCandles);
        } catch (e) {
          console.warn('Error setting chart data:', e);
        }
      }

      const byTime = new Map(formattedCandles.map((c) => [c.time, c]));
      candlesRef.current = candles
        .filter((c) => byTime.has(c.time))
        .map((c) => {
          const f = byTime.get(c.time);
          return { ...c, time: f.time, open: f.open, high: f.high, low: f.low, close: f.close };
        });
      // Ensure the imperative cache itself stays ascending (deduped above).
      candlesRef.current = sanitizeCandles(candlesRef.current);

      const totalBars = formattedCandles.length;
      const prev = candlesMetaRef.current;
      const newFirst = formattedCandles[0].time;
      const newLast = formattedCandles[totalBars - 1].time;
      const isSameDataset = prev.firstTime != null && newFirst === prev.firstTime;
      // Backfill prepend: same live edge, earlier start, strictly longer.
      const isPrepend = !isSameDataset && prev.lastTime != null
        && newLast === prev.lastTime && totalBars > prev.length;
      const prependShift = isPrepend ? totalBars - prev.length : 0;
      const isIncrementalAppend =
        isSameDataset &&
        totalBars >= prev.length &&
        totalBars - prev.length <= 2;
      candlesMetaRef.current = { firstTime: newFirst, lastTime: newLast, length: totalBars };

      if (isPrepend && preRange && totalBars > 0) {
        // Keep the user on the same bars they were viewing.
        try {
          chartInstanceRef.current.timeScale().setVisibleLogicalRange({
            from: preRange.from + prependShift,
            to: preRange.to + prependShift,
          });
        } catch {}
      } else if (!isSameDataset && totalBars > 0) {
        // Initial symbol/interval load: fit default 80 bars
        const visibleCount = Math.min(totalBars, 80);
        if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
          try {
            chartInstanceRef.current.timeScale().setVisibleLogicalRange({
              from: totalBars - visibleCount,
              to: totalBars + 4,
            });
            chartInstanceRef.current.priceScale('right').applyOptions({ autoScale: true });
          } catch {}
        }
      } else if (isSameDataset && chartInstanceRef.current && !chartInstanceRef.current.__isDisposed && totalBars > 0) {
        // Same dataset (replay stepping or live ticks): preserve user's zoom span
        try {
          const currentRange = chartInstanceRef.current.timeScale().getVisibleLogicalRange();
          if (currentRange) {
            const span = Math.max(10, currentRange.to - currentRange.from);
            // If the bar moves past the right viewport edge, smoothly follow forward
            if (totalBars >= currentRange.to - 2) {
              chartInstanceRef.current.timeScale().setVisibleLogicalRange({
                from: (totalBars + 4) - span,
                to: totalBars + 4,
              });
            } else if (totalBars < currentRange.from + 2) {
              // If stepping backwards past the left edge, bring into view
              chartInstanceRef.current.timeScale().setVisibleLogicalRange({
                from: Math.max(0, totalBars - Math.round(span * 0.7)),
                to: totalBars + Math.round(span * 0.3),
              });
            }
          }
        } catch (_) {}
      }

      // Match axis decimals to price magnitude (BTC 88125, not 88125.00).
      const lastClose = formattedCandles[formattedCandles.length - 1]?.close;
      syncSeriesPrecision(decimalsForPrice(lastClose, isCrypto));

      // Seed initial legend values
      resetLegendRef.current();
    } catch (err) {
      console.warn('Error setting chart data:', err);
    }
  }, [candles, isCrypto, syncSeriesPrecision]);

  // Tab-return restore: browsers may discard the canvas bitmap while the tab
  // is hidden, leaving a blank chart even though candle state is intact.
  // On return, re-apply the container size and re-push the last good data.
  useEffect(() => {
    const restore = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const chart = chartInstanceRef.current;
      const series = candleSeriesRef.current;
      const host = containerRef.current;
      if (!chart || chart.__isDisposed || !series || series.__isDisposed || !host) return;
      try {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w > 0 && h > 0) {
          if (typeof chart.resize === 'function') chart.resize(w, h);
          else chart.applyOptions({ width: w, height: h });
        }
      } catch {}
      try {
        const rows = candlesRef.current;
        if (Array.isArray(rows) && rows.length > 0) {
          const safe = sanitizeCandles(rows.map((c) => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          })));
          if (safe.length) {
            if (['line', 'area', 'baseline'].includes(chartTypeRef.current)) {
              series.setData(sanitizeSeriesData(
                safe.map((c) => ({ time: c.time, value: Number(c.close) })),
              ));
            } else {
              series.setData(safe);
            }
          }
        }
      } catch {}
    };
    document.addEventListener('visibilitychange', restore);
    window.addEventListener('pageshow', restore);
    window.addEventListener('focus', restore);
    return () => {
      document.removeEventListener('visibilitychange', restore);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('focus', restore);
    };
  }, []);

  // Dynamic Chart Type Switcher (Candles, Hollow, Bar, Line, Area, Baseline)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || chart.__isDisposed) return;

    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (candleSeriesRef.current) {
        chart.removeSeries(candleSeriesRef.current);
      }
      const newSeries = createPrimarySeries(chart, chartType, isCrypto);
      candleSeriesRef.current = newSeries;
      appliedPrecisionRef.current = null; // fresh series carries default format
      if (candlesRef.current && candlesRef.current.length > 0) {
        const lastC = candlesRef.current[candlesRef.current.length - 1];
        syncSeriesPrecision(decimalsForPrice(lastC?.close, isCrypto));
        try {
          const safe = sanitizeCandles(candlesRef.current.map(c => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          })));
          if (['line', 'area', 'baseline'].includes(chartType)) {
            newSeries.setData(sanitizeSeriesData(
              safe.map(c => ({ time: c.time, value: Number(c.close) }))
            ));
          } else if (safe.length) {
            newSeries.setData(safe);
          }
        } catch {}
      }

      if (range) {
        chart.timeScale().setVisibleLogicalRange(range);
      }
    } catch (err) {
      console.warn('Error switching chart type:', err);
    }
  }, [chartType, isCrypto, syncSeriesPrecision]);

  // Apply Price Scale Mode (Normal, Logarithmic, Percentage) & Invert
  useEffect(() => {
    if (!chartInstanceRef.current || chartInstanceRef.current.__isDisposed) return;
    try {
      const mode = priceScaleMode === 'log'
        ? PriceScaleMode.Logarithmic
        : priceScaleMode === 'percentage'
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal;

      chartInstanceRef.current.priceScale('right').applyOptions({
        mode,
        invertScale: !!invertScale,
        autoScale: true,
      });
    } catch (err) {
      console.warn('Error applying price scale mode:', err);
    }
  }, [priceScaleMode, invertScale]);

  // Dynamically manage and render Indicator Overlays
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || chart.__isDisposed || !candles || candles.length === 0) return;

    const currentSeriesMap = indicatorSeriesRef.current;

    // 1. Remove series that are no longer active
    Object.keys(currentSeriesMap).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const item = currentSeriesMap[id];
        if (Array.isArray(item)) {
          item.forEach((s) => { try { chart.removeSeries(s); } catch {} });
        } else if (item) {
          try { chart.removeSeries(item); } catch {}
        }
        delete currentSeriesMap[id];
      }
    });

    // Remove SMC overlays that are no longer active
    Object.keys(smcSeriesRef.current).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const group = smcSeriesRef.current[id];
        (group?.lineSeries || []).forEach((s) => { try { chart.removeSeries(s); } catch {} });
        delete smcSeriesRef.current[id];
      }
    });

    // Remove AI zone overlays that are no longer active
    Object.keys(aiZoneSeriesRef.current).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const group = aiZoneSeriesRef.current[id];
        (group?.lineSeries || []).forEach((s) => { try { chart.removeSeries(s); } catch {} });
        delete aiZoneSeriesRef.current[id];
      }
    });

    // 2. Add or update active overlay indicators
    // Advanced AI forecast joins via aiOverlay 'bands' (median ±1σ paths).
    overlayIndicators.forEach((def) => {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      const kind = def.type === 'ai' ? (def.aiOverlay || 'info') : def.type;

      // ── Standard single-line overlay ──────────────────────────────────────
      if (def.type === 'overlay') {
        let series = currentSeriesMap[id];
        if (!series) {
          series = chart.addLineSeries({
            color: def.color, lineWidth: def.lineWidth || 1.5,
            lineStyle: def.lineStyle ?? 0,
            priceLineVisible: false, lastValueVisible: true, title: def.shortName,
          });
          currentSeriesMap[id] = series;
        }
        series.applyOptions({ visible: !isHidden, color: def.color, lineWidth: def.lineWidth || 1.5, lineStyle: def.lineStyle ?? 0 });
        const data = resolveOverlayData(def, candles);
        if (data.length) engineValueRef.current[id] = data[data.length - 1].value;
        try { series.setData(data); } catch {}

      // ── AI forecast bands (median ±1σ path incl. future bars) ─────────────
      } else if (kind === 'bands') {
        let bandList = currentSeriesMap[id];
        if (!bandList) {
          const mkBand = (color, style, title) => chart.addLineSeries({
            color, lineWidth: 1.5, lineStyle: style,
            priceLineVisible: false, lastValueVisible: false, title,
          });
          bandList = [
            mkBand(def.color || '#FBBF24', 0, `${def.shortName} median`),
            mkBand('rgba(56,189,248,0.75)', 2, `${def.shortName} +1σ`),
            mkBand('rgba(56,189,248,0.75)', 2, `${def.shortName} −1σ`),
          ];
          // Median first for legend focus; bands carry no price line.
          bandList[0].applyOptions({ lineWidth: 2, lastValueVisible: true });
          currentSeriesMap[id] = bandList;
        }
        let fc = { median: [], upper: [], lower: [] };
        try {
          const res = calculateById(def.engineId || 'ai_forecast', candles, def.params || {});
          if (res.valid && res.points) fc = { median: [], upper: [], lower: [], ...res.points };
        } catch {}
        // Anchor the forecast lines to the last candle's close so the bands form a continuous probability cone
        const anchor = fc.anchor || (candles.length > 0 ? { time: candles[candles.length - 1].time, value: Number(candles[candles.length - 1].close) } : null);
        const anchorPt = (anchor && anchor.time != null && isFinite(anchor.value)) ? [{ time: anchor.time, value: Number(anchor.value) }] : [];

        const legs = [
          sanitizeSeriesData([...anchorPt, ...(fc.median || []).map((p) => ({ time: p.time, value: Number(p.value) }))]),
          sanitizeSeriesData([...anchorPt, ...(fc.upper || []).map((p) => ({ time: p.time, value: Number(p.value) }))]),
          sanitizeSeriesData([...anchorPt, ...(fc.lower || []).map((p) => ({ time: p.time, value: Number(p.value) }))]),
        ];
        bandList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          try { if (legs[idx].length) s.setData(legs[idx]); } catch {}
        });
        if (legs[0].length) engineValueRef.current[id] = legs[0][legs[0].length - 1].value;

      // ── Multi-line overlay (BB, KC, Donchian) ─────────────────────────────
      } else if (def.type === 'overlay_multi') {
        let seriesList = currentSeriesMap[id];
        if (!seriesList) {
          seriesList = def.subLines.map((sub) =>
            chart.addLineSeries({ color: sub.color, lineWidth: 1, lineStyle: sub.style || 0, priceLineVisible: false, lastValueVisible: false, title: `${def.shortName} ${sub.label}` })
          );
          currentSeriesMap[id] = seriesList;
        }
        seriesList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const sub = def.subLines[idx];
          const data = sanitizeSeriesData(candles.filter((c) => c[sub.field] != null && !isNaN(Number(c[sub.field]))).map((c) => ({ time: c.time, value: Number(c[sub.field]) })));
          try { s.setData(data); } catch {}
        });

      // ── Levels overlay (Pivot Points, Fibonacci) ───────────────────────────
      } else if (def.type === 'levels') {
        let seriesList = currentSeriesMap[id];
        if (!seriesList) {
          seriesList = def.levels.map((lvl) =>
            chart.addLineSeries({ color: lvl.color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: true, title: lvl.label })
          );
          currentSeriesMap[id] = seriesList;
        }
        seriesList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const lvl = def.levels[idx];
          const data = sanitizeSeriesData(candles.filter((c) => c[lvl.field] != null && !isNaN(Number(c[lvl.field]))).map((c) => ({ time: c.time, value: Number(c[lvl.field]) })));
          try { s.setData(data); } catch {}
        });

      // ── Supertrend — clean continuous line with reversal signal markers ───
      } else if (def.type === 'overlay_supertrend') {
        let stSeries = currentSeriesMap[id];
        if (!stSeries) {
          stSeries = chart.addLineSeries({
            color: '#10B981',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Supertrend',
          });
          currentSeriesMap[id] = stSeries;
        }
        stSeries.applyOptions({ visible: !isHidden });

        // Continuous data for Supertrend line
        const stData = sanitizeSeriesData(candles
          .filter((c) => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map((c) => ({ time: c.time, value: Number(c[def.field]) })));
        try { stSeries.setData(stData); } catch {}

        // Set series color according to latest candle trend direction
        if (candles.length > 0) {
          const latestCandle = candles[candles.length - 1];
          const latestDir = Number(latestCandle[def.dirField]);
          stSeries.applyOptions({ color: latestDir === -1 ? '#EF5350' : '#10B981' });
        }

        // Reversal buy/sell signal markers at exact trend flips
        const markers = [];
        let prevDir = null;
        sanitizeCandles(candles).forEach((c) => {
          if (c[def.field] == null || isNaN(Number(c[def.field])) || c[def.dirField] == null) return;
          const dir = Number(c[def.dirField]);
          if (prevDir !== null && dir !== prevDir) {
            markers.push({
              time: c.time,
              position: dir === 1 ? 'belowBar' : 'aboveBar',
              color: dir === 1 ? '#10B981' : '#EF5350',
              shape: dir === 1 ? 'arrowUp' : 'arrowDown',
              text: dir === 1 ? 'BUY' : 'SELL',
              size: 1,
            });
          }
          prevDir = dir;
        });
        try { stSeries.setMarkers(markers); } catch {}

      // ── Parabolic SAR — clean amber dotted trailing stop line ─────────────
      } else if (def.type === 'overlay_psar') {
        let psarSeries = currentSeriesMap[id];
        if (!psarSeries) {
          psarSeries = chart.addLineSeries({
            color: '#F59E0B',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'PSAR',
          });
          currentSeriesMap[id] = psarSeries;
        }
        psarSeries.applyOptions({ visible: !isHidden });
        const psarData = sanitizeSeriesData(candles
          .filter(c => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map(c => ({ time: c.time, value: Number(c[def.field]) })));
        try { psarSeries.setData(psarData); } catch {}


      // ── Ichimoku Cloud — 5 lines ──────────────────────────────────────────
      } else if (def.type === 'overlay_ichimoku') {
        let ichiList = currentSeriesMap[id];
        if (!ichiList) {
          ichiList = def.subLines.map((sub) =>
            chart.addLineSeries({
              color: sub.color, lineWidth: sub.label.includes('Senkou') ? 1 : 1.5,
              lineStyle: sub.label === 'Chikou' ? 2 : 0,
              priceLineVisible: false, lastValueVisible: false, title: sub.label,
            })
          );
          currentSeriesMap[id] = ichiList;
        }
        ichiList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const sub = def.subLines[idx];
          const data = sanitizeSeriesData(candles
            .filter(c => c[sub.field] != null && !isNaN(Number(c[sub.field])))
            .map(c => ({ time: c.time, value: Number(c[sub.field]) })));
          try { s.setData(data); } catch {}
        });
      }
    });

    // 3. Render Market Structure / SMC overlays
    smcIndicators.forEach((def) => {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      let group = smcSeriesRef.current[id];
      if (!group) {
        group = { lineSeries: [] };
        smcSeriesRef.current[id] = group;
      }

      const items = detectSMC(def.smcType, candles, def.params || {});
      const lines = [];

      // Translate zone descriptors and point levels into horizontal price lines.
      items.forEach((item) => {
        if (item.top != null && item.bottom != null) {
          const zoneColor = item.color || def.color;
          lines.push({ price: item.top, color: zoneColor, label: item.label, lineWidth: 1, lineStyle: 2 });
          lines.push({ price: item.bottom, color: zoneColor, label: undefined, lineWidth: 1, lineStyle: 2 });
        } else if (item.price != null && isFinite(Number(item.price))) {
          lines.push({ price: item.price, color: item.color || def.color, label: item.label, lineWidth: 1, lineStyle: 2 });
        }
      });

      // Reconcile price-line series count
      const lineSeries = group.lineSeries;
      while (lineSeries.length > lines.length) {
        const s = lineSeries.pop();
        try { chart.removeSeries(s); } catch {}
      }
      while (lineSeries.length < lines.length) {
        const s = chart.addLineSeries({ color: '#888', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        lineSeries.push(s);
      }
      lineSeries.forEach((s, idx) => {
        const cfgLine = lines[idx];
        if (!cfgLine) return;
        s.applyOptions({ color: cfgLine.color, lineWidth: cfgLine.lineWidth, lineStyle: cfgLine.lineStyle, lastValueVisible: !!cfgLine.label });
        s.applyOptions({ visible: !isHidden });
        try {
          const safeRange = sanitizeSeriesData([
            { time: candles[0].time, value: cfgLine.price },
            { time: candles[candles.length - 1].time, value: cfgLine.price },
          ]);
          if (safeRange.length > 0) s.setData(safeRange);
        } catch {}
        if (cfgLine.label) {
          try {
            s.setMarkers([{ time: candles[candles.length - 1].time, position: 'inBar', color: cfgLine.color, shape: 'circle', text: cfgLine.label, size: 1 }]);
          } catch {}
        }
      });
    });

    // 3b. Advanced AI S/R zones — fractal pivots clustered in ATR tolerance,
    // scored by touches + volume + recency. Labeled lines span the full range.
    aiZoneIndicators.forEach((def) => {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      let group = aiZoneSeriesRef.current[id];
      if (!group) {
        group = { lineSeries: [] };
        aiZoneSeriesRef.current[id] = group;
      }
      let zones = [];
      try {
        zones = getAISupportResistance(candles, def.params || {});
      } catch {}
      const lineSeries = group.lineSeries;
      while (lineSeries.length > zones.length) {
        const s = lineSeries.pop();
        try { chart.removeSeries(s); } catch {}
      }
      while (lineSeries.length < zones.length) {
        lineSeries.push(chart.addLineSeries({ color: '#888', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }));
      }
      lineSeries.forEach((s, idx) => {
        const z = zones[idx];
        if (!z) return;
        const zColor = z.side === 'S' ? '#10B981' : '#EF5350';
        const label = `${z.side} ${Math.round(z.strength)}`;
        s.applyOptions({ color: zColor, lineWidth: z.strength >= 70 ? 2 : 1, lineStyle: 2, lastValueVisible: true });
        s.applyOptions({ visible: !isHidden });
        try {
          const safeRange = sanitizeSeriesData([
            { time: candles[0].time, value: z.price },
            { time: candles[candles.length - 1].time, value: z.price },
          ]);
          if (safeRange.length > 0) s.setData(safeRange);
        } catch {}
        try {
          s.setMarkers([{ time: candles[candles.length - 1].time, position: 'inBar', color: zColor, shape: 'circle', text: label, size: 1 }]);
        } catch {}
      });
    });

    // Remove AI overlays that are no longer active
    Object.keys(aiSeriesRef.current).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const g = aiSeriesRef.current[id];
        (g?.lineSeries || []).forEach((ser) => { try { chart.removeSeries(ser); } catch {} });
        delete aiSeriesRef.current[id];
      }
    });

    // 4. Render AI overlays (type 'ai' with chartOverlay flag) — real price
    // levels from analyzeSignal: Entry/SL/TP lines + direction marker, AI S/R.
    aiOverlays.forEach((def) => {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      let group = aiSeriesRef.current[id];
      if (!group) {
        group = { lineSeries: [] };
        aiSeriesRef.current[id] = group;
      }

      const firstC = candles[0];
      const lastC = candles[candles.length - 1];
      const sig = analyzeSignal(candles);

      // Signal price levels (Entry/SL/TP) + current-direction marker.
      // (Advanced ai_sr zones render in the dedicated AI-zones block below.)
      if (sig.available && sig.entry != null) {
        const bullish = sig.direction !== 'sell';
        const dirInfo = sig.direction === 'buy'
          ? { color: '#10B981', label: 'BUY', shape: 'arrowUp' }
          : sig.direction === 'sell'
            ? { color: '#EF5350', label: 'SELL', shape: 'arrowDown' }
            : { color: '#F59E0B', label: 'NEUTRAL', shape: 'circle' };
        const lines = [
          { price: sig.entry, color: '#E2E8F0', label: 'AI Entry', style: 0 },
          { price: sig.stopLoss, color: '#EF5350', label: 'AI SL', style: 2 },
          { price: sig.takeProfit, color: '#10B981', label: 'AI TP', style: 2 },
        ];
        const want = lines.length + 1; // slot 0 hosts the direction marker
        while (group.lineSeries.length < want) {
          group.lineSeries.push(chart.addLineSeries({ color: '#888', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }));
        }
        while (group.lineSeries.length > want) {
          const extra = group.lineSeries.pop();
          try { chart.removeSeries(extra); } catch {}
        }
        group.lineSeries.forEach((ser, idx) => {
          ser.applyOptions({ visible: !isHidden });
          if (idx === 0) { try { ser.setData([]); } catch {} return; }
          const cfg = lines[idx - 1];
          if (!cfg) { try { ser.setData([]); } catch {} return; }
          ser.applyOptions({ color: cfg.color, lineStyle: cfg.style, lastValueVisible: false });
          try {
            ser.setData(sanitizeSeriesData([{ time: firstC.time, value: cfg.price }, { time: lastC.time, value: cfg.price }]));
          } catch {}
        });
        try {
          group.lineSeries[0].setMarkers([{
            time: lastC.time,
            position: bullish ? 'belowBar' : 'aboveBar',
            color: dirInfo.color,
            shape: dirInfo.shape,
            text: dirInfo.label + ' ' + sig.probability + '%',
            size: 1,
          }]);
        } catch {}
      } else {
        // Signal unavailable — clear stale levels.
        group.lineSeries.forEach((ser) => { try { ser.setData([]); ser.setMarkers([]); } catch {} });
      }
    });

    resetLegendRef.current();
  }, [activeIndicators, hiddenIndicators, overlayIndicators, smcIndicators, aiOverlays, aiZoneIndicators, candles]);

  // Advanced AI markers (breakout BRK / exhaustion EXH / pattern shapes),
  // merged onto the primary price series. Re-applied on chart-type switches
  // (which recreate the primary series) and every data rollover.
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || series.__isDisposed) return;
    if (!aiMarkerIndicators.length || !candlesRef.current?.length) {
      try { series.setMarkers([]); } catch {}
      return;
    }
    const resolvers = {
      ai_breakout: getAIBreakoutMarkers,
      ai_reversal: getAIReversalMarkers,
      ai_pattern: getAIPatternMarkers,
    };
    const merged = [];
    aiMarkerIndicators.forEach((def) => {
      const fn = resolvers[def.id];
      if (!fn) return;
      try {
        const ms = fn(candlesRef.current, def.params || {}) || [];
        ms.forEach((m) => { if (m && m.time != null) merged.push(m); });
      } catch {}
    });
    merged.sort((a, b) => compareChartTime(a.time, b.time));
    try { series.setMarkers(merged); } catch {}
  }, [candles, aiMarkerIndicators, chartType]);

  // On-Chart Paper Trading Position Lines (Entry, Stop Loss, Target Price)
  useEffect(() => {
    const series = candleSeriesRef.current;
    const lines = paperPriceLinesRef.current;

    // Clean up previous price lines
    if (lines.entry && series) {
      try { series.removePriceLine(lines.entry); } catch {}
      lines.entry = null;
    }
    if (lines.stopLoss && series) {
      try { series.removePriceLine(lines.stopLoss); } catch {}
      lines.stopLoss = null;
    }
    if (lines.target && series) {
      try { series.removePriceLine(lines.target); } catch {}
      lines.target = null;
    }

    if (!series || series.__isDisposed || !paperPosition) return;
    const posTicker = String(paperPosition.ticker || '').toUpperCase().trim();
    const curTicker = String(selectedSymbol || '').toUpperCase().trim();
    if (posTicker !== curTicker) return;

    try {
      const entryPrice = Number(paperPosition.avg_buy_price || 0);
      if (entryPrice > 0) {
        const curP = Number(livePrice || paperPosition.current_price || entryPrice);
        const pnl = Math.round((curP - entryPrice) * paperPosition.shares * 100) / 100;
        const pnlPct = Math.round(((curP - entryPrice) / Math.max(0.01, entryPrice)) * 10000) / 100;
        const isProfit = pnl >= 0;
        const sign = isProfit ? '+' : '';

        lines.entry = series.createPriceLine({
          price: entryPrice,
          color: isProfit ? '#10B981' : '#EF4444',
          lineWidth: 2,
          lineStyle: LineStyle ? LineStyle.Solid : 0,
          axisLabelVisible: true,
          title: `LONG ${paperPosition.shares} @ ₹${entryPrice.toFixed(1)} | P&L: ${sign}₹${pnl.toLocaleString('en-IN')} (${sign}${pnlPct}%)`,
        });

        if (paperPosition.stop_loss) {
          const slP = Number(paperPosition.stop_loss);
          const slLoss = Math.round((slP - entryPrice) * paperPosition.shares * 100) / 100;
          lines.stopLoss = series.createPriceLine({
            price: slP,
            color: '#F43F5E',
            lineWidth: 1,
            lineStyle: LineStyle ? LineStyle.Dashed : 2,
            axisLabelVisible: true,
            title: `SL: ₹${slP.toFixed(1)} (${slLoss >= 0 ? '+' : ''}₹${slLoss})`,
          });
        }

        if (paperPosition.target_price) {
          const tpP = Number(paperPosition.target_price);
          const tpGain = Math.round((tpP - entryPrice) * paperPosition.shares * 100) / 100;
          lines.target = series.createPriceLine({
            price: tpP,
            color: '#10B981',
            lineWidth: 1,
            lineStyle: LineStyle ? LineStyle.Dashed : 2,
            axisLabelVisible: true,
            title: `TP: ₹${tpP.toFixed(1)} (+₹${tpGain})`,
          });
        }
      }
    } catch (err) {
      console.warn('Error rendering paper trade price lines:', err);
    }

    return () => {
      if (lines.entry && series) {
        try { series.removePriceLine(lines.entry); } catch {}
        lines.entry = null;
      }
      if (lines.stopLoss && series) {
        try { series.removePriceLine(lines.stopLoss); } catch {}
        lines.stopLoss = null;
      }
      if (lines.target && series) {
        try { series.removePriceLine(lines.target); } catch {}
        lines.target = null;
      }
    };
  }, [paperPosition, livePrice, selectedSymbol, chartType]);

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
          borderLeft: '1px dashed rgba(129, 140, 248, 0.45)',
          pointerEvents: 'none',
          display: 'none',
          zIndex: 14,
        }}
      />

      {/* Active overlay indicator controls remain available over the chart. */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          pointerEvents: 'auto',
          maxWidth: 'calc(100% - 90px)',
        }}
      >
        {overlayIndicators.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {overlayIndicators.map((ind) => {
              const isHidden = hiddenIndicators.includes(ind.id);
              return (
                <div
                  key={ind.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 7px',
                    borderRadius: 4,
                    backgroundColor: tk.legendBg,
                    backdropFilter: 'blur(6px)',
                    border: `1px solid ${isHidden ? 'rgba(100, 116, 139, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`,
                    fontSize: '0.68rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: isHidden ? '#64748B' : tk.legendText,
                    opacity: isHidden ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: ind.color,
                      opacity: isHidden ? 0.4 : 1,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 700, color: isHidden ? '#64748B' : tk.legendMuted }}>
                    {ind.shortName}
                  </span>
                  <span
                    ref={(el) => {
                      if (el) indicatorValRefs.current[ind.id] = el;
                    }}
                    style={{
                      fontWeight: 800,
                      color: isHidden ? '#64748B' : ind.color,
                      minWidth: 40,
                    }}
                  >
                    —
                  </span>

                  {/* Hide / Show Eye Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHideIndicator(ind.id);
                    }}
                    title={isHidden ? 'Show indicator' : 'Hide indicator'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isHidden ? '#64748B' : tk.legendMuted,
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = theme === 'light' ? '#0F172A' : '#F1F5F9')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = isHidden ? '#64748B' : tk.legendMuted)}
                  >
                    {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>

                  {/* Remove (X) Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveIndicator(ind.id);
                    }}
                    title="Remove indicator"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#EF5350')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Main Lightweight Charts Canvas */}
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

// Memoized: parent (LiveChartView) no longer re-renders per tick, but this
// guards the canvas tree (legend/overlays) against any residual prop churn.
// livePrice is throttled upstream (2s) for paper P&L lines; candles identity
// only changes on bucket rollover / history load, so shallow array compare is
// sufficient and cheap.
function chartCanvasPropsEqual(prev, next) {
  if (prev.candles !== next.candles) {
    if (!Array.isArray(prev.candles) || !Array.isArray(next.candles)) return false;
    if (prev.candles.length !== next.candles.length) return false;
    const a = prev.candles;
    const b = next.candles;
    if (a.length === 0) return true;
    // Compare first/last bar identity + close — full deep compare on 7k rows
    // per render would defeat the memo.
    const firstA = a[0]; const firstB = b[0];
    const lastA = a[a.length - 1]; const lastB = b[b.length - 1];
    if (firstA?.time !== firstB?.time || lastA?.time !== lastB?.time) return false;
    if (Number(lastA?.close) !== Number(lastB?.close)) return false;
  }
  const keys = ['interval', 'selectedSymbol', 'chartType', 'priceScaleMode', 'invertScale', 'showVolume', 'timezone', 'livePrice', 'liveChange', 'paperPosition'];
  for (const k of keys) {
    if (k === 'paperPosition') {
      const pa = prev.paperPosition; const pb = next.paperPosition;
      if (pa === pb) continue;
      if (!pa || !pb) return false;
      if (pa.ticker !== pb.ticker || Number(pa.current_price) !== Number(pb.current_price) || pa.shares !== pb.shares) return false;
      continue;
    }
    if (prev[k] !== next[k]) return false;
  }
  if (prev.activeIndicators !== next.activeIndicators || prev.hiddenIndicators !== next.hiddenIndicators || prev.indicatorOverrides !== next.indicatorOverrides) return false;
  // Callbacks are stable useCallbacks in the parent; ref-compare them.
  if (prev.onVisibleRangeChange !== next.onVisibleRangeChange) return false;
  if (prev.onCrosshairMove !== next.onCrosshairMove) return false;
  if (prev.onChartClick !== next.onChartClick) return false;
  if (prev.onNeedOlderData !== next.onNeedOlderData) return false;
  if (prev.onToggleHideIndicator !== next.onToggleHideIndicator) return false;
  if (prev.onRemoveIndicator !== next.onRemoveIndicator) return false;
  return true;
}

export default memo(ChartCanvas, chartCanvasPropsEqual);
