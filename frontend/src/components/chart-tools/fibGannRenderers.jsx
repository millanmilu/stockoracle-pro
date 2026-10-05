import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitLine,
  HitPath,
  Label,
  strokeProps,
  tint,
} from './drawingShapeParts';

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
  if (!a || !b) return null;
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
  if (!a || !b) return null;
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

export {
  renderFibExtension,
  renderRegressionTrend,
  renderFibChannel,
  renderFibTimezone,
  renderFibFan,
  renderFibCircle,
  renderArc,
  renderGannFan,
  renderGannBox,
  makePitchforkRenderer,
};
