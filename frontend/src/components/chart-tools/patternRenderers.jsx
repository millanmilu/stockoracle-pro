import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitPath,
  Label,
} from './drawingShapeParts';

// ── Patterns ───────────────────────────────────────────────────────────────
function renderPattern({ points, handlers, drawing, labels }) {
  const d = G.polylinePath(points);
  const legs = G.patternLegRatios(points, labels.slice(1));
  return (
    <>
      <HitPath d={d} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={d}
        fill="none"
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
      {points.map((point, index) => (
        <g key={`pt-${index}`} style={{ pointerEvents: 'none' }}>
          <circle cx={point.x} cy={point.y} r={3.2} fill={drawing.color || '#38BDF8'} />
          <Label x={point.x + 10} y={point.y - 16} text={labels[index] || ''} color={drawing.color} bold />
        </g>
      ))}
      {legs.map((leg, index) =>
        leg.ratioLabel ? (
          <Label
            key={`ratio-${index}`}
            x={leg.x + 10}
            y={leg.y + 4}
            text={leg.ratioLabel}
            color={leg.bullish ? '#26A69A' : '#EF5350'}
          />
        ) : null,
      )}
    </>
  );
}

function renderHeadShoulders({ points, handlers, drawing }) {
  const [ls, t1, head, t2, rs] = points;
  // Placement preview renders with 1–4 anchors — the neckline needs
  // both shoulder anchors, so wait until they exist (same contract as
  // the other pattern renderers, which all `if (!c) return null`).
  if (!ls || !rs) return null;
  const neckFromY = t1?.y ?? ls.y;
  const neckToY = t2?.y ?? rs.y;
  return (
    <>
      {renderPattern({ points, handlers, drawing, labels: ['LS', 'T1', 'H', 'T2', 'RS'] })}
      <line
        x1={ls.x}
        y1={neckFromY}
        x2={rs.x}
        y2={neckToY}
        stroke="#EF5350"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        style={{ pointerEvents: 'none' }}
      />
      <Label
        x={(ls.x + rs.x) / 2}
        y={(neckFromY + neckToY) / 2 + 16}
        text="Neckline"
        color="#EF5350"
        align="center"
      />
      {head ? <Label x={head.x} y={head.y - 34} text="Head" color="#E2E8F0" align="center" /> : null}
    </>
  );
}

function renderTrianglePattern({ points, handlers, drawing }) {
  const [a, b, c] = points;
  if (!c) return null;
  const verts = G.trianglePatternVertices(a, b, c);
  return (
    <>
      {renderPattern({ points: verts.slice(0, 3), handlers, drawing, labels: ['1', '2', '3'] })}
      <line
        x1={verts[3].x}
        y1={verts[3].y}
        x2={verts[4].x}
        y2={verts[4].y}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={1}
        strokeDasharray="4 3"
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}
/** Pattern tools share one renderer, differing only by anchor labels. */
function makePatternRenderer(labels) {
  return function PatternRenderer(props) {
    return renderPattern({ ...props, labels });
  };
}

export {
  renderHeadShoulders,
  renderTrianglePattern,
  makePatternRenderer,
};
