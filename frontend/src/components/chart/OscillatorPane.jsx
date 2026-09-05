import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { Eye, EyeOff, X } from 'lucide-react';

/**
 * OscillatorPane — TradingView-Grade Stacked Sub-Pane
 * Synchronized with the main price chart via visible logical range and crosshair.
 */
const OscillatorPane = forwardRef(function OscillatorPane({
  type = 'rsi', // 'rsi' | 'macd'
  candles = [],
  isHidden = false,
  onToggleHide = () => {},
  onClose = () => {},
  onVisibleRangeChange = () => {},
  onCrosshairMove = () => {},
}, ref) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef({});
  const syncedHairlineRef = useRef(null);
  const isHoveringRef = useRef(false);

  // DOM refs for zero-latency legend updates
  const rsiValRef = useRef(null);
  const macdValRef = useRef(null);
  const sigValRef = useRef(null);
  const histValRef = useRef(null);

  const candlesRef = useRef(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Update top-left legend in DOM
  const updateLegend = useCallback((candle) => {
    if (!candle) return;
    if (type === 'rsi') {
      const val = candle.rsi;
      if (rsiValRef.current) {
        if (val != null && !isNaN(Number(val))) {
          const num = Number(val);
          rsiValRef.current.textContent = num.toFixed(2);
          if (num >= 70) {
            rsiValRef.current.style.color = '#EF5350'; // Overbought
          } else if (num <= 30) {
            rsiValRef.current.style.color = '#10B981'; // Oversold
          } else {
            rsiValRef.current.style.color = '#C084FC';
          }
        } else {
          rsiValRef.current.textContent = '—';
          rsiValRef.current.style.color = '#94A3B8';
        }
      }
    } else if (type === 'macd') {
      const m = candle.macd;
      const s = candle.macd_signal;
      const h = candle.macd_hist;

      if (macdValRef.current) {
        macdValRef.current.textContent = m != null && !isNaN(Number(m)) ? Number(m).toFixed(2) : '—';
      }
      if (sigValRef.current) {
        sigValRef.current.textContent = s != null && !isNaN(Number(s)) ? Number(s).toFixed(2) : '—';
      }
      if (histValRef.current) {
        if (h != null && !isNaN(Number(h))) {
          const numH = Number(h);
          const sign = numH >= 0 ? '+' : '';
          histValRef.current.textContent = `${sign}${numH.toFixed(2)}`;
          histValRef.current.style.color = numH >= 0 ? '#26A69A' : '#EF5350';
        } else {
          histValRef.current.textContent = '—';
          histValRef.current.style.color = '#94A3B8';
        }
      }
    }
  }, [type]);

  const resetLegendToLatest = useCallback(() => {
    if (candlesRef.current.length > 0) {
      const latest = candlesRef.current[candlesRef.current.length - 1];
      updateLegend(latest);
    }
  }, [updateLegend]);

  // Expose imperative methods to parent controller
  useImperativeHandle(ref, () => ({
    setVisibleLogicalRange: (range) => {
      if (chartRef.current && range) {
        try {
          chartRef.current.timeScale().setVisibleLogicalRange(range);
        } catch {}
      }
    },
    setSyncedCrosshair: ({ x, time, source }) => {
      if (source === type) return;
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
    getChart: () => chartRef.current,
  }), [type, updateLegend, resetLegendToLatest]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 120,
      layout: {
        background: { type: 'solid', color: '#090C16' },
        textColor: '#64748B',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(99, 102, 241, 0.04)', style: 1 },
        horzLines: { color: 'rgba(99, 102, 241, 0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(99, 102, 241, 0.12)',
        textColor: '#64748B',
        scaleMargins: { top: 0.14, bottom: 0.14 },
        autoScale: true,
        alignLabels: true,
        minimumWidth: 72, // Strict pixel alignment with main chart
      },
      timeScale: {
        visible: false, // Clean look, synchronized with main timeScale
        borderColor: 'rgba(99, 102, 241, 0.12)',
        lockVisibleTimeRangeOnResize: true,
        rightOffset: 12,
        barSpacing: 9,
        minBarSpacing: 0.5,
        shiftVisibleRangeOnNewBar: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(129, 140, 248, 0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' },
        horzLine: { color: 'rgba(129, 140, 248, 0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
      kineticScroll: { touch: true, mouse: true },
    });

    chartRef.current = chart;

    if (type === 'rsi') {
      const rsiSeries = chart.addLineSeries({
        color: '#A855F7',
        lineWidth: 1.5,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      });

      // 70 Overbought & 30 Oversold reference lines
      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(239, 83, 80, 0.65)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '70 OB',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(16, 185, 129, 0.65)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '30 OS',
      });

      seriesRefs.current = { rsi: rsiSeries };
    } else if (type === 'macd') {
      const macdSeries = chart.addLineSeries({
        color: '#06B6D4',
        lineWidth: 1.5,
        title: 'MACD',
      });
      const signalSeries = chart.addLineSeries({
        color: '#F97316',
        lineWidth: 1.5,
        title: 'Signal',
      });
      const histSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
      });

      seriesRefs.current = { macd: macdSeries, signal: signalSeries, hist: histSeries };
    }

    // Subscribe to range changes and sync back to main chart
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) onVisibleRangeChange(range, type);
    });

    // Subscribe to crosshair move
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        isHoveringRef.current = false;
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        resetLegendToLatest();
        onCrosshairMove({ x: null, time: null, source: type });
        return;
      }

      isHoveringRef.current = true;
      onCrosshairMove({ x: param.point.x, time: param.time, source: type });

      const matchedCandle = candlesRef.current.find(c => c.time === param.time);
      if (matchedCandle) {
        updateLegend(matchedCandle);
      }
    });

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0) {
          chart.applyOptions({ width: e.contentRect.width });
        }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = {};
    };
  }, [type, updateLegend, resetLegendToLatest, onVisibleRangeChange, onCrosshairMove]);

  // Update data series
  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;

    try {
      if (type === 'rsi' && seriesRefs.current.rsi) {
        const rsiData = candles
          .filter(c => c.rsi != null && !isNaN(Number(c.rsi)))
          .map(c => ({ time: c.time, value: Number(c.rsi) }));
        seriesRefs.current.rsi.setData(rsiData);
        seriesRefs.current.rsi.applyOptions({ visible: !isHidden });
      } else if (type === 'macd' && seriesRefs.current.macd) {
        const macdData = candles
          .filter(c => c.macd != null && !isNaN(Number(c.macd)))
          .map(c => ({ time: c.time, value: Number(c.macd) }));
        const sigData = candles
          .filter(c => c.macd_signal != null && !isNaN(Number(c.macd_signal)))
          .map(c => ({ time: c.time, value: Number(c.macd_signal) }));
        const histData = candles
          .filter(c => c.macd_hist != null && !isNaN(Number(c.macd_hist)))
          .map(c => {
            const val = Number(c.macd_hist);
            return {
              time: c.time,
              value: val,
              color: val >= 0 ? 'rgba(38, 166, 154, 0.7)' : 'rgba(239, 83, 80, 0.7)',
            };
          });

        seriesRefs.current.macd.setData(macdData);
        seriesRefs.current.signal.setData(sigData);
        seriesRefs.current.hist.setData(histData);

        seriesRefs.current.macd.applyOptions({ visible: !isHidden });
        seriesRefs.current.signal.applyOptions({ visible: !isHidden });
        seriesRefs.current.hist.applyOptions({ visible: !isHidden });
      }

      resetLegendToLatest();
    } catch {}
  }, [candles, type, isHidden, resetLegendToLatest]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 120,
        backgroundColor: '#090C16',
        borderTop: '1px solid rgba(99, 102, 241, 0.18)',
        flexShrink: 0,
      }}
      onMouseLeave={() => {
        isHoveringRef.current = false;
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        resetLegendToLatest();
        onCrosshairMove({ x: null, time: null, source: type });
      }}
    >
      {/* Synchronized Vertical Crosshair Hairline */}
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

      {/* Pane Top-Left Legend HUD */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 10,
          zIndex: 15,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          borderRadius: 4,
          backgroundColor: 'rgba(11, 15, 28, 0.88)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '0.68rem',
          fontFamily: 'JetBrains Mono, monospace',
          color: isHidden ? '#64748B' : '#E2E8F0',
          opacity: isHidden ? 0.6 : 1,
        }}
      >
        {type === 'rsi' ? (
          <>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#A855F7',
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 700, color: '#94A3B8' }}>RSI (14)</span>
            <span ref={rsiValRef} style={{ fontWeight: 800, color: '#C084FC', minWidth: 36 }}>
              —
            </span>
          </>
        ) : (
          <>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#06B6D4',
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 700, color: '#94A3B8' }}>MACD (12, 26, 9)</span>
            <span style={{ color: '#64748B' }}>MACD:</span>
            <strong ref={macdValRef} style={{ color: '#06B6D4' }}>—</strong>
            <span style={{ color: '#64748B' }}>Sig:</span>
            <strong ref={sigValRef} style={{ color: '#F97316' }}>—</strong>
            <span style={{ color: '#64748B' }}>Hist:</span>
            <strong ref={histValRef} style={{ color: '#26A69A' }}>—</strong>
          </>
        )}

        {/* Hide / Show Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleHide(type);
          }}
          title={isHidden ? 'Show pane' : 'Hide pane'}
          style={{
            background: 'transparent',
            border: 'none',
            color: isHidden ? '#64748B' : '#94A3B8',
            cursor: 'pointer',
            padding: 1,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 2,
            marginLeft: 2,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F5F9')}
          onMouseLeave={(e) => (e.currentTarget.style.color = isHidden ? '#64748B' : '#94A3B8')}
        >
          {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>

        {/* Close Pane Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose(type);
          }}
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
          title={`Close ${type.toUpperCase()} pane`}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF5350')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
        >
          <X size={11} />
        </button>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default OscillatorPane;
