// Pro Terminal V2 — Volume Sub-Pane

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { CHART_ICU_LOCALE } from '../../../utils/theme';
import { V2_COLORS } from '../utils/constants';

export default function V2Volume({ volumeData, height = 100, visible = true, paneSync }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      localization: { locale: CHART_ICU_LOCALE },
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
      // Display-only strip: scroll/scale disabled so the main chart stays
      // the single source of truth for the visible range.
      handleScroll: false,
      handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false },
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
    if (volumeData.length) seriesRef.current.setData(volumeData);
  }, [volumeData, visible]);

  if (!visible) return null;

  return (
    <div style={{ height, borderTop: `1px solid ${V2_COLORS.bg.border}` }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
