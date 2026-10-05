import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitPath,
  Label,
  strokeProps,
  tint,
} from './drawingShapeParts';

// ─ Prediction & measurement ───────────────────────────────────────────────
function renderForecast({ points, handlers, drawing, currency }) {
  const [a, b, c] = points;
  if (!c) return null;
  const { target, price2 } = G.forecastProjection(a, b, c);
  const delta = price2 - Number(c.price ?? 0);
  return (
    <>
      <HitPath d={G.polylinePath([a, b, c])} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} {...strokeProps(drawing, { opacity: 0.6 })} style={{ pointerEvents: 'none' }} />
      <line x1={c.x} y1={c.y} x2={target.x} y2={target.y} {...strokeProps(drawing, { opacity: 0.75 })} style={{ pointerEvents: 'none' }} />
      <AnchorDots points={[a, b, c]} color={drawing.color} />
      <AnchorDots points={[{ x: target.x, y: target.y }]} color={drawing.color} />
      <Label
        x={target.x}
        y={target.y - 14}
        text={`${G.formatSignedPrice(delta, currency)} @ ${Number(price2).toFixed(2)}`}
        color={delta >= 0 ? '#26A69A' : '#EF5350'}
        align="center"
        bold
      />
    </>
  );
}

function renderProjection({ points, handlers, drawing, currency }) {
  const [a, b, c] = points;
  if (!c) return null;
  const levels = G.projectionLevels(a, b, c);
  const left = Math.min(a.x, b.x, c.x);
  const right = Math.max(a.x, b.x, c.x) + 120;
  const delta = levels.level2.price - levels.level1.price;
  return (
    <>
      <HitPath d={G.polylinePath([a, b, c])} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing, { opacity: 0.5 })} style={{ pointerEvents: 'none' }} />
      <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} {...strokeProps(drawing, { opacity: 0.5 })} style={{ pointerEvents: 'none' }} />
      <line x1={left} y1={levels.level1.y} x2={right} y2={levels.level1.y} stroke={drawing.color || '#38BDF8'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
      <line x1={left} y1={levels.level2.y} x2={right} y2={levels.level2.y} stroke={drawing.color || '#38BDF8'} strokeWidth={1.5} strokeDasharray="5 4" style={{ pointerEvents: 'none' }} />
      <AnchorDots points={[a, b, c]} color={drawing.color} />
      <Label x={right} y={levels.level1.y - 8} text={Number(levels.level1.price).toFixed(2)} color={drawing.color} align="end" />
      <Label
        x={right}
        y={levels.level2.y - 8}
        text={`${Number(levels.level2.price).toFixed(2)} (${G.formatSignedPrice(delta, currency)})`}
        color={delta >= 0 ? '#26A69A' : '#EF5350'}
        align="end"
        bold
      />
    </>
  );
}

function renderBarsPattern({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const rect = G.normalizeRect(a, b);
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
        fill={tint(drawing.color, 0.08)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
      <Label x={rect.x + rect.width / 2} y={rect.y - 12} text="Bars pattern" color={drawing.color} align="center" />
    </>
  );
}

export {
  renderForecast,
  renderProjection,
  renderBarsPattern,
};
