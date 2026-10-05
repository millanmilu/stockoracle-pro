import { useCallback, useRef } from 'react';

/**
 * usePaneSync — synchronized visible-range + crosshair propagation between
 * the main price chart and every stacked sub-pane (oscillators + volume).
 * The loop guard (`isSyncingRangeRef`) keeps programmatic range sets from
 * bouncing back through the sync callbacks.
 */
export function usePaneSync({ chartCanvasRef, oscPaneRefs, volumePaneRef }) {
  const isSyncingRangeRef = useRef(false);

  // Synchronized Visible Logical Range with loop guard across all stacked panes
  const handleVisibleRangeChange = useCallback((range, source) => {
    if (isSyncingRangeRef.current || !range) return;
    isSyncingRangeRef.current = true;
    try {
      if (source !== 'main') {
        try {
          const chart = chartCanvasRef.current?.getChart?.();
          if (chart && !chart.__isDisposed) {
            chartCanvasRef.current?.setVisibleLogicalRange(range);
          }
        } catch {}
      }
      Object.entries(oscPaneRefs.current).forEach(([oscType, paneRef]) => {
        if (source !== oscType) {
          try {
            const chart = paneRef?.getChart?.();
            if (chart && !chart.__isDisposed) {
              paneRef?.setVisibleLogicalRange(range);
            }
          } catch {}
        }
      });
      if (source !== 'volume') {
        try {
          const chart = volumePaneRef.current?.getChart?.();
          if (chart && !chart.__isDisposed) {
            volumePaneRef.current?.setVisibleLogicalRange(range);
          }
        } catch {}
      }
    } finally {
      requestAnimationFrame(() => { isSyncingRangeRef.current = false; });
    }
  }, []);

  // Synchronized Crosshair Hairline across main chart and sub-panes
  const handleCrosshairMove = useCallback(({ x, time, source }) => {
    if (source !== 'main') {
      try {
        const chart = chartCanvasRef.current?.getChart?.();
        if (chart && !chart.__isDisposed) {
          chartCanvasRef.current?.setSyncedCrosshair({ x, time, source });
        }
      } catch {}
    }
    Object.entries(oscPaneRefs.current).forEach(([oscType, paneRef]) => {
      if (source !== oscType) {
        try {
          const chart = paneRef?.getChart?.();
          if (chart && !chart.__isDisposed) {
            paneRef?.setSyncedCrosshair({ x, time, source });
          }
        } catch {}
      }
    });
    if (source !== 'volume') {
      try {
        const chart = volumePaneRef.current?.getChart?.();
        if (chart && !chart.__isDisposed) {
          volumePaneRef.current?.setSyncedCrosshair({ x, time, source });
        }
      } catch {}
    }
  }, []);

  return { handleVisibleRangeChange, handleCrosshairMove };
}
