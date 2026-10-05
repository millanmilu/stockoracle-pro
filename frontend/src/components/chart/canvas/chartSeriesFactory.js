import { sanitizeSeriesData, CANDLE_STYLE } from '../../../utils/chartHelpers';
import { buildSeriesOptions } from '../../../utils/chartSettings';
import { calculateById } from '../../../utils/indicatorEngine';

/**
 * Resolve the display data for a single overlay indicator. When the user has
 * overridden inputs (TradingView Inputs tab), the client engine wins over the
 * stale server field so custom periods actually recompute; otherwise the
 * server field is preferred for speed.
 */
function resolveOverlayData(def, candles) {
  const hasCustomInputs = def.params && Object.keys(def.params).length > 0;
  if (def.engineId && hasCustomInputs) {
    const result = calculateById(def.engineId, candles, def.params || {});
    if (result.valid && result.points) {
      const arr = result.points.main || result.points;
      if (Array.isArray(arr)) {
        const pts = arr
          .filter((p) => p && p.value != null && !isNaN(Number(p.value)))
          .map((p) => ({ time: p.time, value: Number(p.value) }));
        if (pts.length) return sanitizeSeriesData(pts);
      }
    }
    // Fall through to server field if engine yields nothing.
  }
  const colField = def.field;
  if (colField) {
    const pts = candles
      .filter((c) => c[colField] != null && !isNaN(Number(c[colField])))
      .map((c) => ({ time: c.time, value: Number(c[colField]) }));
    if (pts.length) return sanitizeSeriesData(pts);
  }
  if (def.engineId) {
    const result = calculateById(def.engineId, candles, def.params || {});
    if (!result.valid || !result.points) return [];
    const arr = result.points.main || result.points;
    if (!Array.isArray(arr)) return [];
    const pts = arr
      .filter((p) => p && p.value != null && !isNaN(Number(p.value)))
      .map((p) => ({ time: p.time, value: Number(p.value) }));
    return sanitizeSeriesData(pts);
  }
  return [];
}

/**
 * Creates primary price series based on chart type.
 * Colors/visibility come from the user's chart settings (TradingView modal)
 * so a chart-type switch never silently reverts customized colors.
 */
function createPrimarySeries(chart, type, isCrypto, settings) {
  // NSE equities show rounded whole-rupee labels on the right price axis
  // (slim axis, no decimal clutter); crypto keeps 2-decimal precision.
  const priceFormat = isCrypto
    ? { type: 'price', precision: 2, minMove: 0.01 }
    : { type: 'price', precision: 0, minMove: 1 };
  const style = buildSeriesOptions(settings, type);
  if (type === 'hollow') {
    return chart.addCandlestickSeries({
      ...CANDLE_STYLE,
      ...style,
      priceFormat,
    });
  }
  if (type === 'bar') {
    return chart.addBarSeries({
      ...style,
      priceFormat,
    });
  }
  if (type === 'line') {
    return chart.addLineSeries({
      lineWidth: 2,
      priceFormat,
      ...style,
    });
  }
  if (type === 'area') {
    return chart.addAreaSeries({
      lineWidth: 2,
      priceFormat,
      ...style,
    });
  }
  if (type === 'baseline') {
    return chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      priceFormat,
      ...style,
    });
  }
  // Default 'candlestick'
  return chart.addCandlestickSeries({
    ...CANDLE_STYLE,
    ...style,
    priceFormat,
  });
}

export { resolveOverlayData, createPrimarySeries };
