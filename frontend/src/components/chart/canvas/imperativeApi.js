export function createImperativeApi({
  chartInstanceRef,
  candleSeriesRef,
  syncedHairlineRef,
  isHoveringRef,
  candlesRef,
  chartTypeRef,
  updateLegend,
  resetLegendToLatest,
}) {
  return {
    fitContent: () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
        try {
          const totalBars = candlesRef.current?.length || 0;
          if (totalBars > 0) {
            const visibleCount = Math.min(totalBars, 80);
            chartInstanceRef.current.timeScale().setVisibleLogicalRange({
              from: totalBars - visibleCount,
              to: totalBars + 4,
            });
          } else {
            chartInstanceRef.current.timeScale().fitContent();
          }
        } catch {}
      }
    },
    updateActiveCandle: (candle) => {
      if (candleSeriesRef.current && !candleSeriesRef.current.__isDisposed && candle && candle.time) {
        try {
          const lastCandle = candlesRef.current && candlesRef.current.length > 0
            ? candlesRef.current[candlesRef.current.length - 1]
            : null;

          // Guard against mixing time types (e.g. string 'YYYY-MM-DD' vs numeric epoch seconds)
          if (lastCandle) {
            const lastIsStr = typeof lastCandle.time === 'string';
            const curIsStr = typeof candle.time === 'string';
            if (lastIsStr !== curIsStr) {
              return;
            }
            if (candle.time < lastCandle.time) {
              return;
            }
          }

          const o = Number(candle.open);
          const c = Number(candle.close);
          // Drop corrupt ticks before they poison the series PlotList: a NaN /
          // zero / inverted bar stored via update() surfaces one frame later
          // as an uncaught "Value is null" in SeriesBarColorer paint.
          if (!isFinite(o) || !isFinite(c) || o <= 0 || c <= 0) return;
          let h = Number(candle.high);
          let l = Number(candle.low);
          if (!isFinite(h)) h = Math.max(o, c);
          if (!isFinite(l)) l = Math.min(o, c);
          h = Math.max(h, o, c);
          l = Math.min(l, o, c);
          if (!isFinite(h) || !isFinite(l) || h <= 0 || l <= 0) return;

          const isLineType = ['line', 'area', 'baseline'].includes(chartTypeRef.current);
          if (isLineType) {
            candleSeriesRef.current.update({
              time: candle.time,
              value: c,
            });
          } else {
            candleSeriesRef.current.update({
              time: candle.time,
              open: o,
              high: h,
              low: l,
              close: c,
            });
          }

          if (candlesRef.current) {
            const lastIdx = candlesRef.current.length - 1;
            if (lastIdx >= 0 && candlesRef.current[lastIdx].time === candle.time) {
              // Replace in place (same bucket update) — create new array to avoid mutation
              const updated = { ...candlesRef.current[lastIdx], ...candle, open: o, high: h, low: l, close: c };
              candlesRef.current = [...candlesRef.current.slice(0, lastIdx), updated, ...candlesRef.current.slice(lastIdx + 1)];
            } else if (lastIdx >= 0 && candle.time > candlesRef.current[lastIdx].time) {
              // Only follow the live edge when the viewport is ALREADY at the
              // right edge. Panning into history + moving the mouse off-chart
              // must not yank the user back on the next bucket rollover.
              let atRightEdge = true;
              try {
                const range = chartInstanceRef.current && !chartInstanceRef.current.__isDisposed
                  ? chartInstanceRef.current.timeScale().getVisibleLogicalRange()
                  : null;
                if (range) {
                  const totalBars = candlesRef.current.length;
                  atRightEdge = range.to >= totalBars - 2;
                }
              } catch { atRightEdge = true; }
              candlesRef.current.push({ ...candle, open: o, high: h, low: l, close: c });
              if (!isHoveringRef.current && atRightEdge) {
                try {
                  if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
                    chartInstanceRef.current.timeScale().scrollToRealtime();
                  }
                } catch {}
              }
            } else if (lastIdx < 0) {
              candlesRef.current = [{ ...candle, open: o, high: h, low: l, close: c }];
            }
          }
          if (!isHoveringRef.current) {
            updateLegend(candle);
          }
        } catch (err) {
          console.warn('Error updating active candle series:', err);
        }
      }
    },
    setVisibleLogicalRange: (range) => {
      if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed && range) {
        try {
          chartInstanceRef.current.timeScale().setVisibleLogicalRange(range);
        } catch {}
      }
    },
    setSyncedCrosshair: ({ x, time, source }) => {
      if (source === 'main') return;
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
    getChart: () => (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed ? chartInstanceRef.current : null),
    getCandleSeries: () => (candleSeriesRef.current && !candleSeriesRef.current.__isDisposed ? candleSeriesRef.current : null),
    getPriceCoordinate: (price) => {
      if (!candleSeriesRef.current || candleSeriesRef.current.__isDisposed || price == null) return null;
      try {
        return candleSeriesRef.current.priceToCoordinate(Number(price));
      } catch {
        return null;
      }
    },
  };
}
