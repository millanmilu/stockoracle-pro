import { createChart } from 'lightweight-charts';

/**
 * Creates a guarded Lightweight Charts instance that:
 * 1. Tracks its disposal lifecycle via `chart.__isDisposed`.
 * 2. Neutralizes methods on destroyed charts and series (prevents zombie calls).
 * 3. Patches internal drawing loops to catch and swallow asynchronous
 *    "Object is disposed" errors from fancy-canvas / TimeAxisWidget.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {import('lightweight-charts').IChartApi}
 */
export function safeCreateChart(container, options) {
  if (!container) return null;

  const chart = createChart(container, options);
  chart.__isDisposed = false;

  const trackedSeries = new Set();

  // 1. Locate and protect internal ChartWidget if accessible
  const chartWidget =
    chart._private__chartWidget ||
    Object.values(chart).find(
      (val) => val && typeof val === 'object' && typeof val._internal_paint === 'function'
    );

  if (chartWidget) {
    if (typeof chartWidget._internal_paint === 'function') {
      const origPaint = chartWidget._internal_paint.bind(chartWidget);
      chartWidget._internal_paint = function (invalidateMask) {
        if (chart.__isDisposed) return;
        try {
          origPaint(invalidateMask);
        } catch (err) {
          if (err?.message && String(err.message).toLowerCase().includes('disposed')) {
            // Benign teardown race in fancy-canvas / TimeAxisWidget
            return;
          }
          throw err;
        }
      };
    }

    if (typeof chartWidget._private__drawImpl === 'function') {
      const origDrawImpl = chartWidget._private__drawImpl.bind(chartWidget);
      chartWidget._private__drawImpl = function (mask, time) {
        if (chart.__isDisposed) return;
        try {
          origDrawImpl(mask, time);
        } catch (err) {
          if (err?.message && String(err.message).toLowerCase().includes('disposed')) {
            return;
          }
          throw err;
        }
      };
    }
  }

  // 2. Wrap series creation methods so all series inherit disposal safety
  const wrapSeries = (series) => {
    if (!series) return series;
    series.__isDisposed = false;
    trackedSeries.add(series);

    const origSetData = series.setData ? series.setData.bind(series) : null;
    if (origSetData) {
      series.setData = (data) => {
        if (chart.__isDisposed || series.__isDisposed) return;
        try {
          origSetData(data);
        } catch (e) {
          if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
          console.warn('[safeChart] series.setData error suppressed:', e);
        }
      };
    }

    const origUpdate = series.update ? series.update.bind(series) : null;
    if (origUpdate) {
      series.update = (bar) => {
        if (chart.__isDisposed || series.__isDisposed) return;
        try {
          origUpdate(bar);
        } catch (e) {
          if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
          console.warn('[safeChart] series.update error suppressed:', e);
        }
      };
    }

    const origApply = series.applyOptions ? series.applyOptions.bind(series) : null;
    if (origApply) {
      series.applyOptions = (opts) => {
        if (chart.__isDisposed || series.__isDisposed) return;
        try {
          origApply(opts);
        } catch (e) {
          if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
        }
      };
    }

    const origSetMarkers = series.setMarkers ? series.setMarkers.bind(series) : null;
    if (origSetMarkers) {
      series.setMarkers = (markers) => {
        if (chart.__isDisposed || series.__isDisposed) return;
        try {
          origSetMarkers(markers);
        } catch (e) {
          if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
        }
      };
    }

    const origCreatePriceLine = series.createPriceLine ? series.createPriceLine.bind(series) : null;
    if (origCreatePriceLine) {
      series.createPriceLine = (lineOptions) => {
        if (chart.__isDisposed || series.__isDisposed) return null;
        try {
          return origCreatePriceLine(lineOptions);
        } catch (e) {
          return null;
        }
      };
    }

    const origRemovePriceLine = series.removePriceLine ? series.removePriceLine.bind(series) : null;
    if (origRemovePriceLine) {
      series.removePriceLine = (line) => {
        if (chart.__isDisposed || series.__isDisposed) return;
        try {
          origRemovePriceLine(line);
        } catch (e) {}
      };
    }

    return series;
  };

  const seriesCreators = [
    'addCandlestickSeries',
    'addLineSeries',
    'addHistogramSeries',
    'addAreaSeries',
    'addBarSeries',
    'addBaselineSeries',
    'addCustomSeries',
  ];

  for (const fnName of seriesCreators) {
    if (typeof chart[fnName] === 'function') {
      const orig = chart[fnName].bind(chart);
      chart[fnName] = (...args) => wrapSeries(orig(...args));
    }
  }

  // 3. Wrap timeScale() API
  const ts = chart.timeScale();
  if (ts) {
    const origSetLogicalRange = ts.setVisibleLogicalRange?.bind(ts);
    if (origSetLogicalRange) {
      ts.setVisibleLogicalRange = (range) => {
        if (chart.__isDisposed || !range) return;
        try {
          origSetLogicalRange(range);
        } catch (e) {
          if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
        }
      };
    }

    const origApplyTS = ts.applyOptions?.bind(ts);
    if (origApplyTS) {
      ts.applyOptions = (opts) => {
        if (chart.__isDisposed) return;
        try {
          origApplyTS(opts);
        } catch (e) {
          if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
        }
      };
    }

    const origFitContent = ts.fitContent?.bind(ts);
    if (origFitContent) {
      ts.fitContent = () => {
        if (chart.__isDisposed) return;
        try {
          origFitContent();
        } catch (e) {}
      };
    }

    const origScrollToRealTime = ts.scrollToRealTime?.bind(ts);
    if (origScrollToRealTime) {
      ts.scrollToRealTime = () => {
        if (chart.__isDisposed) return;
        try {
          origScrollToRealTime();
        } catch (e) {}
      };
    }
  }

  // 4. Wrap priceScale() API
  const origPriceScale = chart.priceScale?.bind(chart);
  if (origPriceScale) {
    chart.priceScale = (scaleId) => {
      const ps = origPriceScale(scaleId);
      if (!ps || ps.__safeWrapped) return ps;
      ps.__safeWrapped = true;
      const origPSApply = ps.applyOptions?.bind(ps);
      if (origPSApply) {
        ps.applyOptions = (opts) => {
          if (chart.__isDisposed) return;
          try {
            origPSApply(opts);
          } catch (e) {}
        };
      }
      return ps;
    };
  }

  // 5. Wrap chart-level options, resize & removeSeries
  const origChartApply = chart.applyOptions?.bind(chart);
  if (origChartApply) {
    chart.applyOptions = (opts) => {
      if (chart.__isDisposed) return;
      try {
        origChartApply(opts);
      } catch (e) {
        if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
      }
    };
  }

  if (typeof chart.resize === 'function') {
    const origResize = chart.resize.bind(chart);
    chart.resize = (width, height, force) => {
      if (chart.__isDisposed) return;
      try {
        origResize(width, height, force);
      } catch (e) {
        if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
      }
    };
  }

  const origRemoveSeries = chart.removeSeries?.bind(chart);
  if (origRemoveSeries) {
    chart.removeSeries = (series) => {
      if (chart.__isDisposed || !series) return;
      series.__isDisposed = true;
      trackedSeries.delete(series);
      try {
        origRemoveSeries(series);
      } catch (e) {
        if (e?.message && String(e.message).toLowerCase().includes('disposed')) return;
      }
    };
  }

  // 6. Wrap chart.remove() for clean teardown
  const origRemove = chart.remove.bind(chart);
  chart.remove = () => {
    if (chart.__isDisposed) return;
    chart.__isDisposed = true;

    for (const s of trackedSeries) {
      s.__isDisposed = true;
    }
    trackedSeries.clear();

    if (chartWidget) {
      if (chartWidget._private__drawRafId && chartWidget._private__drawRafId !== 0) {
        try {
          window.cancelAnimationFrame(chartWidget._private__drawRafId);
        } catch {}
        chartWidget._private__drawRafId = 0;
        chartWidget._private__drawPlanned = false;
      }
    }

    try {
      origRemove();
    } catch (err) {
      if (!err?.message || !String(err.message).toLowerCase().includes('disposed')) {
        console.warn('[safeChart] Error during chart.remove():', err);
      }
    }
  };

  return chart;
}
