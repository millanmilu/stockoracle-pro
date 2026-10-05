// Pro Terminal V2 — RSI Sub-Pane

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { V2_COLORS } from '../utils/constants';

export default function V2RSI({ rsiData, height = 80, visible = true, paneSync }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: V2_COLORS.text.muted,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(30, 37, 50, 0.3)' },
        horzLines: { color: 'rgba(30, 37, 50, 0.3)' },
      },
      rightPriceScale: {
        borderColor: V2_COLORS.bg.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { visible: false, borderColor: V2_COLORS.bg.border },
      // Display-only strip: scroll/scale disabled so the main chart stays
      // the single source of truth for the visible range.
      handleScroll: false,
      handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });

    // Overbought line
    series.createPriceLine({
      price: 70,
      color: 'rgba(239, 68, 68, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
    });

    // Oversold line
    series.createPriceLine({
      price: 30,
      color: 'rgba(16, 185, 129, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    paneSync?.addPane(chart);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        if (width > 0 && h > 0) chart.applyOptions({ width, height: h });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      paneSync?.removePane(chart);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Recreate when visibility flips: while hidden the container is unmounted,
    // so the chart must be built fresh when the pane comes back.
  }, [visible, paneSync]);

  useEffect(() => {
    if (!visible || !seriesRef.current) return;
    if (rsiData.length) seriesRef.current.setData(rsiData);
  }, [rsiData, visible]);

  if (!visible) return null;

  return (
    <div style={{ height, borderTop: `1px solid ${V2_COLORS.bg.border}` }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
