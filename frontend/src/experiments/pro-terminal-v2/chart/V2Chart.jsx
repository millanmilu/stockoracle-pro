// Pro Terminal V2 — Main Chart Component
// Independent lightweight-charts instance with crosshair, legend, price line,
// an SVG drawing overlay (create-only, anchored to time/price so drawings pan
// and zoom with the chart) and AI level overlays.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { CHART_ICU_LOCALE } from '../../../utils/theme';
import { V2_COLORS, V2_DRAWING_POINT_COUNT, getDrawingToolLabel } from '../utils/constants';
import { formatPrice, formatPercent } from '../utils/formatters';

const DRAW_STROKE = '#3B82F6';
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export default function V2Chart({
  candles,
  chartType,
  ema20,
  ema50,
  ema200,
  activeIndicators,
  currentPrice,
  symbol,
  interval,
  activeDrawingTool = 'cursor',
  drawings = [],
  onAddDrawing,
  drawingsLocked = false,
  magnetEnabled = false,
  allDrawingsHidden = false,
  aiAnalysis,
  activeAiIndicators = [],
  paneSync,
  apiRef,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const ema200Ref = useRef(null);
  const aiLinesRef = useRef([]);
  const [legendData, setLegendData] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewTick, setViewTick] = useState(0);
  const [draft, setDraft] = useState(null);

  const isDrawingTool = activeDrawingTool !== 'cursor' && activeDrawingTool !== 'magnet';
  const pointCount = V2_DRAWING_POINT_COUNT[activeDrawingTool] ?? 2;

  // ── Coordinate helpers (safe to call in render — read fresh refs) ────────
  const timeToX = (time) => {
    if (time == null || !chartRef.current) return null;
    return chartRef.current.timeScale().timeToCoordinate(time);
  };
  const priceToY = (price) => {
    if (price == null || !seriesRef.current) return null;
    return seriesRef.current.priceToCoordinate(price);
  };
  const toXY = (pt) => {
    if (!pt) return null;
    const x = timeToX(pt.time);
    const y = priceToY(pt.price);
    if (x == null || y == null) return null;
    return { x, y };
  };

  // ── Chart instance ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      localization: { locale: CHART_ICU_LOCALE },
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: V2_COLORS.text.secondary,
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 37, 50, 0.5)' },
        horzLines: { color: 'rgba(30, 37, 50, 0.5)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#4B5563', width: 1, style: 2, labelBackgroundColor: '#374151' },
        horzLine: { color: '#4B5563', width: 1, style: 2, labelBackgroundColor: '#374151' },
      },
      rightPriceScale: {
        borderColor: V2_COLORS.bg.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: V2_COLORS.bg.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;
    paneSync?.setMain(chart);

    // Create primary series
    let series;
    if (chartType === 'line') {
      series = chart.addLineSeries({
        color: V2_COLORS.accent.primary,
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: V2_COLORS.accent.primary,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else if (chartType === 'area') {
      series = chart.addAreaSeries({
        lineColor: V2_COLORS.accent.primary,
        topColor: 'rgba(59, 130, 246, 0.25)',
        bottomColor: 'rgba(59, 130, 246, 0.02)',
        lineWidth: 2,
        priceLineVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else if (chartType === 'bar') {
      series = chart.addBarSeries({
        upColor: V2_COLORS.positive,
        downColor: V2_COLORS.negative,
        priceLineVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else {
      series = chart.addCandlestickSeries({
        upColor: V2_COLORS.positive,
        downColor: V2_COLORS.negative,
        borderUpColor: V2_COLORS.positive,
        borderDownColor: V2_COLORS.negative,
        wickUpColor: V2_COLORS.positive,
        wickDownColor: V2_COLORS.negative,
        priceLineVisible: true,
        priceLineColor: V2_COLORS.accent.primary,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: V2_COLORS.bg.primary,
        crosshairMarkerBackgroundColor: V2_COLORS.accent.primary,
      });
    }
    seriesRef.current = series;

    // EMA series
    ema20Ref.current = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'EMA20',
    });
    ema50Ref.current = chart.addLineSeries({
      color: '#F97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'EMA50',
    });
    ema200Ref.current = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'EMA200',
    });

    // Crosshair move handler for legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setLegendData(null);
        return;
      }
      const data = param.seriesData?.get(series);
      if (data) {
        const o = data.open !== undefined ? data.open : undefined;
        const h = data.high !== undefined ? data.high : undefined;
        const l = data.low !== undefined ? data.low : undefined;
        const c = data.close !== undefined ? data.close : data.value;
        setLegendData({ o, h, l, c, time: param.time });
      }
    });

    // Pan/zoom → re-render drawing coordinates + push the range to sub-panes
    const onRangeChange = (range) => {
      setViewTick((t) => t + 1);
      paneSync?.onMainRange(range);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        if (width > 0 && h > 0) {
          chart.applyOptions({ width, height: h });
          setSize({ w: width, h });
        }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      paneSync?.setMain(null);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
    };
  }, [chartType, paneSync]);

  // Imperative API for the toolbar (screenshot / reset view)
  useEffect(() => {
    if (!apiRef) return undefined;
    apiRef.current = {
      screenshot() {
        try {
          const canvas = chartRef.current?.takeScreenshot?.();
          if (!canvas) return false;
          const link = document.createElement('a');
          link.download = `${symbol}-${interval}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          return true;
        } catch {
          return false;
        }
      },
      resetView() {
        if (!chartRef.current) return;
        chartRef.current.timeScale().fitContent();
        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      },
    };
    return () => { if (apiRef) apiRef.current = null; };
  }, [apiRef, symbol, interval]);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;

    let data;
    if (chartType === 'line' || chartType === 'area') {
      data = candles.map((c) => ({ time: c.time, value: c.close }));
    } else {
      data = candles;
    }
    seriesRef.current.setData(data);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, chartType]);

  // Update EMA overlays — chartType is a dependency because the chart (and
  // every series on it) is recreated when the chart type changes.
  useEffect(() => {
    if (!ema20Ref.current || !ema50Ref.current || !ema200Ref.current) return;

    ema20Ref.current.applyOptions({ visible: activeIndicators.includes('ema_20') });
    ema50Ref.current.applyOptions({ visible: activeIndicators.includes('ema_50') });
    ema200Ref.current.applyOptions({ visible: activeIndicators.includes('ema_200') });

    if (activeIndicators.includes('ema_20')) ema20Ref.current.setData(ema20);
    else ema20Ref.current.setData([]);
    if (activeIndicators.includes('ema_50')) ema50Ref.current.setData(ema50);
    else ema50Ref.current.setData([]);
    if (activeIndicators.includes('ema_200')) ema200Ref.current.setData(ema200);
    else ema200Ref.current.setData([]);
  }, [ema20, ema50, ema200, activeIndicators, chartType]);

  // AI level overlays (S/R, breakout, forecast) as price lines
  useEffect(() => {
    const removeLines = () => {
      for (const line of aiLinesRef.current) {
        try { line.remove(); } catch { /* chart/series already disposed */ }
      }
      aiLinesRef.current = [];
    };
    removeLines();

    const series = seriesRef.current;
    if (!series || !aiAnalysis) return undefined;

    const mk = (price, color, title) => {
      if (price == null || Number.isNaN(price)) return;
      try {
        aiLinesRef.current.push(series.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        }));
      } catch { /* ignore */ }
    };

    if (activeAiIndicators.includes('ai_sr')) {
      mk(aiAnalysis.support, 'rgba(16, 185, 129, 0.7)', 'AI Sup');
      mk(aiAnalysis.resistance, 'rgba(239, 68, 68, 0.7)', 'AI Res');
    }
    if (activeAiIndicators.includes('ai_breakout')) {
      mk(aiAnalysis.resistance, 'rgba(245, 158, 11, 0.9)', 'AI BOS');
    }
    if (activeAiIndicators.includes('ai_forecast')) {
      mk(aiAnalysis.target, 'rgba(59, 130, 246, 0.8)', 'AI TGT');
      mk(aiAnalysis.stopLoss, 'rgba(239, 68, 68, 0.6)', 'AI SL');
    }

    return removeLines;
  }, [activeAiIndicators, aiAnalysis, chartType]);

  // Price line color
  useEffect(() => {
    if (!seriesRef.current) return;
    const prevClose = candles[candles.length - 2]?.close || currentPrice;
    seriesRef.current.applyOptions({
      priceLineColor: currentPrice >= prevClose ? V2_COLORS.positive : V2_COLORS.negative,
    });
  }, [currentPrice, candles]);

  // Switching tools cancels any in-progress draft
  useEffect(() => {
    setDraft(null);
  }, [activeDrawingTool]);

  // ── Drawing input ────────────────────────────────────────────────────────
  const anchorFromEvent = useCallback((e) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = chart.timeScale().coordinateToTime(x);
    let price = series.coordinateToPrice(y);
    if (time == null || price == null) return null;
    if (magnetEnabled) {
      // Snap to the nearest visible candle close within 7px
      let best = null;
      let bestDist = 7;
      for (const c of candles) {
        const cy = series.priceToCoordinate(c.close);
        if (cy == null) continue;
        const d = Math.abs(cy - y);
        if (d < bestDist) { bestDist = d; best = c.close; }
      }
      if (best != null) price = best;
    }
    return { time, price };
  }, [candles, magnetEnabled]);

  const anchorsAreApart = useCallback((p1, p2) => {
    const x1 = timeToX(p1.time);
    const y1 = priceToY(p1.price);
    const x2 = timeToX(p2.time);
    const y2 = priceToY(p2.price);
    if (x1 == null || x2 == null || y1 == null || y2 == null) return false;
    return Math.abs(x1 - x2) > 5 || Math.abs(y1 - y2) > 5;
  }, []);

  const commitDraft = useCallback((d) => {
    if (!anchorsAreApart(d.p1, d.p2)) return; // needs a real drag / 2nd click
    onAddDrawing?.({ type: d.type, points: [d.p1, d.p2] });
    setDraft(null);
  }, [anchorsAreApart, onAddDrawing]);

  const commitInstant = useCallback((tool, anchor) => {
    if (tool === 'horizontal_line') {
      onAddDrawing?.({ type: tool, points: [{ time: null, price: anchor.price }] });
    } else if (tool === 'vertical_line') {
      onAddDrawing?.({ type: tool, points: [{ time: anchor.time, price: null }] });
    } else if (tool === 'price_label') {
      onAddDrawing?.({ type: tool, points: [anchor], text: formatPrice(anchor.price) });
    } else if (tool === 'text' || tool === 'callout') {
      const label = getDrawingToolLabel(tool);
      const text = window.prompt(`${label} text`, label);
      if (text == null || !text.trim()) return;
      onAddDrawing?.({ type: tool, points: [anchor], text: text.trim() });
    }
  }, [onAddDrawing]);

  const handleOverlayMouseDown = (e) => {
    if (e.button !== 0 || drawingsLocked) return;
    const anchor = anchorFromEvent(e);
    if (!anchor) return;
    if (pointCount === 1) {
      commitInstant(activeDrawingTool, anchor);
      return;
    }
    if (draft?.pending) {
      // Second click completes the pending drawing
      commitDraft({ ...draft, p2: anchor, pending: false });
      return;
    }
    setDraft({ type: activeDrawingTool, p1: anchor, p2: anchor, pending: true });
  };

  const handleOverlayMouseMove = (e) => {
    if (!draft) return;
    const anchor = anchorFromEvent(e);
    if (!anchor) return;
    setDraft({ ...draft, p2: anchor });
  };

  const handleOverlayMouseUp = (e) => {
    if (!draft) return;
    const anchor = anchorFromEvent(e);
    if (anchor && anchorsAreApart(draft.p1, anchor)) {
      commitDraft({ ...draft, p2: anchor, pending: false });
    }
    // No movement → keep the anchor pending for click-click placement
  };

  // ── Drawing rendering ────────────────────────────────────────────────────
  const renderDrawing = (d, isPreview = false) => {
    const pts = d.points || [];
    const a = toXY(pts[0]);
    const b = pts[1] ? toXY(pts[1]) : null;
    const stroke = DRAW_STROKE;
    const dash = isPreview ? '4 3' : undefined;
    const sw = 1.5;

    const line = (x1, y1, x2, y2, extra = {}) => (
      <line key={`${d.id}-l${x1}${y1}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke} strokeWidth={sw} strokeDasharray={dash} {...extra} />
    );

    switch (d.type) {
      case 'horizontal_line': {
        const y = priceToY(pts[0]?.price);
        if (y == null) return null;
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            {line(0, y, size.w, y)}
          </g>
        );
      }
      case 'vertical_line': {
        const x = timeToX(pts[0]?.time);
        if (x == null) return null;
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            {line(x, 0, x, size.h)}
          </g>
        );
      }
      case 'rectangle':
      case 'measure': {
        if (!a || !b) return null;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(a.x - b.x);
        const h = Math.abs(a.y - b.y);
        const isMeasure = d.type === 'measure';
        let label = null;
        let pct = 0;
        if (isMeasure && pts[0]?.price && pts[1]?.price) {
          const diff = pts[1].price - pts[0].price;
          pct = (diff / pts[0].price) * 100;
          label = `${formatChangeText(diff)} (${formatPercent(pct)})`;
        }
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            <rect x={x} y={y} width={w} height={h}
              fill="rgba(59, 130, 246, 0.08)" stroke={stroke} strokeWidth={sw}
              strokeDasharray={isMeasure ? '4 3' : dash} />
            {label && (
              <text x={x + w / 2} y={y - 4} fill={pct >= 0 ? V2_COLORS.positive : V2_COLORS.negative}
                fontSize={10} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                {label}
              </text>
            )}
          </g>
        );
      }
      case 'circle':
      case 'ellipse': {
        if (!a || !b) return null;
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            <ellipse cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2}
              rx={Math.abs(a.x - b.x) / 2} ry={Math.abs(a.y - b.y) / 2}
              fill="rgba(59, 130, 246, 0.08)" stroke={stroke} strokeWidth={sw}
              strokeDasharray={dash} />
          </g>
        );
      }
      case 'triangle_shape': {
        if (!a || !b) return null;
        const poly = `${a.x},${a.y} ${b.x},${a.y} ${b.x},${b.y}`;
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            <polygon points={poly} fill="rgba(59, 130, 246, 0.08)" stroke={stroke}
              strokeWidth={sw} strokeDasharray={dash} />
          </g>
        );
      }
      case 'ray': {
        if (!a || !b) return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let ex = b.x;
        let ey = b.y;
        if (dx !== 0) {
          const t = (dx > 0 ? size.w : 0) - a.x;
          ex = a.x + t;
          ey = a.y + (t / dx) * dy;
        } else if (dy !== 0) {
          const t = (dy > 0 ? size.h : 0) - a.y;
          ex = a.x;
          ey = a.y + t;
        }
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            {line(a.x, a.y, ex, ey)}
          </g>
        );
      }
      case 'arrow': {
        if (!a || !b) return null;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const head = 9;
        const p1x = b.x - head * Math.cos(angle - Math.PI / 6);
        const p1y = b.y - head * Math.sin(angle - Math.PI / 6);
        const p2x = b.x - head * Math.cos(angle + Math.PI / 6);
        const p2y = b.y - head * Math.sin(angle + Math.PI / 6);
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            {line(a.x, a.y, b.x, b.y)}
            <polygon points={`${b.x},${b.y} ${p1x},${p1y} ${p2x},${p2y}`} fill={stroke} />
          </g>
        );
      }
      case 'fib_retracement': {
        if (!a || !b) return null;
        const p1 = pts[0];
        const p2 = pts[1];
        const x1 = Math.min(a.x, b.x);
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            {FIB_LEVELS.map((lvl) => {
              const price = p1.price + (p2.price - p1.price) * lvl;
              const y = priceToY(price);
              if (y == null) return null;
              const isEdge = lvl === 0 || lvl === 1;
              return (
                <g key={`${d.id}-${lvl}`}>
                  <line x1={x1} y1={y} x2={size.w} y2={y}
                    stroke={isEdge ? stroke : 'rgba(59, 130, 246, 0.55)'}
                    strokeWidth={isEdge ? sw : 1}
                    strokeDasharray={isEdge ? dash : '3 3'} />
                  <text x={x1 + 4} y={y - 3} fill={V2_COLORS.text.muted} fontSize={9}
                    fontFamily="'JetBrains Mono', monospace">
                    {lvl.toFixed(3)} · {formatPrice(price)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }
      case 'text':
      case 'callout': {
        if (!a) return null;
        const text = d.text || getDrawingToolLabel(d.type);
        const w = text.length * 6.2 + 12;
        if (d.type === 'callout') {
          return (
            <g key={d.id} opacity={isPreview ? 0.7 : 1}>
              <rect x={a.x + 6} y={a.y - 22} width={w} height={20} rx={4}
                fill="rgba(28, 34, 48, 0.95)" stroke={stroke} strokeWidth={1} />
              <polygon points={`${a.x + 6},${a.y - 4} ${a.x + 2},${a.y} ${a.x + 14},${a.y - 4}`}
                fill="rgba(28, 34, 48, 0.95)" stroke={stroke} strokeWidth={1} />
              <text x={a.x + 12} y={a.y - 8} fill={V2_COLORS.text.primary} fontSize={11}>
                {text}
              </text>
            </g>
          );
        }
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            <text x={a.x + 4} y={a.y - 6} fill={V2_COLORS.text.primary} fontSize={12}
              fontWeight={600}>
              {text}
            </text>
          </g>
        );
      }
      case 'price_label': {
        if (!a) return null;
        const text = d.text || formatPrice(pts[0]?.price);
        const w = text.length * 6.4 + 12;
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            <rect x={a.x - w / 2} y={a.y - 24} width={w} height={18} rx={3}
              fill={stroke} />
            <text x={a.x} y={a.y - 11} fill="#fff" fontSize={11} fontWeight={600}
              textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
              {text}
            </text>
            <line x1={a.x} y1={a.y - 6} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={1} />
          </g>
        );
      }
      default: {
        // trend_line, info_line, regression_trend, channels, patterns, …
        if (!a || !b) return null;
        return (
          <g key={d.id} opacity={isPreview ? 0.7 : 1}>
            {line(a.x, a.y, b.x, b.y)}
          </g>
        );
      }
    }
  };

  const visibleDrawings = allDrawingsHidden
    ? []
    : drawings.filter((d) => (!d.symbol || d.symbol === symbol) && d.visible !== false);

  const isUp = currentPrice >= (candles[candles.length - 2]?.close || currentPrice);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 200 }}>
      {/* Legend overlay */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 8,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: 'none',
        flexWrap: 'wrap',
        maxWidth: 'calc(100% - 120px)',
      }}>
        <span style={{ color: V2_COLORS.text.primary, fontWeight: 600, fontSize: 12 }}>{symbol}</span>
        <span style={{ color: V2_COLORS.text.muted }}>{interval}</span>
        {legendData && (
          <>
            <LegendItem label="O" value={legendData.o} color={V2_COLORS.text.secondary} />
            <LegendItem label="H" value={legendData.h} color={V2_COLORS.positive} />
            <LegendItem label="L" value={legendData.l} color={V2_COLORS.negative} />
            <LegendItem label="C" value={legendData.c} color={isUp ? V2_COLORS.positive : V2_COLORS.negative} />
          </>
        )}
        {activeIndicators.includes('ema_20') && ema20.length > 0 && (
          <LegendItem label="EMA20" value={ema20[ema20.length - 1]?.value} color="#06B6D4" />
        )}
        {activeIndicators.includes('ema_50') && ema50.length > 0 && (
          <LegendItem label="EMA50" value={ema50[ema50.length - 1]?.value} color="#F97316" />
        )}
        {activeIndicators.includes('ema_200') && ema200.length > 0 && (
          <LegendItem label="EMA200" value={ema200[ema200.length - 1]?.value} color="#A855F7" />
        )}
        {aiAnalysis && activeAiIndicators.includes('ai_momentum') && (
          <LegendChip label="AI Mom" text={`${aiAnalysis.momentum}%`} color={V2_COLORS.positive} />
        )}
        {aiAnalysis && activeAiIndicators.includes('ai_pattern') && (
          <LegendChip label="AI Pat" text={aiAnalysis.pattern} color={V2_COLORS.accent.cyan} />
        )}
      </div>

      {/* Chart controls */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: 4,
      }}>
        <ChartControlButton label="Fit" title="Fit time range" onClick={() => chartRef.current?.timeScale().fitContent()} />
        <ChartControlButton label="Auto" title="Reset price scale to auto"
          onClick={() => chartRef.current?.priceScale('right').applyOptions({ autoScale: true })} />
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Drawing overlay — inert in cursor mode so the chart stays interactive */}
      <div
        onMouseDown={isDrawingTool ? handleOverlayMouseDown : undefined}
        onMouseMove={isDrawingTool ? handleOverlayMouseMove : undefined}
        onMouseUp={isDrawingTool ? handleOverlayMouseUp : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          pointerEvents: isDrawingTool ? 'auto' : 'none',
          cursor: isDrawingTool ? 'crosshair' : undefined,
        }}
      >
        <svg width={size.w || '100%'} height={size.h || '100%'} style={{ display: 'block' }}>
          {/* viewTick forces coordinate recompute after pan/zoom */}
          {Boolean(viewTick >= 0) && visibleDrawings.map((d) => renderDrawing(d))}
          {draft && renderDrawing({ id: '__draft__', type: draft.type, points: [draft.p1, draft.p2], text: draft.text }, true)}
        </svg>
      </div>
    </div>
  );
}

function LegendItem({ label, value, color }) {
  return (
    <span style={{ color: V2_COLORS.text.muted }}>
      {label} <span style={{ color, fontWeight: 500 }}>{value != null ? formatPrice(value) : '—'}</span>
    </span>
  );
}

function LegendChip({ label, text, color }) {
  return (
    <span style={{ color: V2_COLORS.text.muted }}>
      {label} <span style={{ color, fontWeight: 500 }}>{text}</span>
    </span>
  );
}

function ChartControlButton({ label, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title || label}
      style={{
        padding: '2px 6px',
        fontSize: 9,
        color: V2_COLORS.text.muted,
        background: 'rgba(30, 37, 50, 0.6)',
        border: '1px solid rgba(42, 49, 66, 0.5)',
        borderRadius: 3,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function formatChangeText(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}
