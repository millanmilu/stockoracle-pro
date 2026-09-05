import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { CHART_OPTIONS, CANDLE_STYLE } from '../../utils/chartHelpers';
import { INDICATOR_DEFINITIONS } from './indicatorDefinitions';

/**
 * ChartCanvas — High-Performance Candlestick & Indicator Overlay Chart
 * Built with lightweight-charts v4 for silky-smooth 60 FPS performance,
 * 0ms hover Crosshair HUD, dynamic indicator overlays, and live candle tracking.
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
  onHoverValues = () => {},
  onVisibleRangeChange = () => {},
}, ref) {
  const containerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const hudRef = useRef(null);
  const indicatorSeriesRef = useRef({}); // id -> series or array of series

  // Expose imperative methods to parent
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
        } catch {}
      }
    },
    getChart: () => chartInstanceRef.current,
  }), []);

  // Helper: Format volume into clean K / L / Cr
  const formatVolume = useCallback((vol) => {
    if (vol == null || isNaN(vol) || vol <= 0) return '—';
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toLocaleString();
  }, []);

  // Helper: Update HUD text directly in DOM (0ms latency)
  const updateHUD = useCallback((o, h, l, c, vol, timeStr) => {
    if (!hudRef.current) return;
    if (c == null) {
      hudRef.current.innerHTML = `<span style="color:#64748B;">Hover over chart for details</span>`;
      return;
    }
    const numO = Number(o);
    const numH = Number(h);
    const numL = Number(l);
    const numC = Number(c);
    const chg = numO > 0 ? ((numC - numO) / numO) * 100 : 0;
    const isUp = chg >= 0;
    const chgColor = isUp ? '#26A69A' : '#EF5350';
    const sign = isUp ? '+' : '';

    hudRef.current.innerHTML = `
      <span style="color:#818CF8; font-weight:800;">${selectedSymbol}</span>
      ${timeStr ? `<span style="color:#64748B; margin:0 4px;">•</span><span style="color:#94A3B8;">${timeStr}</span>` : ''}
      <span style="color:#64748B; margin:0 4px;">•</span>
      <span>O <strong style="color:#E2E8F0;">₹${numO.toFixed(2)}</strong></span>
      <span style="margin-left:8px;">H <strong style="color:#26A69A;">₹${numH.toFixed(2)}</strong></span>
      <span style="margin-left:8px;">L <strong style="color:#EF5350;">₹${numL.toFixed(2)}</strong></span>
      <span style="margin-left:8px;">C <strong style="color:#FFFFFF;">₹${numC.toFixed(2)}</strong></span>
      <span style="margin-left:8px; color:${chgColor}; font-weight:800;">${sign}${chg.toFixed(2)}%</span>
      ${vol ? `<span style="margin-left:12px; color:#64748B;">Vol <strong style="color:#CBD5E1;">${formatVolume(vol)}</strong></span>` : ''}
    `;
  }, [selectedSymbol, formatVolume]);

  // Initialize Lightweight Charts instance
  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 500,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99, 102, 241, 0.35)', width: 1, style: 2 },
        horzLine: { color: 'rgba(99, 102, 241, 0.35)', width: 1, style: 2 },
      },
      timeScale: {
        ...CHART_OPTIONS.timeScale,
        timeVisible: interval !== '1d',
        secondsVisible: interval === '1s' || interval === '30s',
      },
    });

    // 1. Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      ...CANDLE_STYLE,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.05,
      },
    });

    // 2. Volume Series at bottom
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

    // 3. Crosshair Move Subscription
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        const active = activeCandleRef?.current;
        if (active) {
          updateHUD(active.open, active.high, active.low, active.close, active.volume, active.time);
        } else if (candles && candles.length > 0) {
          const last = candles[candles.length - 1];
          updateHUD(last.open, last.high, last.low, last.close, last.volume, last.time);
        }
        // Reset indicator hover values to latest candle
        if (candles && candles.length > 0) {
          const latest = candles[candles.length - 1];
          const latestValues = {};
          INDICATOR_DEFINITIONS.forEach((ind) => {
            if (latest[ind.field] != null) latestValues[ind.id] = latest[ind.field];
          });
          onHoverValues(latestValues);
        }
        return;
      }

      const cData = param.seriesData.get(candleSeries);
      const vData = param.seriesData.get(volumeSeries);
      if (cData) {
        const timeStr = typeof param.time === 'object'
          ? `${param.time.year}-${String(param.time.month).padStart(2,'0')}-${String(param.time.day).padStart(2,'0')}`
          : (typeof param.time === 'number' ? new Date(param.time * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : String(param.time));

        updateHUD(cData.open, cData.high, cData.low, cData.close, vData?.value, timeStr);

        // Find hovered candle to extract indicator values
        const hoveredTime = param.time;
        const matchedCandle = candles.find((c) => c.time === hoveredTime);
        if (matchedCandle) {
          const hoverVals = {};
          INDICATOR_DEFINITIONS.forEach((ind) => {
            if (matchedCandle[ind.field] != null) {
              hoverVals[ind.id] = matchedCandle[ind.field];
            }
          });
          onHoverValues(hoverVals);
        }
      }
    });

    // 4. Synchronize Visible Range with sub-panes
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) onVisibleRangeChange(range);
    });

    // 5. Responsive Resize Handling
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
  }, [interval, updateHUD, activeCandleRef, candles, onHoverValues, onVisibleRangeChange]);

  // Update timeScale options when interval changes (e.g. secondsVisible for 1s/30s)
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

  // Load Historical Candles into Series whenever data changes
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

      // Seed initial HUD
      const last = candles[candles.length - 1];
      if (last) {
        updateHUD(last.open, last.high, last.low, last.close, last.volume, last.time);
        const initVals = {};
        INDICATOR_DEFINITIONS.forEach((ind) => {
          if (last[ind.field] != null) initVals[ind.id] = last[ind.field];
        });
        onHoverValues(initVals);
      }
    } catch (err) {
      console.warn('Error setting chart data:', err);
    }
  }, [candles, updateHUD, onHoverValues]);

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
    activeIndicators.forEach((id) => {
      const def = INDICATOR_DEFINITIONS.find((item) => item.id === id);
      if (!def) return;

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
              lineStyle: 2, // Dashed
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
  }, [activeIndicators, hiddenIndicators, candles]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Zero-Latency Crosshair HUD Overlay */}
      <div
        ref={hudRef}
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          zIndex: 10,
          pointerEvents: 'none',
          fontSize: '0.74rem',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#94A3B8',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          backgroundColor: 'rgba(11, 15, 28, 0.75)',
          backdropFilter: 'blur(4px)',
          padding: '3px 8px',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <span style={{ color: '#818CF8', fontWeight: 800 }}>{selectedSymbol}</span>
      </div>

      {/* Main Lightweight Charts Canvas Container */}
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
