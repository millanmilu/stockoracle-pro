import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitLine,
  HitPath,
  Handles,
  LABEL_FONT,
  Label,
  PriceTag,
  strokeProps,
  tint,
} from './drawingShapeParts';

/**
 * Renderer registry for the TradingView-style extended tool set.
 *
 * Coordinate contract: `points` arrive already resolved to chart pixels, each
 * carrying `{ x, y, logical, price }`. `toX` / `toY` convert data-space values
 * back to pixels (used by the Fib time-zone tool). Legacy tools keep their own
 * JSX in DrawingTools.jsx — only `EXTENDED_TOOL_IDS` types land here.
 */

// ── Trend line family ───────────────────────────────────────────────────────
function renderExtendedLine({ points, surface, handlers, drawing }) {
  const [a, b] = points;
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

// ── Fibonacci & Gann tools ──────────────────────────────────────────────────
function renderFibExtension({ points, handlers, drawing }) {
  const [a, b, c] = points;
  if (!c) return null;
  const levels = G.fibExtensionLines(a, b, c);
  const x1 = Math.min(a.x, b.x, c.x);
  const band = Math.max(90, Math.max(a.x, b.x, c.x) - x1);
  return (
    <>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing, { width: 1, opacity: 0.55 })} style={{ pointerEvents: 'none' }} />
      <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} {...strokeProps(drawing, { width: 1, opacity: 0.55 })} style={{ pointerEvents: 'none' }} />
      <HitLine a={a} b={c} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      {levels.map((line, index) => (
        <g key={`lvl-${line.level}-${index}`} style={{ pointerEvents: 'none' }}>
          <line
            x1={x1}
            y1={line.y}
            x2={x1 + band}
            y2={line.y}
            stroke={drawing.color || '#38BDF8'}
            strokeWidth={1}
            strokeOpacity={0.75}
          />
          <Label
            x={x1 + band - 4}
            y={line.y - 8}
            text={`${line.level} — ${Number(line.price).toFixed(2)}`}
            color={drawing.color}
            align="end"
          />
        </g>
      ))}
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

/**
 * Regression Trend: least-squares fit through bar closes across the anchor
 * span, with parallel rails at ±2σ. Computed from real candle data (passed
 * as `candles`); falls back to a plain segment when too few bars resolve.
 */
function renderRegressionTrend({ points, handlers, drawing, candles, toX, toY }) {
  const [a, b] = points;
  if (!b) return null;
  const l0 = Math.round(Math.min(a.logical ?? 0, b.logical ?? 0));
  const l1 = Math.round(Math.max(a.logical ?? 0, b.logical ?? 0));
  let fit = null;
  try {
    if (Array.isArray(candles) && l1 - l0 >= 2 && toX && toY) {
      const xs = [];
      const ys = [];
      for (let i = l0; i <= l1; i += 1) {
        const c = Number(candles[i]?.close);
        if (Number.isFinite(c)) {
          xs.push(i);
          ys.push(c);
        }
      }
      if (xs.length >= 3) {
        const n = xs.length;
        const mx = xs.reduce((s, v) => s + v, 0) / n;
        const my = ys.reduce((s, v) => s + v, 0) / n;
        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i += 1) {
          num += (xs[i] - mx) * (ys[i] - my);
          den += (xs[i] - mx) * (xs[i] - mx);
        }
        if (den > 0) {
          const slope = num / den;
          const intercept = my - slope * mx;
          let sd = 0;
          for (let i = 0; i < n; i += 1) {
            const r = ys[i] - (slope * xs[i] + intercept);
            sd += r * r;
          }
          sd = Math.sqrt(sd / n);
          const px = (logical) => toX(logical);
          const py = (price) => toY(price);
          const x0 = px(l0);
          const x1 = px(l1);
          const yc0 = py(slope * l0 + intercept);
          const yc1 = py(slope * l1 + intercept);
          const yu0 = py(slope * l0 + intercept + 2 * sd);
          const yu1 = py(slope * l1 + intercept + 2 * sd);
          const yl0 = py(slope * l0 + intercept - 2 * sd);
          const yl1 = py(slope * l1 + intercept - 2 * sd);
          if ([x0, x1, yc0, yc1, yu0, yu1, yl0, yl1].every((v) => v != null && Number.isFinite(v))) {
            fit = { x0, x1, yc0, yc1, yu0, yu1, yl0, yl1, sd };
          }
        }
      }
    }
  } catch (_) {
    fit = null;
  }
  if (!fit) {
    // Honest fallback: not enough verifiable bars — plain segment only.
    return (
      <>
        <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
        <AnchorDots points={points} color={drawing.color} />
      </>
    );
  }
  const col = drawing.color || '#38BDF8';
  return (
    <>
      <HitLine a={{ x: fit.x0, y: fit.yc0 }} b={{ x: fit.x1, y: fit.yc1 }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <g style={{ pointerEvents: 'none' }}>
        <line x1={fit.x0} y1={fit.yu0} x2={fit.x1} y2={fit.yu1} {...strokeProps(drawing, { width: 1, opacity: 0.65 })} strokeDasharray="5,4" />
        <line x1={fit.x0} y1={fit.yc0} x2={fit.x1} y2={fit.yc1} {...strokeProps(drawing, { width: 2 })} />
        <line x1={fit.x0} y1={fit.yl0} x2={fit.x1} y2={fit.yl1} {...strokeProps(drawing, { width: 1, opacity: 0.65 })} strokeDasharray="5,4" />
        <Label x={fit.x1 + 4} y={Math.min(fit.yu0, fit.yu1) - 8} text={`+2σ ${fit.sd.toFixed(2)}`} color={drawing.color} align="start" />
        <Label x={fit.x1 + 4} y={Math.max(fit.yl0, fit.yl1) + 14} text="-2σ" color={drawing.color} align="start" />
      </g>
      <AnchorDots points={points} color={col} />
    </>
  );
}

function renderFibChannel({ points, handlers, drawing }) {
  const [a, b, c] = points;
  if (!c) return null;
  const rails = G.fibChannelLines(a, b, c);
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      {rails.map((rail, index) => (
        <g key={`rail-${rail.level}-${index}`} style={{ pointerEvents: 'none' }}>
          <line
            x1={rail.line[0].x}
            y1={rail.line[0].y}
            x2={rail.line[1].x}
            y2={rail.line[1].y}
            stroke={drawing.color || '#38BDF8'}
            strokeWidth={1}
            strokeOpacity={0.7}
          />
          <Label x={rail.line[1].x + 4} y={rail.line[1].y - 8} text={String(rail.level)} color={drawing.color} />
        </g>
      ))}
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderFibTimezone({ points, handlers, drawing, toX, surface }) {
  const [a] = points;
  const zones = G.fibTimezoneLines(a, a, 9);
  const height = surface?.height || 0;
  return (
    <>
      <HitLine a={{ x: a.x, y: 0 }} b={{ x: a.x, y: height }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={0} x2={a.x} y2={height} {...strokeProps(drawing, { width: 1 })} style={{ pointerEvents: 'none' }} />
      {zones.map((zone, index) => {
        const x = zone.logical != null && toX ? toX(zone.logical) : a.x + G.FIB_TIMEZONE_LEVELS[index] * 12;
        if (x == null || !Number.isFinite(x)) return null;
        return (
          <g key={`zone-${zone.level}`} style={{ pointerEvents: 'none' }}>
            <line x1={x} y1={0} x2={x} y2={height} stroke={drawing.color || '#38BDF8'} strokeWidth={1} strokeOpacity={0.45} />
            <Label x={x + 3} y={height - 22} text={String(zone.level)} color={drawing.color} />
          </g>
        );
      })}
    </>
  );
}

function renderFibFan({ points, handlers, drawing, surface }) {
  const [a, b] = points;
  if (!b) return null;
  const rays = G.fibFanRays(a, b);
  // Interpolate the price at each fan level from the anchor prices.
  const fromPrice = Number(a.price ?? 0);
  const span = Number(b.price ?? 0) - fromPrice;
  const fanPrices = {};
  rays.forEach((ray) => { fanPrices[ray.level] = fromPrice + span * ray.level; });
  // TradingView extends every fan ray to the chart edge — the label stays at
  // the anchor vertical (readable), the line runs to the surface boundary.
  const edgeFor = (through) => {
    if (!surface || !surface.width || !surface.height) return through;
    try {
      return G.edgeExit(a, through, surface);
    } catch {
      return through;
    }
  };
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing, { width: 1, opacity: 0.45 })} style={{ pointerEvents: 'none' }} />
      {rays.map((ray) => {
        const edge = edgeFor({ x: ray.x, y: ray.y });
        return (
          <g key={`fanray-${ray.level}`} style={{ pointerEvents: 'none' }}>
            <line
              x1={a.x}
              y1={a.y}
              x2={edge.x}
              y2={edge.y}
              stroke={drawing.color || '#38BDF8'}
              strokeWidth={1}
              strokeOpacity={0.75}
            />
          </g>
        );
      })}
      {/* Wide hit targets along each extended ray so the fan stays selectable */}
      {rays.map((ray) => {
        const edge = edgeFor({ x: ray.x, y: ray.y });
        return (
          <HitLine
            key={`fanhit-${ray.level}`}
            a={a}
            b={edge}
            onDown={handlers.onBodyDown}
            onDoubleClick={handlers.onDoubleClick}
          />
        );
      })}
      {rays.map((ray) => (
        <Label
          key={`fanlbl-${ray.level}`}
          x={ray.x - 6}
          y={ray.y - 8}
          text={`${ray.level} — ${Number(fanPrices[ray.level] ?? 0).toFixed(2)}`}
          color={drawing.color}
          align="end"
        />
      ))}
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderFibCircle({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!b) return null;
  const circles = G.fibCircles(a, b);
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      {circles
        .filter((circle) => circle.radius > 1)
        .map((circle) => (
          <circle
            key={`fibcircle-${circle.level}`}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.radius}
            fill="none"
            stroke={drawing.color || '#38BDF8'}
            strokeWidth={1}
            strokeOpacity={0.65}
            style={{ pointerEvents: 'none' }}
          />
        ))}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing, { width: 1, opacity: 0.5 })} style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderArc({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!b) return null;
  const d = G.arcPath(a, b, drawing.arcBulge ?? 0.35);
  if (!d) return null;
  return (
    <>
      <HitPath d={d} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path d={d} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderGannFan({ points, handlers, drawing, surface }) {
  const [a, b] = points;
  const rays = G.gannFanLines(a, b);
  // TradingView runs every Gann ray to the chart edge; labels stay near the
  // anchor vertical so they never pile up at the boundary.
  const edgeFor = (through) => {
    if (!surface || !surface.width || !surface.height) return through;
    try {
      return G.edgeExit(a, through, surface);
    } catch {
      return through;
    }
  };
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      {rays.map((ray, index) => {
        const edge = edgeFor(ray.end);
        return (
          <g key={`ray-${ray.deg}`} style={{ pointerEvents: 'none' }}>
            <line
              x1={a.x}
              y1={a.y}
              x2={edge.x}
              y2={edge.y}
              stroke={drawing.color || '#38BDF8'}
              strokeWidth={ray.deg === 45 ? Math.max(2, drawing.strokeWidth || 2) : 1}
              strokeOpacity={ray.deg === 45 ? 0.95 : 0.55}
            />
            {index % 2 === 0 && <Label x={ray.end.x - 26} y={ray.end.y - 8} text={`${ray.deg}°`} color={drawing.color} />}
          </g>
        );
      })}
      {/* Wide hit targets along each extended ray so the fan stays selectable */}
      {rays.map((ray) => (
        <HitLine
          key={`gannhit-${ray.deg}`}
          a={a}
          b={edgeFor(ray.end)}
          onDown={handlers.onBodyDown}
          onDoubleClick={handlers.onDoubleClick}
        />
      ))}
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderGannBox({ points, handlers, drawing }) {
  const [a, b] = points;
  const rect = G.normalizeRect(a, b);
  const grid = G.gannBoxLevels(a, b);
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
        fill={tint(drawing.color, 0.06)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        style={{ pointerEvents: 'none' }}
      />
      {grid.map((line, index) => (
        <g key={`grid-${line.level}-${index}`} style={{ pointerEvents: 'none' }}>
          <line x1={line.x} y1={rect.y} x2={line.x} y2={rect.y + rect.height} stroke={drawing.color || '#38BDF8'} strokeWidth={1} strokeOpacity={0.4} />
          <line x1={rect.x} y1={line.y} x2={rect.x + rect.width} y2={line.y} stroke={drawing.color || '#38BDF8'} strokeWidth={1} strokeOpacity={0.4} />
        </g>
      ))}
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function makePitchforkRenderer(variant) {
  return function PitchforkRenderer({ points, handlers, drawing }) {
    const [a, b, c] = points;
    if (!c) return null;
    const fork = G.pitchforkLines(a, b, c, variant);
    const lines = [fork.median, fork.upper, fork.lower];
    return (
      <>
        <HitLine a={a} b={c} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
        {lines.map((line, index) => (
          <line
            key={`fork-${index}`}
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke={drawing.color || '#38BDF8'}
            strokeWidth={index === 0 ? (drawing.strokeWidth || 2) : 1}
            strokeOpacity={index === 0 ? 0.95 : 0.6}
            style={{ pointerEvents: 'none' }}
          />
        ))}
        <AnchorDots points={points} color={drawing.color} />
      </>
    );
  };
}

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
        strokeOpacity={variant === 'highlighter' ? 0.32 : 1}
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
        fill={tint(drawing.color, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        strokeDasharray={undefined}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderEllipse({ points, handlers, drawing, forceCircle }) {
  const [a, b] = points;
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
        fill={tint(drawing.color, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
      {asCircle ? null : <AnchorDots points={[{ x: shape.cx, y: shape.cy }]} color={drawing.color} />}
    </>
  );
}

function renderTriangle({ points, handlers, drawing }) {
  const [a, b] = points;
  const verts = G.triangleFromBox(a, b);
  return (
    <>
      <HitPath d={G.polygonPath(verts)} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={G.polygonPath(verts)}
        fill={tint(drawing.color, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
        style={{ pointerEvents: 'none' }}
      />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

function renderFlatTopBottom({ points, handlers, drawing }) {
  const [a, b] = points;
  const quad = G.flatTopQuad(a, b);
  return (
    <>
      <HitPath d={G.polygonPath(quad)} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <path
        d={G.polygonPath(quad)}
        fill={tint(drawing.color, 0.1)}
        stroke={drawing.color || '#38BDF8'}
        strokeWidth={drawing.strokeWidth || 2}
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
      <path d={G.polygonPath(band)} fill={tint(drawing.color, 0.08)} stroke="none" style={{ pointerEvents: 'none' }} />
      <line x1={rail1[0].x} y1={rail1[0].y} x2={rail1[1].x} y2={rail1[1].y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <line x1={rail2[0].x} y1={rail2[0].y} x2={rail2[1].x} y2={rail2[1].y} {...strokeProps(drawing)} style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
    </>
  );
}

// ── Annotations ─────────────────────────────────────────────────────────────
function renderCallout({ points, handlers, drawing }) {
  const [a, b] = points;
  const text = drawing.text || 'Callout';
  const width = Math.max(70, text.length * 6.6 + 20);
  const boxX = b.x - 6;
  const boxY = b.y - 26;
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing, { width: 1.5 })} style={{ pointerEvents: 'none' }} />
      <circle cx={a.x} cy={a.y} r={3} fill={drawing.color || '#38BDF8'} style={{ pointerEvents: 'none' }} />
      <g style={{ pointerEvents: 'none' }}>
        <rect x={boxX} y={boxY} width={width} height={24} rx={5} fill={tint(drawing.color, 0.16)} stroke={drawing.color || '#38BDF8'} strokeWidth={1.5} />
        <text x={boxX + 10} y={boxY + 16} fill="#F1F5F9" style={{ font: LABEL_FONT, fontWeight: 600 }}>
          {text}
        </text>
      </g>
    </>
  );
}

function renderNote({ points, handlers, drawing }) {
  const [a] = points;
  const text = drawing.text || 'Note';
  const width = Math.max(76, text.length * 6.6 + 22);
  return (
    <>
      <HitPath d={G.polygonPath([{ x: a.x, y: a.y }, { x: a.x + width, y: a.y }, { x: a.x + width, y: a.y + 30 }, { x: a.x, y: a.y + 30 }])} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <g style={{ pointerEvents: 'none' }}>
        <rect x={a.x} y={a.y} width={width} height={30} rx={3} fill={tint(drawing.color, 0.2)} stroke={drawing.color || '#38BDF8'} strokeWidth={1.5} />
        <text x={a.x + 10} y={a.y + 19} fill="#F8FAFC" style={{ font: LABEL_FONT, fontWeight: 700 }}>
          {text}
        </text>
      </g>
    </>
  );
}

function renderPriceLabel({ points, handlers, drawing }) {
  const [a] = points;
  const price = a.price ?? drawing.startPrice;
  return (
    <>
      <HitLine a={a} b={{ x: a.x + 60, y: a.y }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={a.x + 60} y2={a.y} {...strokeProps(drawing, { width: 2 })} style={{ pointerEvents: 'none' }} />
      <PriceTag x={a.x + 64} y={a.y} price={price} color={drawing.color} />
      {drawing.text ? <Label x={a.x} y={a.y - 22} text={drawing.text} color="#E2E8F0" bold /> : null}
    </>
  );
}

function renderPriceNote({ points, handlers, drawing }) {
  const [a, b] = points;
  const delta = Number(b.price ?? 0) - Number(a.price ?? 0);
  const percent = a.price ? (delta / Number(a.price)) * 100 : 0;
  return (
    <>
      <HitLine a={a} b={b} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...strokeProps(drawing, { width: 1.5 })} style={{ pointerEvents: 'none' }} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={a.y} stroke="rgba(148,163,184,0.35)" strokeWidth={1} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />
      <AnchorDots points={points} color={drawing.color} />
      <Label
        x={G.midpoint(a, b).x}
        y={G.midpoint(a, b).y - 14}
        text={`${G.formatSignedPrice(delta)} (${G.formatSignedPercent(percent)})`}
        color={delta >= 0 ? '#26A69A' : '#EF5350'}
        align="center"
        bold
      />
    </>
  );
}

function renderFlag({ points, handlers, drawing }) {
  const [a] = points;
  const poleTop = a.y - 40;
  const flagPath = G.polygonPath([
    { x: a.x, y: poleTop },
    { x: a.x + 26, y: poleTop + 7 },
    { x: a.x, y: poleTop + 14 },
  ]);
  return (
    <>
      <HitLine a={a} b={{ x: a.x, y: poleTop }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <line x1={a.x} y1={a.y} x2={a.x} y2={poleTop} stroke={drawing.color || '#38BDF8'} strokeWidth={2} style={{ pointerEvents: 'none' }} />
      <path d={flagPath} fill={drawing.color || '#38BDF8'} style={{ pointerEvents: 'none' }} />
      {drawing.text ? <Label x={a.x + 32} y={poleTop} text={drawing.text} color={drawing.color} /> : null}
    </>
  );
}

function renderPin({ points, handlers, drawing }) {
  const [a] = points;
  const cy = a.y - 16;
  return (
    <>
      <HitLine a={a} b={{ x: a.x, y: cy }} onDown={handlers.onBodyDown} onDoubleClick={handlers.onDoubleClick} />
      <g style={{ pointerEvents: 'none' }}>
        <line x1={a.x} y1={a.y} x2={a.x} y2={cy + 6} stroke={drawing.color || '#38BDF8'} strokeWidth={2} />
        <circle cx={a.x} cy={cy} r={7} fill={tint(drawing.color, 0.25)} stroke={drawing.color || '#38BDF8'} strokeWidth={2} />
        <circle cx={a.x} cy={cy} r={2.5} fill={drawing.color || '#38BDF8'} />
      </g>
      {drawing.text ? <Label x={a.x + 12} y={cy - 18} text={drawing.text} color={drawing.color} /> : null}
    </>
  );
}

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

/** Pattern tools share one renderer, differing only by anchor labels. */
function makePatternRenderer(labels) {
  return function PatternRenderer(props) {
    return renderPattern({ ...props, labels });
  };
}

/**
 * Every extended-tool renderer, keyed by drawing type. DrawingShape dispatches
 * through this map so adding a tool = adding one entry (plus a catalog row).
 */
const SHAPE_RENDERERS = {
  // Trend lines
  extended_line: renderExtendedLine,
  info_line: renderInfoLine,
  trend_angle: renderTrendAngle,
  vertical_line: renderVerticalLine,
  cross_line: renderCrossLine,
  arrow: renderArrow,
  // Fibonacci & Gann
  fib_extension: renderFibExtension,
  fib_channel: renderFibChannel,
  regression_trend: renderRegressionTrend,
  fib_fan: renderFibFan,
  fib_circle: renderFibCircle,
  fib_timezone: renderFibTimezone,
  gann_fan: renderGannFan,
  gann_box: renderGannBox,
  pitchfork: makePitchforkRenderer('pitchfork'),
  schiff_pitchfork: makePitchforkRenderer('schiff'),
  inside_pitchfork: makePitchforkRenderer('inside'),
  // Shapes
  highlighter: (props) => renderFreehand({ ...props, variant: 'highlighter' }),
  polyline: (props) => renderFreehand({ ...props, variant: 'polyline' }),
  rotated_rectangle: renderRotatedRectangle,
  ellipse: renderEllipse,
  circle: (props) => renderEllipse({ ...props, forceCircle: true }),
  triangle: renderTriangle,
  arc: renderArc,
  flat_top_bottom: renderFlatTopBottom,
  disjoint_channel: renderDisjointChannel,
  // Annotations
  callout: renderCallout,
  note: renderNote,
  price_label: renderPriceLabel,
  price_note: renderPriceNote,
  flag: renderFlag,
  pin: renderPin,
  // Patterns
  xabcd: makePatternRenderer(['X', 'A', 'B', 'C', 'D']),
  cypher: makePatternRenderer(['X', 'A', 'B', 'C', 'D']),
  abcd: makePatternRenderer(['A', 'B', 'C', 'D']),
  three_drives: makePatternRenderer(['1', '2', '3', '4', '5']),
  head_shoulders: renderHeadShoulders,
  triangle_pattern: renderTrianglePattern,
  elliott_impulse: makePatternRenderer(G.elliottWaveLabels(6, 'impulse')),
  elliott_correction: makePatternRenderer(G.elliottWaveLabels(4, 'correction')),
  // Prediction & measurement
  forecast: renderForecast,
  projection: renderProjection,
  bars_pattern: renderBarsPattern,
  date_range: renderDateRange,
  price_range: renderPriceRange,
  date_price_range: renderDatePriceRange,
};

export { SHAPE_RENDERERS, makePatternRenderer, makePitchforkRenderer };
