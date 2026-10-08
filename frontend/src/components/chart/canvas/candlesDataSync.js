import { isValidChartTime, sanitizeCandles, sanitizeSeriesData } from '../../../utils/chartHelpers';
import { resolvePrecision } from '../../../utils/chartSettings';
import { decimalsForPrice } from './chartFormat';

export function syncCandlesData({
  candles,
  isCrypto,
  syncSeriesPrecision,
  candleSeriesRef,
  chartInstanceRef,
  candlesRef,
  candlesMetaRef,
  settingsRef,
  chartTypeRef,
  resetLegendRef,
}) {
    if (!candleSeriesRef.current || !Array.isArray(candles) || candles.length === 0) {
      return;
    }

    // Captured BEFORE setData: prepend restore needs the pre-replace range.
    let preRange = null;
    try {
      preRange = chartInstanceRef.current && !chartInstanceRef.current.__isDisposed
        ? chartInstanceRef.current.timeScale().getVisibleLogicalRange()
        : null;
    } catch {}

    try {
      // Defense-in-depth: LiveChartView already sorts/dedupes and drops
      // stale live buckets, but any out-of-order bar here would throw
      // "Assertion failed: data must be asc ordered by time" and crash the
      // app. Sanitize so setData always receives strictly ascending data.
      // OHLC validity is re-checked here (not just in formatHistoryCandles):
      // live ticks / cache restores can carry NaN, zero or inverted
      // high/low through `candles` state, and a single corrupt bar poisons
      // the series PlotList / price-scale, surfacing one frame later as an
      // uncaught "Value is null" in SeriesBarColorer during paint.
      const rawFormatted = [];
      for (const c of candles) {
        if (!c || !isValidChartTime(c.time)) continue;
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);
        const close = Number(c.close);
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) continue;
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
        if (high < Math.max(open, close) || low > Math.min(open, close)) continue;
        rawFormatted.push({ time: c.time, open, high, low, close });
      }
      const formattedCandles = sanitizeCandles(rawFormatted);
      if (formattedCandles.length === 0) return;

      if (['line', 'area', 'baseline'].includes(chartTypeRef.current)) {
        try {
          candleSeriesRef.current.setData(sanitizeSeriesData(
            formattedCandles.map(c => ({ time: c.time, value: Number(c.close) }))
          ));
        } catch {}
      } else {
        try {
          candleSeriesRef.current.setData(formattedCandles);
        } catch (e) {
          console.warn('Error setting chart data:', e);
        }
      }

      const byTime = new Map(formattedCandles.map((c) => [c.time, c]));
      candlesRef.current = candles
        .filter((c) => byTime.has(c.time))
        .map((c) => {
          const f = byTime.get(c.time);
          return { ...c, time: f.time, open: f.open, high: f.high, low: f.low, close: f.close };
        });
      // Ensure the imperative cache itself stays ascending (deduped above).
      candlesRef.current = sanitizeCandles(candlesRef.current);

      const totalBars = formattedCandles.length;
      const prev = candlesMetaRef.current;
      const newFirst = formattedCandles[0].time;
      const newLast = formattedCandles[totalBars - 1].time;
      const isSameDataset = prev.firstTime != null && newFirst === prev.firstTime;
      // Backfill prepend: same live edge, earlier start, strictly longer.
      const isPrepend = !isSameDataset && prev.lastTime != null
        && newLast === prev.lastTime && totalBars > prev.length;
      const prependShift = isPrepend ? totalBars - prev.length : 0;
      const isIncrementalAppend =
        isSameDataset &&
        totalBars >= prev.length &&
        totalBars - prev.length <= 2;
      candlesMetaRef.current = { firstTime: newFirst, lastTime: newLast, length: totalBars };

      if (isPrepend && preRange && totalBars > 0) {
        // Keep the user on the same bars they were viewing.
        try {
          chartInstanceRef.current.timeScale().setVisibleLogicalRange({
            from: preRange.from + prependShift,
            to: preRange.to + prependShift,
          });
        } catch {}
      } else if (!isSameDataset && totalBars > 0) {
        // Initial symbol/interval load: fit default 80 bars
        const visibleCount = Math.min(totalBars, 80);
        if (chartInstanceRef.current && !chartInstanceRef.current.__isDisposed) {
          try {
            chartInstanceRef.current.timeScale().setVisibleLogicalRange({
              from: totalBars - visibleCount,
              to: totalBars + 4,
            });
            // Settings → Scales: "Auto-fit prices on new data" can opt out.
            if (settingsRef.current.autoFitPrices !== false) {
              chartInstanceRef.current.priceScale('right').applyOptions({ autoScale: true });
            }
          } catch {}
        }
      } else if (isSameDataset && chartInstanceRef.current && !chartInstanceRef.current.__isDisposed && totalBars > 0) {
        // Same dataset (replay stepping or live ticks): preserve user's zoom span
        try {
          const currentRange = chartInstanceRef.current.timeScale().getVisibleLogicalRange();
          if (currentRange) {
            const span = Math.max(10, currentRange.to - currentRange.from);
            // If the bar moves past the right viewport edge, smoothly follow forward
            if (totalBars >= currentRange.to - 2) {
              chartInstanceRef.current.timeScale().setVisibleLogicalRange({
                from: (totalBars + 4) - span,
                to: totalBars + 4,
              });
            } else if (totalBars < currentRange.from + 2) {
              // If stepping backwards past the left edge, bring into view
              chartInstanceRef.current.timeScale().setVisibleLogicalRange({
                from: Math.max(0, totalBars - Math.round(span * 0.7)),
                to: totalBars + Math.round(span * 0.3),
              });
            }
          }
        } catch (_) {}
      }

      // Match axis decimals to price magnitude (BTC 88125, not 88125.00).
      const lastClose = formattedCandles[formattedCandles.length - 1]?.close;
      syncSeriesPrecision(resolvePrecision(settingsRef.current, decimalsForPrice(lastClose, isCrypto)));

      // Seed initial legend values
      resetLegendRef.current();
    } catch (err) {
      console.warn('Error setting chart data:', err);
    }
}
