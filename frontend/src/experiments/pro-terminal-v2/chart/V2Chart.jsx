// Pro Terminal V2 — Main Chart Component
// Independent lightweight-charts instance with crosshair, legend, price line.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { V2_COLORS } from '../utils/constants';
import { formatPrice } from '../utils/formatters';

export default function V2Chart({
  candles,
  chartType,
  ema20,
  ema50,
  ema200,
  activeIndicators,
  currentPrice,
  symbol,
  interval,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const ema200Ref = useRef(null);
  const [legendData, setLegendData] = useState(null);

  // Create chart instance
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: V2_COLORS.text.secondary,
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 37, 50, 0.5)' },
        horzLines: { color: 'rgba(30, 37, 50, 0.5)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#4B5563', width: 1, style: 2, labelBackgroundColor: '#374151' },
        horzLine: { color: '#4B5563', width: 1, style: 2, labelBackgroundColor: '#374151' },
      },
      rightPriceScale: {
        borderColor: V2_COLORS.bg.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: V2_COLORS.bg.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    // Create primary series
    let series;
    if (chartType === 'line') {
      series = chart.addLineSeries({
        color: V2_COLORS.accent.primary,
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: V2_COLORS.accent.primary,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else if (chartType === 'area') {
      series = chart.addAreaSeries({
        lineColor: V2_COLORS.accent.primary,
        topColor: 'rgba(59, 130, 246, 0.25)',
        bottomColor: 'rgba(59, 130, 246, 0.02)',
        lineWidth: 2,
        priceLineVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else if (chartType === 'bar') {
      series = chart.addBarSeries({
        upColor: V2_COLORS.positive,
        downColor: V2_COLORS.negative,
        priceLineVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else {
      series = chart.addCandlestickSeries({
        upColor: V2_COLORS.positive,
        downColor: V2_COLORS.negative,
        borderUpColor: V2_COLORS.positive,
        borderDownColor: V2_COLORS.negative,
        wickUpColor: V2_COLORS.positive,
        wickDownColor: V2_COLORS.negative,
        priceLineVisible: true,
        priceLineColor: V2_COLORS.accent.primary,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: V2_COLORS.bg.primary,
        crosshairMarkerBackgroundColor: V2_COLORS.accent.primary,
      });
    }
    seriesRef.current = series;

    // EMA series
    ema20Ref.current = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'EMA20',
    });
    ema50Ref.current = chart.addLineSeries({
      color: '#F97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'EMA50',
    });
    ema200Ref.current = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'EMA200',
    });

    // Crosshair move handler for legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setLegendData(null);
        return;
      }
      const data = param.seriesData?.get(series);
      if (data) {
        const o = data.open !== undefined ? data.open : undefined;
        const h = data.high !== undefined ? data.high : undefined;
        const l = data.low !== undefined ? data.low : undefined;
        const c = data.close !== undefined ? data.close : data.value;
        setLegendData({ o, h, l, c, time: param.time });
      }
    });

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        if (width > 0 && h > 0) {
          chart.applyOptions({ width, height: h });
        }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartType]);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;

    let data;
    if (chartType === 'line' || chartType === 'area') {
      data = candles.map((c) => ({ time: c.time, value: c.close }));
    } else {
      data = candles;
    }
    seriesRef.current.setData(data);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, chartType]);

  // Update EMA overlays
  useEffect(() => {
    if (!ema20Ref.current || !ema50Ref.current || !ema200Ref.current) return;

    ema20Ref.current.applyOptions({ visible: activeIndicators.includes('ema_20') });
    ema50Ref.current.applyOptions({ visible: activeIndicators.includes('ema_50') });
    ema200Ref.current.applyOptions({ visible: activeIndicators.includes('ema_200') });

    if (activeIndicators.includes('ema_20')) ema20Ref.current.setData(ema20);
    else ema20Ref.current.setData([]);
    if (activeIndicators.includes('ema_50')) ema50Ref.current.setData(ema50);
    else ema50Ref.current.setData([]);
    if (activeIndicators.includes('ema_200')) ema200Ref.current.setData(ema200);
    else ema200Ref.current.setData([]);
  }, [ema20, ema50, ema200, activeIndicators]);

  // Price line color
  useEffect(() => {
    if (!seriesRef.current) return;
    const prevClose = candles[candles.length - 2]?.close || currentPrice;
    seriesRef.current.applyOptions({
      priceLineColor: currentPrice >= prevClose ? V2_COLORS.positive : V2_COLORS.negative,
    });
  }, [currentPrice, candles]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  const handleAutoFit = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
    }
  }, []);

  const isUp = currentPrice >= (candles[candles.length - 2]?.close || currentPrice);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 200 }}>
      {/* Legend overlay */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 8,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: 'none',
      }}>
        <span style={{ color: V2_COLORS.text.primary, fontWeight: 600, fontSize: 12 }}>{symbol}</span>
        <span style={{ color: V2_COLORS.text.muted }}>{interval}</span>
        {legendData && (
          <>
            <LegendItem label="O" value={legendData.o} color={V2_COLORS.text.secondary} />
            <LegendItem label="H" value={legendData.h} color={V2_COLORS.positive} />
            <LegendItem label="L" value={legendData.l} color={V2_COLORS.negative} />
            <LegendItem label="C" value={legendData.c} color={isUp ? V2_COLORS.positive : V2_COLORS.negative} />
          </>
        )}
        {activeIndicators.includes('ema_20') && ema20.length > 0 && (
          <LegendItem label="EMA20" value={ema20[ema20.length - 1]?.value} color="#06B6D4" />
        )}
        {activeIndicators.includes('ema_50') && ema50.length > 0 && (
          <LegendItem label="EMA50" value={ema50[ema50.length - 1]?.value} color="#F97316" />
        )}
        {activeIndicators.includes('ema_200') && ema200.length > 0 && (
          <LegendItem label="EMA200" value={ema200[ema200.length - 1]?.value} color="#A855F7" />
        )}
      </div>

      {/* Chart controls */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: 4,
      }}>
        <ChartControlButton label="Fit" onClick={handleResetZoom} />
        <ChartControlButton label="Auto" onClick={handleAutoFit} />
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

function LegendItem({ label, value, color }) {
  return (
    <span style={{ color: V2_COLORS.text.muted }}>
      {label} <span style={{ color, fontWeight: 500 }}>{value != null ? formatPrice(value) : '—'}</span>
    </span>
  );
}

function ChartControlButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 6px',
        fontSize: 9,
        color: V2_COLORS.text.muted,
        background: 'rgba(30, 37, 50, 0.6)',
        border: '1px solid rgba(42, 49, 66, 0.5)',
        borderRadius: 3,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
