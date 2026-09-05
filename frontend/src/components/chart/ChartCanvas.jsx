import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { Eye, EyeOff, X } from 'lucide-react';
import { CHART_OPTIONS, CANDLE_STYLE } from '../../utils/chartHelpers';
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
function formatIndicatorValue(def, candle) {
  if (!candle || !def) return '—';
  if (def.type === 'overlay') {
    const val = candle[def.field];
    if (val == null || isNaN(Number(val))) return '—';
    return `₹${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_multi') {
    const u = candle.bb_upper;
    const m = candle.bb_middle;
    const l = candle.bb_lower;
    if (m == null || isNaN(Number(m))) return '—';
    return `B:${Number(m).toFixed(1)} U:${Number(u).toFixed(1)} L:${Number(l).toFixed(1)}`;
  }
  if (def.type === 'levels') {
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
  const volumeSeriesRef = useRef(null);
  const syncedHairlineRef = useRef(null);
  const indicatorSeriesRef = useRef({}); // id -> series or array of series

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

  // Filter active indicators to only include overlays (not oscillators like RSI/MACD which live in sub-panes)
  const overlayIndicators = useMemo(() => {
    return activeIndicators
      .map(id => INDICATOR_DEFINITIONS.find(item => item.id === id))
      .filter(item => item && item.type !== 'oscillator');
  }, [activeIndicators]);

  // Update top-left legend in DOM at 0ms latency
  const updateLegend = useCallback((candle) => {
    if (!candle) return;
    const o = Number(candle.open);
    const h = Number(candle.high);
    const l = Number(candle.low);
    const c = Number(candle.close);
    const v = Number(candle.volume || 0);

    if (openRef.current && !isNaN(o)) openRef.current.textContent = `₹${o.toFixed(2)}`;
    if (highRef.current && !isNaN(h)) highRef.current.textContent = `₹${h.toFixed(2)}`;
    if (lowRef.current && !isNaN(l)) lowRef.current.textContent = `₹${l.toFixed(2)}`;
    if (closeRef.current && !isNaN(c)) closeRef.current.textContent = `₹${c.toFixed(2)}`;

    const diff = c - o;
    const chgPct = o > 0 ? (diff / o) * 100 : 0;
    const isUp = diff >= 0;
    const sign = isUp ? '+' : '';
    if (chgRef.current && !isNaN(diff)) {
      chgRef.current.textContent = `${sign}₹${diff.toFixed(2)} (${sign}${chgPct.toFixed(2)}%)`;
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
        el.textContent = formatIndicatorValue(ind, candle);
      }
    });
  }, [overlayIndicators]);

  // Reset legend to latest candle or active candle
  const resetLegendToLatest = useCallback(() => {
    const latest = activeCandleRef?.current || (candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length - 1] : null);
    if (latest) {
      updateLegend(latest);
    }
  }, [activeCandleRef, updateLegend]);

  // Expose imperative methods to parent controller
  useImperativeHandle(ref, () => ({
    fitContent: () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.timeScale().fitContent();
        } catch {}
      }
    },
    updateActiveCandle: (candle) => {
      if (candleSeriesRef.current && candle) {
        try {
          candleSeriesRef.current.update({
            time: candle.time,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
          });
          if (volumeSeriesRef.current && candle.volume != null) {
            volumeSeriesRef.current.update({
              time: candle.time,
              value: Number(candle.volume || 0),
              color: candle.close >= candle.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
            });
          }
          if (!isHoveringRef.current) {
            updateLegend(candle);
          }
        } catch {}
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
  }), [updateLegend, resetLegendToLatest, activeCandleRef]);

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
      },
    });

    // Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      ...CANDLE_STYLE,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.05,
      },
    });

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume_scale',
    });

    chart.priceScale('volume_scale').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    indicatorSeriesRef.current = {};

    // Crosshair Move Event: Synchronize to sub-panes and update legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        isHoveringRef.current = false;
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        resetLegendToLatest();
        onCrosshairMove({ x: null, time: null, source: 'main' });
        return;
      }

      isHoveringRef.current = true;
      const cData = param.seriesData?.get(candleSeries);
      const vData = param.seriesData?.get(volumeSeries);

      // Broadcast position to sub-panes
      onCrosshairMove({ x: param.point.x, time: param.time, source: 'main' });

      if (cData) {
        const hoveredCandle = candlesRef.current.find((c) => c.time === param.time);
        const merged = {
          ...(hoveredCandle || {}),
          time: param.time,
          open: cData.open,
          high: cData.high,
          low: cData.low,
          close: cData.close,
          volume: vData?.value ?? hoveredCandle?.volume,
        };
        updateLegend(merged);
      }
    });

    // TimeScale Range Synchronization
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) onVisibleRangeChange(range, 'main');
    });

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current = {};
    };
  }, [interval, updateLegend, resetLegendToLatest, onVisibleRangeChange, onCrosshairMove]);

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
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !Array.isArray(candles) || candles.length === 0) {
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

      const formattedVolumes = candles.map((c) => ({
        time: c.time,
        value: Number(c.volume || 0),
        color: Number(c.close) >= Number(c.open) ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
      }));

      candleSeriesRef.current.setData(formattedCandles);
      volumeSeriesRef.current.setData(formattedVolumes);

      if (formattedCandles.length > 150) {
        const total = formattedCandles.length;
        chartInstanceRef.current?.timeScale().setVisibleLogicalRange({
          from: total - 120,
          to: total + 5,
        });
      } else {
        chartInstanceRef.current?.timeScale().fitContent();
      }

      // Seed initial legend values
      resetLegendToLatest();
    } catch (err) {
      console.warn('Error setting chart data:', err);
    }
  }, [candles, resetLegendToLatest]);

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
          item.forEach((s) => {
            try { chart.removeSeries(s); } catch {}
          });
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

      if (def.type === 'overlay') {
        let series = currentSeriesMap[id];
        if (!series) {
          series = chart.addLineSeries({
            color: def.color,
            lineWidth: def.lineWidth || 1.5,
            priceLineVisible: false,
            lastValueVisible: true,
            title: def.shortName,
          });
          currentSeriesMap[id] = series;
        }

        series.applyOptions({ visible: !isHidden });

        const data = candles
          .filter((c) => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map((c) => ({
            time: c.time,
            value: Number(c[def.field]),
          }));

        try { series.setData(data); } catch {}
      } else if (def.type === 'overlay_multi') {
        // e.g. Bollinger Bands
        let seriesList = currentSeriesMap[id];
        if (!seriesList) {
          seriesList = def.subLines.map((sub) =>
            chart.addLineSeries({
              color: sub.color,
              lineWidth: 1,
              lineStyle: sub.style || 0,
              priceLineVisible: false,
              lastValueVisible: false,
              title: `${def.shortName} ${sub.label}`,
            })
          );
          currentSeriesMap[id] = seriesList;
        }

        seriesList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const sub = def.subLines[idx];
          const data = candles
            .filter((c) => c[sub.field] != null && !isNaN(Number(c[sub.field])))
            .map((c) => ({
              time: c.time,
              value: Number(c[sub.field]),
            }));
          try { s.setData(data); } catch {}
        });
      } else if (def.type === 'levels') {
        // e.g. Pivot Points
        let seriesList = currentSeriesMap[id];
        if (!seriesList) {
          seriesList = def.levels.map((lvl) =>
            chart.addLineSeries({
              color: lvl.color,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: lvl.label,
            })
          );
          currentSeriesMap[id] = seriesList;
        }

        seriesList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const lvl = def.levels[idx];
          const data = candles
            .filter((c) => c[lvl.field] != null && !isNaN(Number(c[lvl.field])))
            .map((c) => ({
              time: c.time,
              value: Number(c[lvl.field]),
            }));
          try { s.setData(data); } catch {}
        });
      }
    });

    resetLegendToLatest();
  }, [activeIndicators, hiddenIndicators, overlayIndicators, candles, resetLegendToLatest]);

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

      {/* 2. Unified Top-Left Legend HUD (TradingView Style) */}
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
        {/* Row 1: Symbol, Interval, Time, OHLC, % Change, Volume */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: 'rgba(11, 15, 28, 0.88)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.72rem',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#94A3B8',
          }}
        >
          <span style={{ color: '#818CF8', fontWeight: 800 }}>{selectedSymbol}</span>
          <span
            style={{
              padding: '1px 4px',
              borderRadius: 3,
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: '#A5B4FC',
              fontSize: '0.66rem',
              fontWeight: 700,
            }}
          >
            {interval.toUpperCase()}
          </span>
          <span ref={timeRef} style={{ color: '#64748B' }}>—</span>
          <span style={{ color: '#475569' }}>•</span>
          <span>O <strong ref={openRef} style={{ color: '#E2E8F0' }}>—</strong></span>
          <span>H <strong ref={highRef} style={{ color: '#26A69A' }}>—</strong></span>
          <span>L <strong ref={lowRef} style={{ color: '#EF5350' }}>—</strong></span>
          <span>C <strong ref={closeRef} style={{ color: '#FFFFFF' }}>—</strong></span>
          <span ref={chgRef} style={{ fontWeight: 800, color: '#26A69A' }}>—</span>
          <span style={{ color: '#475569' }}>•</span>
          <span>Vol <strong ref={volRef} style={{ color: '#CBD5E1' }}>—</strong></span>
        </div>

        {/* Row 2+: Active Overlay Indicators with Live Hover Readouts & Controls */}
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
