import { PriceScaleMode } from 'lightweight-charts';
import { sanitizeCandles, sanitizeSeriesData } from '../../../utils/chartHelpers';
import { resolvePrecision } from '../../../utils/chartSettings';
import { decimalsForPrice } from './chartFormat';
import { createPrimarySeries } from './chartSeriesFactory';

export function restoreChartVisibility({
  chartInstanceRef,
  candleSeriesRef,
  containerRef,
  candlesRef,
  chartTypeRef,
}) {
    const restore = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const chart = chartInstanceRef.current;
      const series = candleSeriesRef.current;
      const host = containerRef.current;
      if (!chart || chart.__isDisposed || !series || series.__isDisposed || !host) return;
      try {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w > 0 && h > 0) {
          if (typeof chart.resize === 'function') chart.resize(w, h);
          else chart.applyOptions({ width: w, height: h });
        }
      } catch {}
      try {
        const rows = candlesRef.current;
        if (Array.isArray(rows) && rows.length > 0) {
          const safe = sanitizeCandles(rows.map((c) => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          })));
          if (safe.length) {
            if (['line', 'area', 'baseline'].includes(chartTypeRef.current)) {
              series.setData(sanitizeSeriesData(
                safe.map((c) => ({ time: c.time, value: Number(c.close) })),
              ));
            } else {
              series.setData(safe);
            }
          }
        }
      } catch {}
    };
    document.addEventListener('visibilitychange', restore);
    window.addEventListener('pageshow', restore);
    window.addEventListener('focus', restore);
    return () => {
      document.removeEventListener('visibilitychange', restore);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('focus', restore);
    };
}

export function switchChartType({
  chartType,
  isCrypto,
  syncSeriesPrecision,
  syncScalePlacement,
  chartInstanceRef,
  candleSeriesRef,
  candlesRef,
  settingsRef,
  appliedPrecisionRef,
}) {
    const chart = chartInstanceRef.current;
    if (!chart || chart.__isDisposed) return;

    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (candleSeriesRef.current) {
        chart.removeSeries(candleSeriesRef.current);
      }
      const newSeries = createPrimarySeries(chart, chartType, isCrypto, settingsRef.current);
      candleSeriesRef.current = newSeries;
      appliedPrecisionRef.current = null; // fresh series carries default format
      if (candlesRef.current && candlesRef.current.length > 0) {
        const lastC = candlesRef.current[candlesRef.current.length - 1];
        syncSeriesPrecision(resolvePrecision(settingsRef.current, decimalsForPrice(lastC?.close, isCrypto)));
        try {
          const safe = sanitizeCandles(candlesRef.current.map(c => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          })));
          if (['line', 'area', 'baseline'].includes(chartType)) {
            newSeries.setData(sanitizeSeriesData(
              safe.map(c => ({ time: c.time, value: Number(c.close) }))
            ));
          } else if (safe.length) {
            newSeries.setData(safe);
          }
        } catch {}
      }

      if (range) {
        chart.timeScale().setVisibleLogicalRange(range);
      }
      // Fresh primary series must rejoin the active price-scale side.
      syncScalePlacement(settingsRef.current);
    } catch (err) {
      console.warn('Error switching chart type:', err);
    }
}

export function applyPriceScaleMode({
  priceScaleMode,
  invertScale,
  chartInstanceRef,
}) {
    if (!chartInstanceRef.current || chartInstanceRef.current.__isDisposed) return;
    try {
      const mode = priceScaleMode === 'log'
        ? PriceScaleMode.Logarithmic
        : priceScaleMode === 'percentage'
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal;

      const chart = chartInstanceRef.current;
      // Both scales get the same mode/invert so flipping scale placement
      // (Chart Settings → Scales) never silently drops the user's mode.
      ['right', 'left'].forEach((scaleId) => {
        chart.priceScale(scaleId).applyOptions({
          mode,
          invertScale: !!invertScale,
          autoScale: true,
        });
      });
    } catch (err) {
      console.warn('Error applying price scale mode:', err);
    }
}
