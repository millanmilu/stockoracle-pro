// Pro Terminal V2 — MACD Sub-Pane

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { V2_COLORS } from '../utils/constants';

export default function V2MACD({ macdData, height = 80, visible = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const macdLineRef = useRef(null);
  const signalLineRef = useRef(null);
  const histogramRef = useRef(null);

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
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    macdLineRef.current = chart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });

    signalLineRef.current = chart.addLineSeries({
      color: '#F97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    histogramRef.current = chart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        if (width > 0 && h > 0) chart.applyOptions({ width, height: h });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!macdLineRef.current || !macdData.macdLine) return;

    macdLineRef.current.setData(macdData.macdLine);
    signalLineRef.current.setData(macdData.signalLine);

    const histData = macdData.histogram.map((h) => ({
      ...h,
      color: h.value >= 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));
    histogramRef.current.setData(histData);

    macdLineRef.current.applyOptions({ visible });
    signalLineRef.current.applyOptions({ visible });
    histogramRef.current.applyOptions({ visible });
  }, [macdData, visible]);

  if (!visible) return null;

  return (
    <div style={{ height, borderTop: `1px solid ${V2_COLORS.bg.border}` }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
