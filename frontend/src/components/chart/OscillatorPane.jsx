import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { Eye, EyeOff, X } from 'lucide-react';

/**
 * OscillatorPane — Universal Sub-Pane for All Oscillator Types
 * Synchronized with the main price chart via visible logical range and crosshair.
 *
 * Supported oscType values:
 *   rsi | macd | stoch | stoch_rsi | cci | williams_r | mfi | obv | adx | atr | elder_ray | cmf
 */

const OSC_CONFIG = {
  rsi:        { label: 'RSI (14)',        color: '#A855F7', hasSignal: false, hasBands: [70, 30], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  macd:       { label: 'MACD (12,26,9)', color: '#06B6D4', hasSignal: true,  hasBands: null,     zeroLine: true  },
  stoch:      { label: 'Stoch (14,3)',   color: '#3B82F6', hasSignal: true,  hasBands: [80, 20], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  stoch_rsi:  { label: 'StochRSI',      color: '#60A5FA', hasSignal: true,  hasBands: [80, 20], bandColors: ['rgba(239,83,80,0.4)','rgba(16,185,129,0.4)'], zeroLine: false },
  cci:        { label: 'CCI (20)',       color: '#F97316', hasSignal: false, hasBands: [100,-100],bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: true  },
  williams_r: { label: 'Williams %R',   color: '#EC4899', hasSignal: false, hasBands: [-20,-80], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  mfi:        { label: 'MFI (14)',       color: '#06B6D4', hasSignal: false, hasBands: [80, 20], bandColors: ['rgba(239,83,80,0.5)','rgba(16,185,129,0.5)'], zeroLine: false },
  obv:        { label: 'OBV',           color: '#10B981', hasSignal: false, hasBands: null,     zeroLine: true  },
  adx:        { label: 'ADX (14)',       color: '#FBBF24', hasSignal: true,  hasBands: [[25,'rgba(251,191,36,0.3)']], zeroLine: false },
  atr:        { label: 'ATR (14)',       color: '#FB923C', hasSignal: false, hasBands: null,     zeroLine: false },
  elder_ray:  { label: 'Elder Ray',     color: '#34D399', hasSignal: true,  hasBands: null,     zeroLine: true  },
  cmf:        { label: 'CMF (20)',       color: '#38BDF8', hasSignal: false, hasBands: null,     zeroLine: true  },
};

const OscillatorPane = forwardRef(function OscillatorPane({
  oscType = 'rsi',
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
  const cfg = OSC_CONFIG[oscType] || OSC_CONFIG.rsi;

  // DOM refs for zero-latency legend updates
  const val1Ref  = useRef(null);
  const val2Ref  = useRef(null);
  const val3Ref  = useRef(null);

  useEffect(() => { candlesRef.current = candles; }, [candles]);

  const updateLegend = useCallback((candle) => {
    if (!candle) return;
    const fmt = (v, d = 2) => (v != null && !isNaN(Number(v))) ? Number(v).toFixed(d) : '—';

    if (oscType === 'rsi' || oscType === 'mfi') {
      const v = candle[oscType === 'rsi' ? 'rsi' : 'mfi'];
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
    }
  }, [oscType, cfg.color]);

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

    const chart = createChart(containerRef.current, {
      height: 130,
      layout: { background: { type: 'solid', color: '#090C16' }, textColor: '#64748B', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(99,102,241,0.04)', style: 1 }, horzLines: { color: 'rgba(99,102,241,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(99,102,241,0.12)', textColor: '#64748B', scaleMargins: { top: 0.12, bottom: 0.12 }, autoScale: true, alignLabels: true, minimumWidth: 72 },
      timeScale: { visible: false, borderColor: 'rgba(99,102,241,0.12)', lockVisibleTimeRangeOnResize: true, rightOffset: 12, barSpacing: 9, minBarSpacing: 0.5, shiftVisibleRangeOnNewBar: false },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(129,140,248,0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' }, horzLine: { color: 'rgba(129,140,248,0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
      kineticScroll: { touch: true, mouse: true },
    });
    chartRef.current = chart;

    const refs = {};

    // Main line series
    refs.main = chart.addLineSeries({
      color: cfg.color, lineWidth: 1.5,
      priceFormat: { type: 'price', precision: oscType === 'obv' ? 0 : (oscType === 'cmf' ? 4 : 1), minMove: oscType === 'obv' ? 1 : (oscType === 'cmf' ? 0.0001 : 0.1) },
    });

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

    // Signal line (stoch D, MACD signal, ADX DI+, elder bear)
    if (cfg.hasSignal) {
      if (oscType === 'macd') {
        refs.signal = chart.addLineSeries({ color: '#F97316', lineWidth: 1.5, title: 'Signal' });
        refs.hist = chart.addHistogramSeries({ priceFormat: { type: 'volume' } });
      } else if (oscType === 'adx') {
        refs.signal = chart.addLineSeries({ color: '#10B981', lineWidth: 1, title: '+DI' });
        refs.signal2 = chart.addLineSeries({ color: '#EF5350', lineWidth: 1, title: '-DI' });
      } else if (oscType === 'elder_ray') {
        refs.signal = chart.addHistogramSeries({ title: 'Bear' });
      } else {
        refs.signal = chart.addLineSeries({ color: '#F97316', lineWidth: 1, lineStyle: 2, title: 'Signal' });
      }
    }

    // CMF histogram
    if (oscType === 'cmf') {
      refs.hist = chart.addHistogramSeries({ priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } });
    }

    // OBV — line only (main line)
    // ATR — line only (main line)

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
  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;
    const refs = seriesRefs.current;
    const filter = (field) => candles.filter(c => c[field] != null && !isNaN(Number(c[field]))).map(c => ({ time: c.time, value: Number(c[field]) }));

    try {
      if (oscType === 'rsi')        { refs.main?.setData(filter('rsi')); }
      else if (oscType === 'mfi')   { refs.main?.setData(filter('mfi')); }
      else if (oscType === 'cci')   { refs.main?.setData(filter('cci')); }
      else if (oscType === 'williams_r') { refs.main?.setData(filter('williams_r')); }
      else if (oscType === 'obv')   { refs.main?.setData(filter('obv')); }
      else if (oscType === 'atr')   { refs.main?.setData(filter('atr')); }
      else if (oscType === 'cmf') {
        refs.main?.setData(filter('cmf'));
        if (refs.hist) {
          const histData = candles.filter(c => c.cmf != null && !isNaN(Number(c.cmf))).map(c => ({
            time: c.time, value: Number(c.cmf),
            color: Number(c.cmf) >= 0 ? 'rgba(16,185,129,0.55)' : 'rgba(239,83,80,0.55)',
          }));
          refs.hist.setData(histData);
        }
      }
      else if (oscType === 'stoch') {
        refs.main?.setData(filter('stoch_k'));
        refs.signal?.setData(filter('stoch_d'));
      }
      else if (oscType === 'stoch_rsi') {
        refs.main?.setData(filter('stoch_rsi_k'));
        refs.signal?.setData(filter('stoch_rsi_d'));
      }
      else if (oscType === 'macd') {
        refs.main?.setData(filter('macd'));
        refs.signal?.setData(filter('macd_signal'));
        if (refs.hist) {
          const histData = candles.filter(c => c.macd_hist != null && !isNaN(Number(c.macd_hist))).map(c => ({
            time: c.time, value: Number(c.macd_hist),
            color: Number(c.macd_hist) >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)',
          }));
          refs.hist.setData(histData);
        }
      }
      else if (oscType === 'adx') {
        refs.main?.setData(filter('adx'));
        refs.signal?.setData(filter('plus_di'));
        refs.signal2?.setData(filter('minus_di'));
      }
      else if (oscType === 'elder_ray') {
        const bullData = candles.filter(c => c.elder_bull != null && !isNaN(Number(c.elder_bull))).map(c => ({
          time: c.time, value: Number(c.elder_bull), color: 'rgba(16,185,129,0.7)',
        }));
        refs.main?.setData(bullData);
        if (refs.signal) {
          const bearData = candles.filter(c => c.elder_bear != null && !isNaN(Number(c.elder_bear))).map(c => ({
            time: c.time, value: Number(c.elder_bear), color: 'rgba(239,83,80,0.7)',
          }));
          refs.signal.setData(bearData);
        }
      }

      // Visibility
      Object.values(refs).forEach(s => { try { s?.applyOptions({ visible: !isHidden }); } catch {} });
      resetLegendToLatest();
    } catch {}
  }, [candles, oscType, isHidden, resetLegendToLatest]);

  // Legend HUD content based on oscType
  const renderLegend = () => {
    const dot = <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />;
    if (oscType === 'rsi' || oscType === 'mfi' || oscType === 'atr' || oscType === 'obv' || oscType === 'cci' || oscType === 'williams_r' || oscType === 'cmf') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: '#94A3B8' }}>{cfg.label}</span>
        <span ref={val1Ref} style={{ fontWeight: 800, color: cfg.color, minWidth: 40 }}>—</span>
      </>;
    }
    if (oscType === 'macd') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: '#94A3B8' }}>MACD</span>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>MACD:</span>
        <strong ref={val1Ref} style={{ color: '#06B6D4' }}>—</strong>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>Sig:</span>
        <strong ref={val2Ref} style={{ color: '#F97316' }}>—</strong>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>H:</span>
        <strong ref={val3Ref} style={{ color: '#26A69A' }}>—</strong>
      </>;
    }
    if (oscType === 'stoch' || oscType === 'stoch_rsi') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: '#94A3B8' }}>{cfg.label}</span>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>%K:</span>
        <strong ref={val1Ref} style={{ color: cfg.color }}>—</strong>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>%D:</span>
        <strong ref={val2Ref} style={{ color: '#F97316' }}>—</strong>
      </>;
    }
    if (oscType === 'adx') {
      return <>
        {dot}
        <span style={{ fontWeight: 700, color: '#94A3B8' }}>ADX</span>
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
        <span style={{ fontWeight: 700, color: '#94A3B8' }}>Elder Ray</span>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>Bull:</span>
        <strong ref={val1Ref} style={{ color: '#10B981' }}>—</strong>
        <span style={{ color: '#64748B', fontSize: '0.62rem' }}>Bear:</span>
        <strong ref={val2Ref} style={{ color: '#EF5350' }}>—</strong>
      </>;
    }
    return <>{dot}<span ref={val1Ref} style={{ color: cfg.color }}>—</span></>;
  };

  return (
    <div
      style={{ position: 'relative', width: '100%', height: 130, backgroundColor: '#090C16', borderTop: '1px solid rgba(99,102,241,0.18)', flexShrink: 0 }}
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
      <div style={{ position: 'absolute', top: 5, left: 10, zIndex: 15, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, backgroundColor: 'rgba(11,15,28,0.88)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: isHidden ? '#64748B' : '#E2E8F0', opacity: isHidden ? 0.6 : 1 }}>
        {renderLegend()}
        <button onClick={(e) => { e.stopPropagation(); onToggleHide(oscType); }} title={isHidden ? 'Show' : 'Hide'} style={{ background: 'transparent', border: 'none', color: isHidden ? '#64748B' : '#94A3B8', cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', borderRadius: 2, marginLeft: 2 }} onMouseEnter={e => e.currentTarget.style.color='#F1F5F9'} onMouseLeave={e => e.currentTarget.style.color=isHidden ? '#64748B' : '#94A3B8'}>
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

export default OscillatorPane;
