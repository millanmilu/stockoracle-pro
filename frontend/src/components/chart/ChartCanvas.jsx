import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { createChart, CrosshairMode, PriceScaleMode } from 'lightweight-charts';
import { Eye, EyeOff, X } from 'lucide-react';
import { CHART_OPTIONS, CANDLE_STYLE, isCryptoSymbol, subscribeLiveTick } from '../../utils/chartHelpers';
import { INDICATOR_DEFINITIONS } from './indicatorDefinitions';

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
 * Format indicator value for display in the legend badge
 */
function formatIndicatorValue(def, candle, currSym = '₹') {
  if (!candle || !def) return '—';
  if (def.type === 'overlay') {
    const val = candle[def.field];
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
  const generic = candle[def.field];
  return generic != null && !isNaN(Number(generic)) ? Number(generic).toFixed(2) : '—';
}


/**
 * Creates primary price series based on chart type
 */
function createPrimarySeries(chart, type, isCrypto) {
  const minMove = isCrypto ? 0.01 : 0.05;
  if (type === 'hollow') {
    return chart.addCandlestickSeries({
      ...CANDLE_STYLE,
      upColor: 'transparent',
      borderUpColor: '#26A69A',
      wickUpColor: '#26A69A',
      downColor: '#EF5350',
      borderDownColor: '#EF5350',
      wickDownColor: '#EF5350',
      priceFormat: { type: 'price', precision: 2, minMove },
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
      priceFormat: { type: 'price', precision: 2, minMove },
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
      priceFormat: { type: 'price', precision: 2, minMove },
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
      priceFormat: { type: 'price', precision: 2, minMove },
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
      priceFormat: { type: 'price', precision: 2, minMove },
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: 2,
    });
  }
  // Default 'candlestick'
  return chart.addCandlestickSeries({
    ...CANDLE_STYLE,
    priceFormat: { type: 'price', precision: 2, minMove },
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
  onToggleHideIndicator = () => {},
  onRemoveIndicator = () => {},
  onVisibleRangeChange = () => {},
  onCrosshairMove = () => {},
}, ref) {
  const containerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const syncedHairlineRef = useRef(null);
  const indicatorSeriesRef = useRef({}); // id -> series or array of series
  const chartTypeRef = useRef(chartType);
  chartTypeRef.current = chartType;

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
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);


  // Filter active indicators to only include overlays (not oscillators which live in sub-panes)
  const overlayIndicators = useMemo(() => {
    return activeIndicators
      .map(id => INDICATOR_DEFINITIONS.find(item => item.id === id))
      .filter(item => item && item.type !== 'oscillator');
  }, [activeIndicators]);

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

    if (openRef.current && !isNaN(o)) openRef.current.textContent = `${currSym}${o.toFixed(2)}`;
    if (highRef.current && !isNaN(h)) highRef.current.textContent = `${currSym}${h.toFixed(2)}`;
    if (lowRef.current && !isNaN(l)) lowRef.current.textContent = `${currSym}${l.toFixed(2)}`;
    if (closeRef.current && !isNaN(c)) closeRef.current.textContent = `${currSym}${c.toFixed(2)}`;

    const diff = c - o;
    const chgPct = o > 0 ? (diff / o) * 100 : 0;
    const isUp = diff >= 0;
    const sign = isUp ? '+' : '';
    if (chgRef.current && !isNaN(diff)) {
      chgRef.current.textContent = `${sign}${currSym}${diff.toFixed(2)} (${sign}${chgPct.toFixed(2)}%)`;
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
        el.textContent = formatIndicatorValue(ind, candle, currSym);
      }
    });
  }, [overlayIndicators, currSym]);

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

  // Expose imperative methods to parent controller
  useImperativeHandle(ref, () => ({
    fitContent: () => {
      if (chartInstanceRef.current) {
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
      if (candleSeriesRef.current && candle && candle.time) {
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
              candlesRef.current.push({ ...candle, open: o, high: h, low: l, close: c });
              if (!isHoveringRef.current) {
                try {
                  chartInstanceRef.current?.timeScale().scrollToRealtime();
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
      if (chartInstanceRef.current && range) {
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
    getChart: () => chartInstanceRef.current,
    getCandleSeries: () => candleSeriesRef.current,
    getPriceCoordinate: (price) => {
      if (!candleSeriesRef.current || price == null) return null;
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

    containerRef.current.innerHTML = '';

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
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
        timeVisible: interval !== '1d',
        secondsVisible: interval === '1s' || interval === '30s',
        tickMarkFormatter: (time) => {
          if (typeof time === 'number') {
            const tz = timezone || 'Asia/Kolkata';
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
            const tz = timezone || 'Asia/Kolkata';
            const d = new Date(time * 1000);
            return d.toLocaleTimeString('en-IN', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              second: (interval === '1s' || interval === '30s') ? '2-digit' : undefined,
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

    // TimeScale Range Synchronization
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) visibleRangeRef.current(range, 'main');
    });

    // Resize Observer
    let hasFittedInitial = false;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          if (!hasFittedInitial && candlesRef.current && candlesRef.current.length > 0) {
            hasFittedInitial = true;
            requestAnimationFrame(() => {
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
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      indicatorSeriesRef.current = {};
    };
  }, [interval]);

  // Update timeScale options when interval changes
  useEffect(() => {
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.timeScale().applyOptions({
          timeVisible: interval !== '1d',
          secondsVisible: interval === '1s' || interval === '30s',
        });
      } catch {}
    }
  }, [interval]);

  // Load Historical Candles into Series
  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles) || candles.length === 0) {
      return;
    }

    try {
      const formattedCandles = candles.map((c) => ({
        time: c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

      if (['line', 'area', 'baseline'].includes(chartTypeRef.current)) {
        candleSeriesRef.current.setData(candles.map(c => ({ time: c.time, value: Number(c.close) })));
      } else {
        candleSeriesRef.current.setData(formattedCandles);
      }

      candlesRef.current = formattedCandles;

      const totalBars = formattedCandles.length;
      if (totalBars > 0) {
        const visibleCount = Math.min(totalBars, 80);
        chartInstanceRef.current?.timeScale().setVisibleLogicalRange({
          from: totalBars - visibleCount,
          to: totalBars + 4,
        });
        chartInstanceRef.current?.priceScale('right').applyOptions({ autoScale: true });
      }

      // Seed initial legend values
      resetLegendRef.current();
    } catch (err) {
      console.warn('Error setting chart data:', err);
    }
  }, [candles]);

  // Dynamic Chart Type Switcher (Candles, Hollow, Bar, Line, Area, Baseline)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (candleSeriesRef.current) {
        chart.removeSeries(candleSeriesRef.current);
      }
      const newSeries = createPrimarySeries(chart, chartType, isCrypto);
      candleSeriesRef.current = newSeries;

      if (candlesRef.current && candlesRef.current.length > 0) {
        if (['line', 'area', 'baseline'].includes(chartType)) {
          newSeries.setData(candlesRef.current.map(c => ({
            time: c.time,
            value: Number(c.close),
          })));
        } else {
          newSeries.setData(candlesRef.current.map(c => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          })));
        }
      }

      if (range) {
        chart.timeScale().setVisibleLogicalRange(range);
      }
    } catch (err) {
      console.warn('Error switching chart type:', err);
    }
  }, [chartType, isCrypto]);

  // Apply Price Scale Mode (Normal, Logarithmic, Percentage) & Invert
  useEffect(() => {
    if (!chartInstanceRef.current) return;
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
    if (!chart || !candles || candles.length === 0) return;

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

    // 2. Add or update active overlay indicators
    overlayIndicators.forEach((def) => {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);

      // ── Standard single-line overlay ──────────────────────────────────────
      if (def.type === 'overlay') {
        let series = currentSeriesMap[id];
        if (!series) {
          series = chart.addLineSeries({
            color: def.color, lineWidth: def.lineWidth || 1.5,
            priceLineVisible: false, lastValueVisible: true, title: def.shortName,
          });
          currentSeriesMap[id] = series;
        }
        series.applyOptions({ visible: !isHidden });
        const data = candles
          .filter((c) => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map((c) => ({ time: c.time, value: Number(c[def.field]) }));
        try { series.setData(data); } catch {}

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
          const data = candles.filter((c) => c[sub.field] != null && !isNaN(Number(c[sub.field]))).map((c) => ({ time: c.time, value: Number(c[sub.field]) }));
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
          const data = candles.filter((c) => c[lvl.field] != null && !isNaN(Number(c[lvl.field]))).map((c) => ({ time: c.time, value: Number(c[lvl.field]) }));
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
        const stData = candles
          .filter((c) => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map((c) => ({ time: c.time, value: Number(c[def.field]) }));
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
        candles.forEach((c) => {
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
        const psarData = candles
          .filter(c => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map(c => ({ time: c.time, value: Number(c[def.field]) }));
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
          const data = candles
            .filter(c => c[sub.field] != null && !isNaN(Number(c[sub.field])))
            .map(c => ({ time: c.time, value: Number(c[sub.field]) }));
          try { s.setData(data); } catch {}
        });
      }
    });

    resetLegendRef.current();
  }, [activeIndicators, hiddenIndicators, overlayIndicators, candles]);

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
                    backgroundColor: 'rgba(11, 15, 28, 0.88)',
                    backdropFilter: 'blur(6px)',
                    border: `1px solid ${isHidden ? 'rgba(100, 116, 139, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`,
                    fontSize: '0.68rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: isHidden ? '#64748B' : '#E2E8F0',
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
                  <span style={{ fontWeight: 700, color: isHidden ? '#64748B' : '#94A3B8' }}>
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
                      color: isHidden ? '#64748B' : '#94A3B8',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F5F9')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = isHidden ? '#64748B' : '#94A3B8')}
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

export default ChartCanvas;
