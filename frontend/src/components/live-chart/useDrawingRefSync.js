import { useState, useEffect } from 'react';

/**
 * useDrawingRefSync — Sync the stable drawing refs from the ChartCanvas
 * imperative handle once the chart instance exists. Polls briefly after load
 * since ref assignment itself never triggers a render; chart-type changes
 * replace the primary series, so the drawing price-coordinate ref must follow.
 */
export function useDrawingRefSync({ loading, candles, interval, selectedSymbol, chartType, chartCanvasRef, drawingChartRef, drawingCandleRef }) {
  const [, setDrawingRefsTick] = useState(0);
  useEffect(() => {
    if (loading || candles.length === 0) {
      drawingChartRef.current = null;
      drawingCandleRef.current = null;
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const sync = () => {
      if (cancelled) return;
      try {
        const chart = chartCanvasRef.current?.getChart?.() || null;
        const series = chartCanvasRef.current?.getCandleSeries?.() || null;
        if (chart && !chart.__isDisposed && drawingChartRef.current !== chart) {
          drawingChartRef.current = chart;
          setDrawingRefsTick((t) => t + 1);
        } else if (!chart || chart.__isDisposed) {
          drawingChartRef.current = null;
        }
        if (series && !series.__isDisposed && drawingCandleRef.current !== series) {
          drawingCandleRef.current = series;
          setDrawingRefsTick((t) => t + 1);
        } else if (!series || series.__isDisposed) {
          drawingCandleRef.current = null;
        }
        if ((!chart || !series) && attempts < 20 && !cancelled) {
          attempts += 1;
          setTimeout(sync, 250);
        }
      } catch {}
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, [loading, candles, interval, selectedSymbol, chartType, chartCanvasRef, drawingChartRef, drawingCandleRef]);
}
