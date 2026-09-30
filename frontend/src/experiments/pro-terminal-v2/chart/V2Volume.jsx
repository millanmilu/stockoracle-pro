// Pro Terminal V2 — Volume Sub-Pane

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { V2_COLORS } from '../utils/constants';

export default function V2Volume({ volumeData, height = 100, visible = true }) {
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
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: {
        visible: false,
        borderColor: V2_COLORS.bg.border,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
    if (seriesRef.current && volumeData.length) {
      seriesRef.current.setData(volumeData);
      seriesRef.current.applyOptions({ visible });
    }
  }, [volumeData, visible]);

  if (!visible) return null;

  return (
    <div style={{ height, borderTop: `1px solid ${V2_COLORS.bg.border}` }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
