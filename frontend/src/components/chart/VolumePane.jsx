import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CrosshairMode } from 'lightweight-charts';
import { safeCreateChart } from '../../utils/safeChart';
import { EyeOff, GripHorizontal } from 'lucide-react';
import useStore from '../../store/useStore';
import { getChartBaseOptions, getThemeTokens } from '../../utils/theme';
import { PRICE_AXIS_WIDTH, sanitizeSeriesData } from '../../utils/chartHelpers';

const MIN_HEIGHT = 92;
const MAX_HEIGHT = 360;

function formatVolume(value) {
  if (!Number.isFinite(value)) return '-';
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

const VolumePane = forwardRef(function VolumePane({
  candles = [],
  height = 132,
  onHeightChange = () => {},
  isHidden = false,
  onToggleHide = () => {},
  onVisibleRangeChange = () => {},
  onCrosshairMove = () => {},
  volumeMA = 20,
}, ref) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const volumeRef = useRef(null);
  const maRef = useRef(null);
  const candlesRef = useRef(candles);
  const hairlineRef = useRef(null);
  const tooltipRef = useRef(null);
  const valueRef = useRef(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const theme = useStore(s => s.theme);
  const tk = getThemeTokens(theme);

  useEffect(() => { candlesRef.current = candles; }, [candles]);

  useEffect(() => {
    try {
      if (!chartRef.current || chartRef.current.__isDisposed) return;
      const base = getChartBaseOptions(theme);
      chartRef.current.applyOptions({
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: base.layout.textColor },
        grid: base.grid,
        rightPriceScale: { borderColor: base.rightPriceScale.borderColor },
        timeScale: { borderColor: base.timeScale.borderColor },
      });
    } catch {}
  }, [theme]);

  const updateLegend = useCallback((candle) => {
    if (valueRef.current) valueRef.current.textContent = formatVolume(Number(candle?.volume));
  }, []);

  useImperativeHandle(ref, () => ({
    setVisibleLogicalRange: (range) => {
      if (!range || !chartRef.current || chartRef.current.__isDisposed) return;
      try { chartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
    },
    getChart: () => (chartRef.current && !chartRef.current.__isDisposed ? chartRef.current : null),
    setSyncedCrosshair: ({ x, time, source }) => {
      if (source === 'volume') return;
      if (x != null && x > 0) {
        if (hairlineRef.current) {
          hairlineRef.current.style.left = `${x}px`;
          hairlineRef.current.style.display = 'block';
        }
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${Math.min(x + 10, (containerRef.current?.clientWidth || 240) - 105)}px`;
          tooltipRef.current.style.display = 'block';
        }
        const candle = candlesRef.current.find(item => item.time === time);
        if (candle) {
          updateLegend(candle);
          if (tooltipRef.current) tooltipRef.current.textContent = `Volume ${formatVolume(Number(candle.volume))}`;
        }
      } else if (hairlineRef.current) {
        hairlineRef.current.style.display = 'none';
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        updateLegend(candlesRef.current[candlesRef.current.length - 1]);
      }
    },
  }), [updateLegend]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    const base = getChartBaseOptions(theme);
    const chart = safeCreateChart(containerRef.current, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: base.layout.textColor, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 },
      grid: base.grid,
      rightPriceScale: { borderColor: base.rightPriceScale.borderColor, textColor: base.rightPriceScale.textColor, scaleMargins: { top: 0.08, bottom: 0.05 }, autoScale: true, minimumWidth: PRICE_AXIS_WIDTH },
      timeScale: { visible: false, borderColor: base.timeScale.borderColor, rightOffset: 12, barSpacing: 9, minBarSpacing: 0.5, lockVisibleTimeRangeOnResize: true },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(129,140,248,0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' }, horzLine: { color: 'rgba(129,140,248,0.45)', width: 1, style: 2, labelBackgroundColor: '#1e1060' } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    const volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' } });
    const ma = chart.addLineSeries({ color: '#F59E0B', lineWidth: 1, priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chartRef.current = chart;
    volumeRef.current = volume;
    maRef.current = ma;
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => range && onVisibleRangeChange(range, 'volume'));
    chart.subscribeCrosshairMove(param => {
      if (!param.point || !param.time) {
        if (hairlineRef.current) hairlineRef.current.style.display = 'none';
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        updateLegend(candlesRef.current[candlesRef.current.length - 1]);
        onCrosshairMove({ x: null, time: null, source: 'volume' });
        return;
      }
      const candle = candlesRef.current.find(item => item.time === param.time);
      if (candle) {
        updateLegend(candle);
        if (tooltipRef.current) {
          tooltipRef.current.textContent = `Volume ${formatVolume(Number(candle.volume))}`;
          tooltipRef.current.style.left = `${Math.min(param.point.x + 10, (containerRef.current?.clientWidth || 240) - 105)}px`;
          tooltipRef.current.style.display = 'block';
        }
      }
      onCrosshairMove({ x: param.point.x, time: param.time, source: 'volume' });
    });
    const ro = new ResizeObserver(entries => entries.forEach(entry => {
      if (disposed) return;
      const { width, height: nextHeight } = entry.contentRect;
      if (width > 0 && nextHeight > 0) {
        try { chart.applyOptions({ width, height: nextHeight }); } catch {}
      }
    }));
    ro.observe(containerRef.current);
    return () => { disposed = true; ro.disconnect(); try { chart.remove(); } catch {} chartRef.current = null; volumeRef.current = null; maRef.current = null; };
  }, [onCrosshairMove, onVisibleRangeChange, updateLegend]);

  useEffect(() => {
    if (!volumeRef.current || volumeRef.current.__isDisposed || !candles.length) return;
    // Defense-in-depth: out-of-order `candles` would crash setData with
    // "data must be asc ordered by time". Sanitize first.
    const ordered = sanitizeSeriesData(candles);
    if (ordered.length === 0) return;
    const data = sanitizeSeriesData(ordered.map(c => ({ time: c.time, value: Number(c.volume || 0), color: Number(c.close) >= Number(c.open) ? 'rgba(38,166,154,0.65)' : 'rgba(239,83,80,0.65)' })));
    const maData = sanitizeSeriesData(ordered.map((c, index) => {
      const slice = ordered.slice(Math.max(0, index - volumeMA + 1), index + 1);
      return { time: c.time, value: slice.reduce((sum, item) => sum + Number(item.volume || 0), 0) / slice.length };
    }));
    try { volumeRef.current.setData(data); } catch {}
    try { maRef.current?.setData(maData); } catch {}
    try { volumeRef.current.applyOptions({ visible: !isHidden }); } catch {}
    try { maRef.current?.applyOptions({ visible: !isHidden }); } catch {}
    updateLegend(candles[candles.length - 1]);
  }, [candles, isHidden, volumeMA, updateLegend]);

  useEffect(() => {
    const move = event => { if (isDraggingRef.current) onHeightChange(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, window.innerHeight - event.clientY))); };
    const stop = () => { isDraggingRef.current = false; setIsDragging(false); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [onHeightChange]);

  return <div style={{ position: 'relative', height, flexShrink: 0, background: tk.paneBg, borderTop: `1px solid ${tk.paneBorder}`, display: isHidden ? 'none' : 'block' }}>
    <div role="separator" aria-label="Resize volume panel" onPointerDown={event => { event.preventDefault(); isDraggingRef.current = true; setIsDragging(true); }} style={{ position: 'absolute', top: -5, left: 0, right: 0, height: 10, zIndex: 20, cursor: 'ns-resize', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDragging ? '#A5B4FC' : '#475569' }}><GripHorizontal size={18} /></div>
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    <div ref={hairlineRef} style={{ position: 'absolute', top: 0, bottom: 0, width: 1, borderLeft: '1px dashed rgba(129,140,248,0.45)', pointerEvents: 'none', display: 'none', zIndex: 14 }} />
    <div ref={tooltipRef} role="tooltip" style={{ position: 'absolute', top: 30, left: 0, display: 'none', pointerEvents: 'none', zIndex: 16, padding: '3px 6px', borderRadius: 3, background: 'rgba(15,23,42,0.94)', border: '1px solid rgba(148,163,184,0.24)', color: '#E2E8F0', font: '600 0.66rem JetBrains Mono, monospace', whiteSpace: 'nowrap' }} />
    <div style={{ position: 'absolute', top: 6, left: 10, zIndex: 15, display: 'flex', alignItems: 'center', gap: 7, padding: '2px 8px', borderRadius: 4, background: tk.legendBg, border: `1px solid ${tk.legendBorder}`, color: tk.toolbarMuted, font: '700 0.68rem JetBrains Mono, monospace' }}>
      <span style={{ color: '#26A69A' }}>VOL</span><span>MA({volumeMA})</span><strong ref={valueRef} style={{ color: tk.legendText }}>-</strong>
      <button type="button" onClick={onToggleHide} title="Hide volume" aria-label="Hide volume" style={{ display: 'flex', padding: 1, color: tk.legendMuted, background: 'transparent', border: 0, cursor: 'pointer' }}><EyeOff size={11} /></button>
    </div>
  </div>;
});

export default VolumePane;