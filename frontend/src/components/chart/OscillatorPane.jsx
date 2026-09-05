import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createChart } from 'lightweight-charts';
import { X } from 'lucide-react';

/**
 * OscillatorPane — Docked Sub-Pane for RSI & MACD
 * Synchronized with the main price chart's visible logical range.
 */
const OscillatorPane = forwardRef(function OscillatorPane({
  type = 'rsi', // 'rsi' | 'macd'
  candles = [],
  mainChartRef,
  onClose = () => {},
}, ref) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef({});

  useImperativeHandle(ref, () => ({
    syncRange: (range) => {
      if (chartRef.current && range) {
        try {
          chartRef.current.timeScale().setVisibleLogicalRange(range);
        } catch {}
      }
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 110,
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
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
      },
      timeScale: {
        visible: false, // Hidden to avoid duplicate time axis, synchronized with main
        borderColor: 'rgba(99, 102, 241, 0.12)',
      },
      crosshair: {
        vertLine: { color: 'rgba(129, 140, 248, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(129, 140, 248, 0.3)', width: 1, style: 2 },
      },
      handleScroll: false, // Main chart drives scroll
      handleScale: false,  // Main chart drives zoom
    });

    chartRef.current = chart;

    if (type === 'rsi') {
      const rsiSeries = chart.addLineSeries({
        color: '#A855F7',
        lineWidth: 1.5,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      });

      // Reference lines: 70 Overbought & 30 Oversold
      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(239, 83, 80, 0.6)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '70 OB',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(16, 185, 129, 0.6)',
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
  }, [type]);

  // Update data
  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;

    try {
      if (type === 'rsi' && seriesRefs.current.rsi) {
        const rsiData = candles
          .filter(c => c.rsi != null && !isNaN(Number(c.rsi)))
          .map(c => ({ time: c.time, value: Number(c.rsi) }));
        seriesRefs.current.rsi.setData(rsiData);
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
      }
    } catch {}
  }, [candles, type]);

  const title = type === 'rsi' ? 'RSI (14)' : 'MACD (12, 26, 9)';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 110,
        backgroundColor: '#090C16',
        borderTop: '1px solid rgba(99, 102, 241, 0.18)',
        flexShrink: 0,
      }}
    >
      {/* Pane Title HUD */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: 10,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.66rem',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#94A3B8',
          fontWeight: 700,
        }}
      >
        <span>{title}</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            cursor: 'pointer',
            padding: 1,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Close oscillator pane"
        >
          <X size={11} />
        </button>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default OscillatorPane;
