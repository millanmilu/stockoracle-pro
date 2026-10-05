import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitPath,
  Label,
  tint,
} from './drawingShapeParts';

// ── Range tools (TradingView parity — all respect Style/Visibility settings) ──
function rangeFill(drawing, fallbackAlpha) {
  if (drawing.backgroundVisible === false) return 'transparent';
  const base = drawing.backgroundColor || drawing.color || '#38BDF8';
  const alpha = drawing.backgroundOpacity ?? fallbackAlpha;
  return tint(base, alpha);
}
function rangeStroke(drawing) {
  if (drawing.borderVisible === false) return 'transparent';
  return drawing.borderColor || drawing.color || '#38BDF8';
}
function statsText(stats, drawing, currency) {
  const parts = [];
  if (drawing.showStatsBars !== false) parts.push(`${stats.bars} bars`);
  if (drawing.showStatsTime !== false && stats.durationMs) parts.push(G.formatDuration(stats.durationMs));
  return parts.join(' · ');
}
function priceText(stats, drawing, currency) {
  const showP = drawing.showStatsPrice !== false;
  const showPct = drawing.showStatsPercent !== false;
  if (showP && showPct) return `${G.formatSignedPrice(stats.delta, currency)} (${G.formatSignedPercent(stats.percent)})`;
  if (showP) return G.formatSignedPrice(stats.delta, currency);
  if (showPct) return G.formatSignedPercent(stats.percent);
  return '';
}

function renderDateRange({ points, handlers, drawing, timeframeMs }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const stats = G.dateRangeStats(a, b, timeframeMs);
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const y = Math.min(a.y, b.y);
  // TradingView parity: 50% time mid-line (vertical dashed at centre)
  const midX = (a.x + b.x) / 2;
  const showMid = (drawing.showMidLine !== false) && Math.abs(right - left) > 24;
  const label = statsText({ bars: stats.bars, durationMs: stats.durationMs }, drawing);
  return (
    <>
      <HitPath
        d={G.polygonPath([
          { x: left, y: y - 40 },
          { x: right, y: y - 40 },
          { x: right, y: y + 40 },
          { x: left, y: y + 40 },
        ])}
        onDown={handlers.onBodyDown}
        onDoubleClick={handlers.onDoubleClick}
      />
      <line x1={left} y1={y} x2={right} y2={y} stroke={drawing.color || '#38BDF8'} strokeWidth={drawing.strokeWidth || 1.5} style={{ pointerEvents: 'none' }} />
      <line x1={left} y1={y - 22} x2={left} y2={y + 22} stroke={drawing.color || '#38BDF8'} strokeWidth={drawing.strokeWidth || 1.5} style={{ pointerEvents: 'none' }} />
      <line x1={right} y1={y - 22} x2={right} y2={y + 22} stroke={drawing.color || '#38BDF8'} strokeWidth={drawing.strokeWidth || 1.5} style={{ pointerEvents: 'none' }} />
      {showMid && (
        <line
          x1={midX}
          y1={y - 22}
          x2={midX}
          y2={y + 22}
          stroke={drawing.color || '#38BDF8'}
          strokeWidth={1}
          strokeDasharray="4 3"
          strokeOpacity={0.85}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <AnchorDots points={points} color={drawing.color} />
      {label ? (
        <Label
          x={(left + right) / 2}
          y={y - 16}
          text={label}
          color={drawing.color}
          align="center"
          bold
        />
      ) : null}
      {showMid && (
        <Label
          x={midX}
          y={y + 30}
          text="50%"
          color={drawing.color}
          align="center"
        />
      )}
    </>
  );
}

function renderPriceRange({ points, handlers, drawing, currency }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const stats = G.measureStats(a, b);
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  // TradingView parity: 50% price mid-line (horizontal dashed at centre)
  const midY = (a.y + b.y) / 2;
  const midPrice = (Number(a.price ?? 0) + Number(b.price ?? 0)) / 2;
  const showMid = (drawing.showMidLine !== false) && Math.abs(bottom - top) > 24;
  const main = priceText(stats, drawing, currency);
  return (
    <>
      <HitPath
        d={G.polygonPath([{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }])}
        onDown={handlers.onBodyDown}
        onDoubleClick={handlers.onDoubleClick}
      />
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        fill={rangeFill(drawing, 0.14)}
        stroke={rangeStroke(drawing)}
        strokeWidth={drawing.borderWidth ?? drawing.strokeWidth ?? 1.5}
        style={{ pointerEvents: 'none' }}
      />
      {showMid && (
        <line
          x1={left}
          y1={midY}
          x2={right}
          y2={midY}
          stroke={drawing.color || '#38BDF8'}
          strokeWidth={1}
          strokeDasharray="4 3"
          strokeOpacity={0.9}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <AnchorDots points={points} color={drawing.color} />
      {main ? (
        <Label
          x={right + 6}
          y={(top + bottom) / 2}
          text={main}
          color={stats.delta >= 0 ? '#26A69A' : '#EF5350'}
          bold
        />
      ) : null}
      {showMid && Number.isFinite(midPrice) && drawing.showPrices !== false && (
        <Label
          x={(left + right) / 2}
          y={midY - 8}
          text={`50% ${Number(midPrice).toFixed(2)}`}
          color={drawing.color}
          align="center"
        />
      )}
    </>
  );
}

function renderDatePriceRange({ points, handlers, drawing, currency, timeframeMs }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const stats = G.measureStats(a, b, timeframeMs);
  const rect = G.normalizeRect(a, b);
  // TradingView parity: 50% middle lines — horizontal (price equilibrium) +
  // vertical (time midpoint), with the mid-price labelled.
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const midPrice = (Number(a.price ?? 0) + Number(b.price ?? 0)) / 2;
  const showMidH = (drawing.showMidLine !== false) && rect.height > 24;
  const showMidV = (drawing.showMidLine !== false) && rect.width > 24;
  const topLabel = statsText(stats, drawing, currency);
  const bottomLabel = priceText(stats, drawing, currency);
  return (
    <>
      <HitPath
        d={G.polygonPath([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }])}
        onDown={handlers.onBodyDown}
        onDoubleClick={handlers.onDoubleClick}
      />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={rangeFill(drawing, 0.1)}
        stroke={rangeStroke(drawing)}
        strokeWidth={drawing.borderWidth ?? drawing.strokeWidth ?? 1.5}
        style={{ pointerEvents: 'none' }}
      />
      {showMidV && (
        <line
          x1={midX}
          y1={rect.y}
          x2={midX}
          y2={rect.y + rect.height}
          stroke={drawing.color || '#38BDF8'}
          strokeWidth={1}
          strokeDasharray="4 3"
          strokeOpacity={0.65}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {showMidH && (
        <line
          x1={rect.x}
          y1={midY}
          x2={rect.x + rect.width}
          y2={midY}
          stroke={drawing.color || '#38BDF8'}
          strokeWidth={1}
          strokeDasharray="4 3"
          strokeOpacity={0.9}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <AnchorDots points={points} color={drawing.color} />
      {topLabel ? (
        <Label
          x={rect.x + rect.width / 2}
          y={rect.y - 12}
          text={topLabel}
          color={drawing.color}
          align="center"
          bold
        />
      ) : null}
      {showMidH && Number.isFinite(midPrice) && drawing.showPrices !== false && (
        <Label
          x={rect.x + rect.width / 2}
          y={midY - 8}
          text={`50% ${Number(midPrice).toFixed(2)}`}
          color={drawing.color}
          align="center"
          bold
        />
      )}
      {bottomLabel ? (
        <Label
          x={rect.x + 8}
          y={rect.y + rect.height + 10}
          text={bottomLabel}
          color={stats.delta >= 0 ? '#26A69A' : '#EF5350'}
        />
      ) : null}
    </>
  );
}

export {
  rangeFill,
  rangeStroke,
  renderDateRange,
  renderPriceRange,
  renderDatePriceRange,
};
