import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { Eye, EyeOff, X } from 'lucide-react';
import { calculateById } from '../../utils/indicatorEngine';
import useStore from '../../store/useStore';
import { getChartBaseOptions, getThemeTokens } from '../../utils/theme';

/**
 * OscillatorPane — Universal Sub-Pane for All Oscillator Types
 * Synchronized with the main price chart via visible logical range and crosshair.
 *
 * Values are either read directly from server-computed candle fields
 * (`definition.field` / `signalField`), or computed client-side via the modular
 * engine (`definition.engineId` + `definition.params`).
 *
 * Supported oscType values:
 *   rsi | macd | stoch | stoch_rsi | cci | williams_r | mfi | obv | adx | atr |
 *   elder_ray | cmf | roc | momentum | trix | hist_vol | std_dev | bb_width |
 *   choppiness | rel_volume | volume_delta | cvd
 */

const OSC_CONFIG = {
  rsi:          { label: 'RSI (14)',         color: '#A855F7', hasSignal: false, hasBands: [70, 30], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  macd:         { label: 'MACD (12,26,9)',   color: '#06B6D4', hasSignal: true,  hasBands: null,     zeroLine: true  },
  stoch:        { label: 'Stoch (14,3)',     color: '#3B82F6', hasSignal: true,  hasBands: [80, 20], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  stoch_rsi:    { label: 'StochRSI',         color: '#60A5FA', hasSignal: true,  hasBands: [80, 20], bandColors: ['rgba(239,83,80,0.4)','rgba(16,185,129,0.4)'], zeroLine: false },
  cci:          { label: 'CCI (20)',         color: '#F97316', hasSignal: false, hasBands: [100,-100], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: true  },
  williams_r:   { label: 'Williams %R',      color: '#EC4899', hasSignal: false, hasBands: [-20,-80], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  mfi:          { label: 'MFI (14)',         color: '#06B6D4', hasSignal: false, hasBands: [80, 20], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  obv:          { label: 'OBV',              color: '#10B981', hasSignal: false, hasBands: null,     zeroLine: true  },
  adx:          { label: 'ADX (14)',         color: '#FBBF24', hasSignal: true,  hasBands: [[25,'rgba(251,191,36,0.3)']], zeroLine: false },
  atr:          { label: 'ATR (14)',         color: '#FB923C', hasSignal: false, hasBands: null,     zeroLine: false },
  elder_ray:    { label: 'Elder Ray',        color: '#34D399', hasSignal: true,  hasBands: null,     zeroLine: true  },
  cmf:          { label: 'CMF (20)',         color: '#38BDF8', hasSignal: false, hasBands: null,     zeroLine: true  },
  roc:          { label: 'ROC (10)',         color: '#14B8A6', hasSignal: false, hasBands: null,     zeroLine: true  },
  momentum:     { label: 'Momentum (10)',    color: '#F59E0B', hasSignal: false, hasBands: null,     zeroLine: true  },
  trix:         { label: 'TRIX (15)',        color: '#C084FC', hasSignal: false, hasBands: null,     zeroLine: true  },
  hist_vol:     { label: 'Hist Vol %',       color: '#38BDF8', hasSignal: false, hasBands: null,     zeroLine: false },
  std_dev:      { label: 'StdDev (20)',      color: '#94A3B8', hasSignal: false, hasBands: null,     zeroLine: false },
  bb_width:     { label: 'BB Width %',       color: '#818CF8', hasSignal: false, hasBands: null,     zeroLine: false },
  choppiness:   { label: 'Choppiness (14)',  color: '#F472B6', hasSignal: false, hasBands: [61.8, 38.2], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  rel_volume:   { label: 'Rel Volume (20)',  color: '#34D399', hasSignal: false, hasBands: [[1,'rgba(255,255,255,0.3)']], zeroLine: false },
  volume_delta: { label: 'Vol Delta (est)',  color: '#F87171', hasSignal: false, hasBands: null,     zeroLine: true  },
  cvd:          { label: 'CVD (est)',        color: '#E879F9', hasSignal: false, hasBands: null,     zeroLine: true  },
};

const fmt = (v, d = 2) => (v != null && !isNaN(Number(v))) ? Number(v).toFixed(d) : '—';

function arr(points) {
  if (!points) return [];
  if (Array.isArray(points)) return points;
  if (Array.isArray(points.main)) return points.main;
  return [];
}

function fieldPoints(candles, field) {
  if (!field) return [];
  return candles
    .filter((c) => c[field] != null && !isNaN(Number(c[field])))
    .map((c) => ({ time: c.time, value: Number(c[field]) }));
}

/**
 * Resolve the full series data for an oscillator. Returns
 * { main, signal, signal2, hist } arrays of { time, value, color? }.
 * Prefers server fields, falls back to the client engine.
 */
function resolveSeries(oscType, definition, candles) {
  if (!candles?.length) return { main: [], signal: [], signal2: [], hist: [] };

  const def = definition || {};
  const engineId = def.engineId;

  // Try engine first for engine-backed oscillators (single source of truth for
  // the new catalog) when no server field is present.
  let engine = null;
  if (engineId) {
    const res = calculateById(engineId, candles, def.params || {});
    if (res.valid && res.points) engine = res.points;
  }

  switch (oscType) {
    case 'macd': {
      if (engine) {
        return {
          main: arr(engine.macd),
          signal: arr(engine.signal),
          hist: arr(engine.histogram || engine.hist),
        };
      }
      return {
        main: fieldPoints(candles, def.field || 'macd'),
        signal: fieldPoints(candles, def.signalField || 'macd_signal'),
        hist: fieldPoints(candles, def.histField || 'macd_hist'),
      };
    }
    case 'stoch':
    case 'stoch_rsi': {
      if (engine && engine.k) {
        return { main: arr(engine.k), signal: arr(engine.d) };
      }
      const kField = oscType === 'stoch' ? (def.field || 'stoch_k') : (def.field || 'stoch_rsi_k');
      const dField = oscType === 'stoch' ? (def.signalField || 'stoch_d') : (def.signalField || 'stoch_rsi_d');
      return { main: fieldPoints(candles, kField), signal: fieldPoints(candles, dField) };
    }
    case 'adx': {
      if (engine && engine.adx) {
        return { main: arr(engine.adx), signal: arr(engine.plusDI), signal2: arr(engine.minusDI) };
      }
      return {
        main: fieldPoints(candles, def.field || 'adx'),
        signal: fieldPoints(candles, def.plusDIField || 'plus_di'),
        signal2: fieldPoints(candles, def.minusDIField || 'minus_di'),
      };
    }
    case 'elder_ray': {
      return {
        main: fieldPoints(candles, def.field || 'elder_bull'),
        signal: fieldPoints(candles, def.signalField || 'elder_bear'),
      };
    }
    case 'cmf': {
      const main = engine ? arr(engine) : fieldPoints(candles, def.field || 'cmf');
      return { main, hist: main };
    }
    case 'rsi': case 'mfi': case 'cci': case 'williams_r': case 'obv': case 'atr':
    case 'roc': case 'momentum': case 'trix': case 'hist_vol': case 'std_dev':
    case 'bb_width': case 'choppiness': case 'rel_volume': case 'volume_delta':
    case 'cvd': {
      const main = engine ? arr(engine) : fieldPoints(candles, def.field || oscType);
      return { main };
    }
    default:
      return { main: engine ? arr(engine) : fieldPoints(candles, def.field || oscType) };
  }
}

export default forwardRef(function OscillatorPane({
  oscType = 'rsi',
  definition = null,
  candles = [],
  isHidden = false,
  onToggleHide = () => {},
  onClose = () => {},
  onVisibleRangeChange = () => {},
  onCrosshairMove = () => {},
}, ref) {
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const seriesRefs     = useRef({});
  const syncedHairRef  = useRef(null);
  const isHoveringRef  = useRef(false);
  const candlesRef     = useRef(candles);
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);
  const cfg = OSC_CONFIG[oscType] || OSC_CONFIG.rsi;

  useEffect(() => {
    try {
      const base = getChartBaseOptions(theme);
      chartRef.current?.applyOptions({
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: base.layout.textColor },
        grid: base.grid,
        rightPriceScale: { borderColor: base.rightPriceScale.borderColor, textColor: base.rightPriceScale.textColor },
        timeScale: { borderColor: base.timeScale.borderColor, textColor: base.timeScale.textColor },
      });
    } catch {}
  }, [theme]);

  // DOM refs for zero-latency legend updates
  const val1Ref  = useRef(null);
  const val2Ref  = useRef(null);
  const val3Ref  = useRef(null);

  useEffect(() => { candlesRef.current = candles; }, [candles]);

  const updateLegend = useCallback((candle) => {
    if (!candle) return;
    if (oscType === 'rsi' || oscType === 'mfi') {
      const v = candle[oscType];
      if (val1Ref.current) {
        val1Ref.current.textContent = fmt(v);
        const n = Number(v);
        val1Ref.current.style.color = n >= 70 ? '#EF5350' : n <= 30 ? '#10B981' : cfg.color;
      }
    } else if (oscType === 'macd') {
      if (val1Ref.current) val1Ref.current.textContent = fmt(candle.macd);
      if (val2Ref.current) val2Ref.current.textContent = fmt(candle.macd_signal);
      if (val3Ref.current) {
        const h = Number(candle.macd_hist);
        val3Ref.current.textContent = (h >= 0 ? '+' : '') + fmt(candle.macd_hist);
        val3Ref.current.style.color = h >= 0 ? '#26A69A' : '#EF5350';
      }
    } else if (oscType === 'stoch' || oscType === 'stoch_rsi') {
      const kField = oscType === 'stoch' ? 'stoch_k' : 'stoch_rsi_k';
      const dField = oscType === 'stoch' ? 'stoch_d' : 'stoch_rsi_d';
      if (val1Ref.current) val1Ref.current.textContent = fmt(candle[kField]);
      if (val2Ref.current) val2Ref.current.textContent = fmt(candle[dField]);
    } else if (oscType === 'cci') {
      if (val1Ref.current) {
        val1Ref.current.textContent = fmt(candle.cci);
        val1Ref.current.style.color = Number(candle.cci) >= 100 ? '#EF5350' : Number(candle.cci) <= -100 ? '#10B981' : cfg.color;
      }
    } else if (oscType === 'williams_r') {
      if (val1Ref.current) {
        val1Ref.current.textContent = fmt(candle.williams_r);
        val1Ref.current.style.color = Number(candle.williams_r) >= -20 ? '#EF5350' : Number(candle.williams_r) <= -80 ? '#10B981' : cfg.color;
      }
    } else if (oscType === 'obv') {
      if (val1Ref.current) {
        const v = Number(candle.obv);
        val1Ref.current.textContent = v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : fmt(v, 0);
      }
    } else if (oscType === 'adx') {
      if (val1Ref.current) val1Ref.current.textContent = fmt(candle.adx);
      if (val2Ref.current) val2Ref.current.textContent = fmt(candle.plus_di);
      if (val3Ref.current) val3Ref.current.textContent = fmt(candle.minus_di);
    } else if (oscType === 'atr') {
      if (val1Ref.current) val1Ref.current.textContent = fmt(candle.atr);
    } else if (oscType === 'elder_ray') {
      if (val1Ref.current) val1Ref.current.textContent = fmt(candle.elder_bull);
      if (val2Ref.current) val2Ref.current.textContent = fmt(candle.elder_bear);
    } else if (oscType === 'cmf') {
      if (val1Ref.current) {
        val1Ref.current.textContent = fmt(candle.cmf, 4);
        val1Ref.current.style.color = Number(candle.cmf) >= 0 ? '#10B981' : '#EF5350';
      }
    } else {
      // Engine-only oscillators
      const data = resolveSeries(oscType, definition, [candle]);
      const last = data.main[data.main.length - 1];
      if (val1Ref.current) val1Ref.current.textContent = fmt(last?.value);
    }
  }, [oscType, cfg.color, definition]);

  const resetLegendToLatest = useCallback(() => {
    const latest = candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length - 1] : null;
    if (latest) updateLegend(latest);
  }, [updateLegend]);

  useImperativeHandle(ref, () => ({
    setVisibleLogicalRange: (range) => {
      if (chartRef.current && range) {
        try { chartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
      }
    },
    setSyncedCrosshair: ({ x, time, source }) => {
      if (source === oscType) return;
      if (x != null && x > 0) {
        if (syncedHairRef.current) { syncedHairRef.current.style.left = `${x}px`; syncedHairRef.current.style.display = 'block'; }
        isHoveringRef.current = true;
        if (time && candlesRef.current.length > 0) {
          const matched = candlesRef.current.find(c => c.time === time);
          if (matched) updateLegend(matched);
        }
      } else {
        if (syncedHairRef.current) syncedHairRef.current.style.display = 'none';
        isHoveringRef.current = false;
        resetLegendToLatest();
      }
    },
    getChart: () => chartRef.current,
  }), [oscType, updateLegend, resetLegendToLatest]);

  // Chart creation
  useEffect(() => {
    if (!containerRef.current) return;

    const base = getChartBaseOptions(theme);
    const chart = createChart(containerRef.current, {
      height: 130,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: base.layout.textColor, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 },
      grid: base.grid,
      rightPriceScale: { borderColor: base.rightPriceScale.borderColor, textColor: base.rightPriceScale.textColor, scaleMargins: { top: 0.12, bottom: 0.12 }, autoScale: true, alignLabels: true, minimumWidth: 72 },
      timeScale: { visible: false, borderColor: 'rgba(99,102,241,0.12)', lockVisibleTimeRangeOnResize: true, rightOffset: 12, barSpacing: 9, minBarSpacing: 0.5, shiftVisibleRangeOnNewBar: false },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(129,140,248,0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' }, horzLine: { color: 'rgba(129,140,248,0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
      kineticScroll: { touch: true, mouse: true },
    });
    chartRef.current = chart;

    const refs = {};

    // Main line or histogram series
    if (oscType === 'elder_ray') {
      refs.main = chart.addHistogramSeries({ color: 'rgba(16,185,129,0.75)', title: 'Bull Power', priceFormat: { type: 'price', precision: 2, minMove: 0.05 } });
      refs.signal = chart.addHistogramSeries({ color: 'rgba(239,83,80,0.75)', title: 'Bear Power', priceFormat: { type: 'price', precision: 2, minMove: 0.05 } });
    } else {
      const precision = oscType === 'obv' || oscType === 'cvd' || oscType === 'volume_delta' ? 0 : oscType === 'cmf' || oscType === 'trix' ? 4 : oscType === 'roc' || oscType === 'momentum' ? 2 : 1;
      const minMove = precision === 0 ? 1 : precision === 4 ? 0.0001 : 0.1;
      refs.main = chart.addLineSeries({ color: cfg.color, lineWidth: 1.5, priceFormat: { type: 'price', precision, minMove } });
    }

    // Add reference bands
    if (cfg.hasBands) {
      cfg.hasBands.forEach((lvl, idx) => {
        const price = Array.isArray(lvl) ? lvl[0] : lvl;
        const color = Array.isArray(lvl) ? lvl[1] : (cfg.bandColors ? cfg.bandColors[idx] : 'rgba(255,255,255,0.15)');
        refs.main.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
      });
    }

    // Zero line
    if (cfg.zeroLine) {
      refs.main.createPriceLine({ price: 0, color: 'rgba(255,255,255,0.25)', lineWidth: 1, lineStyle: 1, axisLabelVisible: false });
    }

    // Signal line (stoch D, MACD signal, ADX DI+)
    if (cfg.hasSignal && oscType !== 'elder_ray') {
      if (oscType === 'macd') {
        refs.signal = chart.addLineSeries({ color: '#F97316', lineWidth: 1.5, title: 'Signal' });
        refs.hist = chart.addHistogramSeries({ priceFormat: { type: 'volume' } });
      } else if (oscType === 'adx') {
        refs.signal = chart.addLineSeries({ color: '#10B981', lineWidth: 1, title: '+DI' });
        refs.signal2 = chart.addLineSeries({ color: '#EF5350', lineWidth: 1, title: '-DI' });
      } else {
        refs.signal = chart.addLineSeries({ color: '#F97316', lineWidth: 1, lineStyle: 2, title: 'Signal' });
      }
    }

    // CMF histogram
    if (oscType === 'cmf') {
      refs.hist = chart.addHistogramSeries({ priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } });
    }

    // Volume delta histogram overlaid (single histogram for delta)
    if (oscType === 'volume_delta') {
      refs.main = chart.addHistogramSeries({ priceFormat: { type: 'price', precision: 0, minMove: 1 } });
    }

    seriesRefs.current = refs;

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => { if (range) onVisibleRangeChange(range, oscType); });
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        isHoveringRef.current = false;
        if (syncedHairRef.current) syncedHairRef.current.style.display = 'none';
        resetLegendToLatest();
        onCrosshairMove({ x: null, time: null, source: oscType });
        return;
      }
      isHoveringRef.current = true;
      onCrosshairMove({ x: param.point.x, time: param.time, source: oscType });
      const matched = candlesRef.current.find(c => c.time === param.time);
      if (matched) updateLegend(matched);
    });

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0) { chart.applyOptions({ width: e.contentRect.width }); }
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRefs.current = {}; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oscType]);

  // Data update
  const seriesData = useMemo(() => resolveSeries(oscType, definition, candles), [oscType, definition, candles]);

  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;
    const refs = seriesRefs.current;
    const { main, signal, signal2, hist } = seriesData;

    try {
      const set = (series, data) => { if (series) { try { series.setData(Array.isArray(data) ? data : []); } catch {} } };

      if (oscType === 'elder_ray') {
        set(refs.main, main.map((p) => ({ time: p.time, value: p.value, color: 'rgba(16,185,129,0.7)' })));
        set(refs.signal, signal.map((p) => ({ time: p.time, value: p.value, color: 'rgba(239,83,80,0.7)' })));
      } else if (oscType === 'macd') {
        set(refs.main, main);
        set(refs.signal, signal);
        if (refs.hist) {
          set(refs.hist, hist.map((p) => ({ time: p.time, value: p.value, color: Number(p.value) >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)' })));
        }
      } else if (oscType === 'cmf') {
        set(refs.main, main);
        if (refs.hist) {
          set(refs.hist, hist.map((p) => ({ time: p.time, value: p.value, color: Number(p.value) >= 0 ? 'rgba(16,185,129,0.55)' : 'rgba(239,83,80,0.55)' })));
        }
      } else if (oscType === 'volume_delta') {
        set(refs.main, main.map((p) => ({ time: p.time, value: p.value, color: Number(p.value) >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,83,80,0.7)' })));
      } else if (oscType === 'cvd') {
        set(refs.main, main);
      } else if (oscType === 'adx') {
        set(refs.main, main);
        set(refs.signal, signal);
        set(refs.signal2, signal2);
      } else {
        set(refs.main, main);
        set(refs.signal, signal);
      }

      // Visibility
      Object.values(refs).forEach(s => { try { s?.applyOptions({ visible: !isHidden }); } catch {} });
      resetLegendToLatest();
    } catch {}
  }, [seriesData, oscType, isHidden, resetLegendToLatest]);

  // Legend HUD content based on oscType — labels use theme-aware muted tone
  // (hardcoded slate-400 #94A3B8 is unreadable on white in light mode).
  const labelColor = tk.legendMuted;
  const subLabelColor = theme === 'light' ? '#475569' : '#64748B';
  const subLabel = { color: subLabelColor, fontSize: '0.62rem' };
  const renderLegend = () => {
    const dot = <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />;
    const single = (showDot = true) => (
      <>
        {showDot && dot}
        <span style={{ fontWeight: 700, color: labelColor }}>{cfg.label}</span>
        <span ref={val1Ref} style={{ fontWeight: 800, color: cfg.color, minWidth: 40 }}>—</span>
      </>
    );

    if (oscType === 'rsi' || oscType === 'mfi' || oscType === 'atr' || oscType === 'obv' || oscType === 'cci' || oscType === 'williams_r' || oscType === 'cmf') {
      return single();
    }
    if (oscType === 'macd') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: labelColor }}>MACD</span>
        <span style={subLabel}>MACD:</span>
        <strong ref={val1Ref} style={{ color: '#06B6D4' }}>—</strong>
        <span style={subLabel}>Sig:</span>
        <strong ref={val2Ref} style={{ color: '#F97316' }}>—</strong>
        <span style={subLabel}>H:</span>
        <strong ref={val3Ref} style={{ color: '#26A69A' }}>—</strong>
      </>;
    }
    if (oscType === 'stoch' || oscType === 'stoch_rsi') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: labelColor }}>{cfg.label}</span>
        <span style={subLabel}>%K:</span>
        <strong ref={val1Ref} style={{ color: cfg.color }}>—</strong>
        <span style={subLabel}>%D:</span>
        <strong ref={val2Ref} style={{ color: '#F97316' }}>—</strong>
      </>;
    }
    if (oscType === 'adx') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: labelColor }}>ADX</span>
        <span ref={val1Ref} style={{ fontWeight: 800, color: '#FBBF24', minWidth: 28 }}>—</span>
        <span style={{ color: '#10B981', fontSize: '0.62rem' }}>+DI</span>
        <strong ref={val2Ref} style={{ color: '#10B981' }}>—</strong>
        <span style={{ color: '#EF5350', fontSize: '0.62rem' }}>-DI</span>
        <strong ref={val3Ref} style={{ color: '#EF5350' }}>—</strong>
      </>;
    }
    if (oscType === 'elder_ray') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: labelColor }}>Elder Ray</span>
        <span style={subLabel}>Bull:</span>
        <strong ref={val1Ref} style={{ color: '#10B981' }}>—</strong>
        <span style={subLabel}>Bear:</span>
        <strong ref={val2Ref} style={{ color: '#EF5350' }}>—</strong>
      </>;
    }
    // Engine-only oscillators (roc, momentum, trix, hist_vol, std_dev, bb_width, choppiness, rel_volume, volume_delta, cvd)
    return single();
  };

  return (
    <div
      style={{ position: 'relative', width: '100%', height: 130, backgroundColor: tk.paneBg, borderTop: `1px solid ${tk.paneBorder}`, flexShrink: 0 }}
      onMouseLeave={() => {
        isHoveringRef.current = false;
        if (syncedHairRef.current) syncedHairRef.current.style.display = 'none';
        resetLegendToLatest();
        onCrosshairMove({ x: null, time: null, source: oscType });
      }}
    >
      {/* Synced hairline */}
      <div ref={syncedHairRef} style={{ position: 'absolute', top: 0, bottom: 0, width: 1, borderLeft: '1px dashed rgba(129,140,248,0.45)', pointerEvents: 'none', display: 'none', zIndex: 14 }} />

      {/* Legend HUD */}
      <div style={{ position: 'absolute', top: 5, left: 10, zIndex: 15, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, backgroundColor: tk.legendBg, backdropFilter: 'blur(6px)', border: `1px solid ${tk.legendBorder}`, fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: isHidden ? '#64748B' : tk.legendText, opacity: isHidden ? 0.6 : 1 }}>
        {renderLegend()}
        <button onClick={(e) => { e.stopPropagation(); onToggleHide(oscType); }} title={isHidden ? 'Show' : 'Hide'} style={{ background: 'transparent', border: 'none', color: isHidden ? '#64748B' : tk.legendMuted, cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', borderRadius: 2, marginLeft: 2 }} onMouseEnter={e => e.currentTarget.style.color=theme === 'light' ? '#0F172A' : '#F1F5F9'} onMouseLeave={e => e.currentTarget.style.color=isHidden ? '#64748B' : tk.legendMuted}>
          {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onClose(oscType); }} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', borderRadius: 2 }} title={`Close ${oscType.toUpperCase()} pane`} onMouseEnter={e => e.currentTarget.style.color='#EF5350'} onMouseLeave={e => e.currentTarget.style.color='#64748B'}>
          <X size={11} />
        </button>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});