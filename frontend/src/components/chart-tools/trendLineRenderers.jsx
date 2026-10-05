import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitLine,
  Label,
  strokeProps,
} from './drawingShapeParts';

// ── Trend line family ───────────────────────────────────────────────────────
function renderExtendedLine({ points, surface, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
  // Extended Line is infinite in both directions by default; the Extend
  // Left/Right settings let a user shrink it back to a plain segment.
  const [from, to] = G.applyLineExtension(
    a,
    b,
    {
      extendLeft: drawing.extendLeft ?? true,
      extendRight: drawing.extendRight ?? true,
    },
    surface,
  );
  return (
    <>
      <HitLine a={from} b={to} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
    </>
  );
}

function renderInfoLine({ points, surface, handlers, drawing, currency }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const stats = G.measureStats(a, b);
  const text = `${G.formatSignedPrice(stats.delta, currency)}  ${G.formatSignedPercent(stats.percent)}  ${stats.bars} bars`;
  const [from, to] = G.applyLineExtension(a, b, drawing, surface);
  return (
    <>
      <HitLine a={from} b={to} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
      <Label
        x={G.midpoint(a, b).x}
        y={G.midpoint(a, b).y - 14}
        text={text}
        color={stats.delta >= 0 ? '#26A69A' : '#EF5350'}
        align="center"
        bold
      />
    </>
  );
}

function renderTrendAngle({ points, surface, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const angle = G.trendAngle(a, b);
  const [from, to] = G.applyLineExtension(a, b, drawing, surface);
  return (
    <>
      <HitLine a={from} b={to} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      {/* baseline reference so the angle is readable */}
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={a.y}
        stroke="rgba(148,163,184,0.35)"
        strokeWidth={1}
        strokeDasharray="3 3"
        style={{ pointerEvents: 'none' }}
      />
      <path
        d={`M ${a.x + 26} ${a.y} A 26 26 0 ${Math.abs(angle) > 180 ? 1 : 0} ${angle >= 0 ? 0 : 1} ${a.x + 26 * Math.cos((angle * Math.PI) / 180)} ${a.y - 26 * Math.sin((angle * Math.PI) / 180)}`}
        fill="none"
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={1}
        strokeOpacity={0.6}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
      <Label x={a.x + 34} y={a.y - 12} text={`${angle.toFixed(2)}°`} color={drawing.color} bold />
    </>
  );
}

function renderVerticalLine({ points, surface, handlers, drawing }) {
  const [a] = points;
  const height = surface?.height || 0;
  const bottom = { x: a.x, y: height };
  return (
    <>
      <HitLine a={{ x: a.x, y: 0 }} b={bottom} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={0} x2={a.x} y2={bottom.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
    </>
  );
}

function renderCrossLine({ points, surface, handlers, drawing }) {
  const [a] = points;
  const width = surface?.width || 0;
  const height = surface?.height || 0;
  return (
    <>
      <HitLine a={{ x: 0, y: a.y }} b={{ x: width, y: a.y }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <HitLine a={{ x: a.x, y: 0 }} b={{ x: a.x, y: height }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={0} y1={a.y} x2={width} y2={a.y} {...strokeProps(drawing, { width: 1 })} style={{ pointerEvents: 'none' }} />
      <line x1={a.x} y1={0} x2={a.x} y2={height} {...strokeProps(drawing, { width: 1 })} style={{ pointerEvents: 'none' }} />
    </>
  );
}

function renderArrow({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const [barb1, barb2] = G.arrowHead(a, b, Math.max(12, (drawing.strokeWidth || 2) * 6));
  const head = G.polygonPath([b, barb1, barb2]);
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <path d={head} fill={drawing.color || '#38BDF8'} stroke="none" style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

export {
  renderExtendedLine,
  renderInfoLine,
  renderTrendAngle,
  renderVerticalLine,
  renderCrossLine,
  renderArrow,
};
