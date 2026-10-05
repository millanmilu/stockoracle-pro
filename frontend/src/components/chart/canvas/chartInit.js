import { CrosshairMode } from 'lightweight-charts';
import { safeCreateChart } from '../../../utils/safeChart';
import { CHART_OPTIONS, BACKFILL_TRIGGER_BARS } from '../../../utils/chartHelpers';
import { buildChartOptions, applyScalePlacement } from '../../../utils/chartSettings';
import { getChartBaseOptions } from '../../../utils/theme';
import { createPrimarySeries } from './chartSeriesFactory';

export function initChart({
  theme,
  chartType,
  isCrypto,
  containerRef,
  chartInstanceRef,
  candleSeriesRef,
  indicatorSeriesRef,
  smcSeriesRef,
  aiSeriesRef,
  isHoveringRef,
  syncedHairlineRef,
  candlesRef,
  updateLegendRef,
  resetLegendRef,
  crosshairMoveRef,
  visibleRangeRef,
  chartClickRef,
  needOlderDataRef,
  intervalRef,
  timezoneRef,
  settingsRef,
}) {
    if (!containerRef.current) return;
    let disposed = false;
    let fitRaf = null;

    containerRef.current.innerHTML = '';

    const themeOpts = getChartBaseOptions(theme);
    const chart = safeCreateChart(containerRef.current, {
      ...CHART_OPTIONS,
      ...themeOpts,
      rightPriceScale: { ...CHART_OPTIONS.rightPriceScale, ...themeOpts.rightPriceScale },
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 500,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: theme === 'light' ? '#787B86' : '#787B86',
          width: 1,
          style: 2,
          labelBackgroundColor: theme === 'light' ? '#787B86' : '#363C4E',
        },
        horzLine: {
          color: theme === 'light' ? '#787B86' : '#787B86',
          width: 1,
          style: 2,
          labelBackgroundColor: theme === 'light' ? '#787B86' : '#363C4E',
        },
      },
      timeScale: {
        ...CHART_OPTIONS.timeScale,
        ...themeOpts.timeScale,
        timeVisible: intervalRef.current !== '1d',
        secondsVisible: intervalRef.current === '1s' || intervalRef.current === '30s',
        tickMarkFormatter: (time) => {
          if (typeof time === 'number') {
            const tz = timezoneRef.current || 'Asia/Kolkata';
            const d = new Date(time * 1000);
            return d.toLocaleTimeString('en-IN', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
          }
          return String(time);
        },
      },
      localization: {
        dateFormat: 'yyyy-MM-dd',
        timeFormatter: (time) => {
          if (typeof time === 'number') {
            const tz = timezoneRef.current || 'Asia/Kolkata';
            const d = new Date(time * 1000);
            const curIv = intervalRef.current;
            return d.toLocaleTimeString('en-IN', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              second: (curIv === '1s' || curIv === '30s') ? '2-digit' : undefined,
              hour12: false,
            });
          }
          return String(time);
        },
      },
    });

    // Saved TradingView settings win over the theme defaults above (grid,
    // crosshair, background, axis colors/size, price-scale placement).
    try { chart.applyOptions(buildChartOptions(settingsRef.current, theme)); } catch {}

    // Primary Price Series (Candles / Hollow / Bars / Line / Area / Baseline)
    const candleSeries = createPrimarySeries(chart, chartType, isCrypto, settingsRef.current);
    applyScalePlacement(chart, settingsRef.current, [candleSeries]);

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    indicatorSeriesRef.current = {};

    // Crosshair Move Event: Synchronize to sub-panes and update legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        isHoveringRef.current = false;
        if (syncedHairlineRef.current) {
          syncedHairlineRef.current.style.display = 'none';
        }
        resetLegendRef.current();
        crosshairMoveRef.current({ x: null, time: null, source: 'main' });
        return;
      }

      isHoveringRef.current = true;
      const curPrimary = candleSeriesRef.current;
      const cData = curPrimary ? param.seriesData?.get(curPrimary) : null;

      // Broadcast position to sub-panes
      crosshairMoveRef.current({ x: param.point.x, time: param.time, source: 'main' });

      if (cData) {
        const hoveredCandle = candlesRef.current.find((c) => c.time === param.time);
        const o = cData.open !== undefined ? cData.open : hoveredCandle?.open;
        const h = cData.high !== undefined ? cData.high : hoveredCandle?.high;
        const l = cData.low !== undefined ? cData.low : hoveredCandle?.low;
        const c = cData.close !== undefined ? cData.close : (cData.value !== undefined ? cData.value : hoveredCandle?.close);
        const merged = {
          ...(hoveredCandle || {}),
          time: param.time,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: hoveredCandle?.volume,
        };
        updateLegendRef.current(merged);
      }
    });

    // TimeScale Range Synchronization + progressive-history trigger:
    // jab viewport loaded data ke left edge ke andar aa jaye (user history me
    // pan kar raha hai), parent se older candles mangwao. Threshold check
    // sasta hai (ek number compare) — debounce/guards parent me hain.
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) visibleRangeRef.current(range, 'main');
      if (range && typeof range.from === 'number' && range.from < BACKFILL_TRIGGER_BARS) {
        try { needOlderDataRef.current?.(); } catch {}
      }
    });

    // Chart Click Event (e.g. for Jump to Bar in Replay mode)
    chart.subscribeClick((param) => {
      if (param && param.time) {
        chartClickRef.current?.(param);
      }
    });

    // Resize Observer
    let hasFittedInitial = false;
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          try { chart.applyOptions({ width, height }); } catch { return; }
          if (!hasFittedInitial && candlesRef.current && candlesRef.current.length > 0) {
            hasFittedInitial = true;
            if (fitRaf != null) {
              try { cancelAnimationFrame(fitRaf); } catch {}
            }
            fitRaf = requestAnimationFrame(() => {
              if (disposed || chart.__isDisposed) return;
              try {
                const totalBars = candlesRef.current.length;
                const visibleCount = Math.min(totalBars, 80);
                chart.timeScale().setVisibleLogicalRange({
                  from: totalBars - visibleCount,
                  to: totalBars + 4,
                });
              } catch {}
            });
          }
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      if (fitRaf != null) { try { cancelAnimationFrame(fitRaf); } catch {} fitRaf = null; }
      resizeObserver.disconnect();
      try { chart.remove(); } catch {}
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      indicatorSeriesRef.current = {};
      smcSeriesRef.current = {};
      aiSeriesRef.current = {};
    };
}
