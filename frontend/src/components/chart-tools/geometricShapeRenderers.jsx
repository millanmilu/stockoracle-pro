import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  fillProps,
  HitPath,
  strokeProps,
} from './drawingShapeParts';

// ── Geometric shapes ────────────────────────────────────────────────────────
function renderFreehand({ points, drawing, handlers, variant }) {
  const d = G.polylinePath(points);
  const width = variant === 'highlighter' ? Math.max(10, (drawing.strokeWidth || 2) * 5) : (drawing.strokeWidth || 2);
  return (
    <>
      <HitPath d={d} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={d}
        fill="none"
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={width}
        strokeOpacity={(variant === 'highlighter' ? 0.32 : 1) * (drawing.opacity ?? 1)}
        strokeDasharray={G.strokeDasharray(drawing.lineStyle, width)}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderRotatedRectangle({ points, handlers, drawing }) {
  const [a, b, c] = points;
  if (!c) return null;
  const quad = G.channelQuad(a, b, G.signedPerpendicularOffset(a, b, c));
  return (
    <>
      <HitPath d={G.polygonPath(quad)} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={G.polygonPath(quad)}
        {...fillProps(drawing, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        strokeDasharray={G.strokeDasharray(drawing.lineStyle, drawing.strokeWidth || 2)}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderEllipse({ points, handlers, drawing, forceCircle }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const shape = forceCircle ? G.circleFromRadius(a, b) : G.ellipseFromBox(a, b);
  const asCircle = forceCircle || Math.abs(shape.rx - shape.ry) < 6;
  const outline = forceCircle
    ? `M ${shape.cx - shape.r} ${shape.cy} a ${shape.r} ${shape.r} 0 1 0 ${shape.r * 2} 0 a ${shape.r} ${shape.r} 0 1 0 ${-shape.r * 2} 0`
    : `M ${shape.cx - shape.rx} ${shape.cy} a ${shape.rx} ${shape.ry} 0 1 0 ${shape.rx * 2} 0 a ${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx * 2} 0`;
  return (
    <>
      <HitPath d={outline} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={outline}
        {...fillProps(drawing, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        strokeDasharray={G.strokeDasharray(drawing.lineStyle, drawing.strokeWidth || 2)}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
      {asCircle ? null : <AnchorDots points={[{ x: shape.cx, y: shape.cy }]} color={drawing.color} />}
    </>
  );
}

function renderTriangle({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const verts = G.triangleFromBox(a, b);
  return (
    <>
      <HitPath d={G.polygonPath(verts)} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={G.polygonPath(verts)}
        {...fillProps(drawing, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        strokeDasharray={G.strokeDasharray(drawing.lineStyle, drawing.strokeWidth || 2)}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderFlatTopBottom({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
  const quad = G.flatTopQuad(a, b);
  return (
    <>
      <HitPath d={G.polygonPath(quad)} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={G.polygonPath(quad)}
        {...fillProps(drawing, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        strokeDasharray={G.strokeDasharray(drawing.lineStyle, drawing.strokeWidth || 2)}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderDisjointChannel({ points, handlers, drawing }) {
  const [a, b, c, d] = points;
  if (!d) return null;
  const { rail1, rail2, band } = G.disjointChannelQuads(a, b, c, d);
  return (
    <>
      <HitPath d={G.polygonPath(band)} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path d={G.polygonPath(band)} {...fillProps(drawing, 0.08)} stroke="none" style={{ pointerEvents: 'none' }} />
      <line x1={rail1[0].x} y1={rail1[0].y} x2={rail1[1].x} y2={rail1[1].y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <line x1={rail2[0].x} y1={rail2[0].y} x2={rail2[1].x} y2={rail2[1].y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

export {
  renderFreehand,
  renderRotatedRectangle,
  renderEllipse,
  renderTriangle,
  renderFlatTopBottom,
  renderDisjointChannel,
};
