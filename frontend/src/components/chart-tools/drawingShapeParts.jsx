import React from 'react';
import * as G from '../../utils/drawingGeometry';

/**
 * Registry-driven renderer for the TradingView-style extended tool set.
 *
 * The component is intentionally coordinate-agnostic: `points` are already
 * resolved to chart pixels by DrawingTools, each point carrying
 * `{ x, y, logical, price }`. Legacy tools keep using their original JSX inside
 * DrawingTools.jsx — only types listed in `EXTENDED_TOOL_IDS` land here.
 */

const HANDLE_SIZE = 8;
const LABEL_FONT = '10px JetBrains Mono, monospace';
const LABEL_BG = 'rgba(15, 19, 29, 0.92)';

function dashArray(drawing) {
  return G.strokeDasharray(drawing.lineStyle, drawing.strokeWidth || 2);
}

function strokeProps(drawing, { width, opacity } = {}) {
  return {
    stroke: drawing.color || '#38BDF8',
    strokeWidth: width ?? drawing.strokeWidth ?? 2,
    strokeDasharray: dashArray(drawing),
    strokeOpacity: opacity,
    fill: 'none',
    vectorEffect: 'non-scaling-stroke',
  };
}

function tint(color, alpha) {
  const c = String(color || '#38BDF8');
  if (c.startsWith('#')) {
    const hex = c.length === 4
      ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
      : c;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

function Label({ x, y, text, color = '#E2E8F0', align = 'start', anchor = 'middle', bold = false }) {
  if (!text) return null;
  const width = String(text).length * 6.2 + 10;
  const left = align === 'end' ? x - width : align === 'center' ? x - width / 2 : x;
  const top = anchor === 'middle' ? y - 8 : y;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={left} y={top} width={width} height={16} rx={3} fill={LABEL_BG} stroke="rgba(148,163,184,0.25)" />
      <text
        x={left + width / 2}
        y={top + 11}
        textAnchor="middle"
        fill={color}
        style={{ font: LABEL_FONT, fontWeight: bold ? 700 : 600 }}
      >
        {text}
      </text>
    </g>
  );
}

function HitLine({ a, b, onDown, onDoubleClick, cursor }) {
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke="transparent"
      strokeWidth={12}
      style={{ cursor: cursor || 'move', pointerEvents: 'stroke' }}
      onMouseDown={onDown}
      onDoubleClick={onDoubleClick}
    />
  );
}

function HitPath({ d, onDown, onDoubleClick, cursor }) {
  return (
    <path
      d={d}
      stroke="transparent"
      strokeWidth={12}
      fill="transparent"
      style={{ cursor: cursor || 'move', pointerEvents: 'all' }}
      onMouseDown={onDown}
      onDoubleClick={onDoubleClick}
    />
  );
}

/** Selection handles at every anchor (TradingView shows these when selected). */
function Handles({ points, onHandleDown, onDoubleClick, color = '#2962FF' }) {
  if (!onHandleDown) return null;
  return (
    <g>
      {points.map((point, index) => (
        <rect
          key={`h-${index}`}
          x={point.x - HANDLE_SIZE / 2}
          y={point.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          rx={1.5}
          fill="#FFFFFF"
          stroke={color}
          strokeWidth={1.5}
          style={{ cursor: 'crosshair', pointerEvents: 'all' }}
          onMouseDown={(event) => onHandleDown(event, index)}
          onDoubleClick={onDoubleClick}
        />
      ))}
    </g>
  );
}

function AnchorDots({ points, color }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {points.map((point, index) => (
        <circle key={`d-${index}`} cx={point.x} cy={point.y} r={2.6} fill={color || '#38BDF8'} opacity={0.9} />
      ))}
    </g>
  );
}

/** Price tag drawn at the level, like TradingView's axis label. */
function PriceTag({ x, y, price, color }) {
  if (price == null || !Number.isFinite(Number(price))) return null;
  const text = `${Number(price).toFixed(2)}`;
  const width = text.length * 6.4 + 12;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={x} y={y - 9} width={width} height={18} rx={2} fill={color || '#2962FF'} />
      <text x={x + width / 2} y={y + 4} textAnchor="middle" fill="#FFFFFF" style={{ font: LABEL_FONT, fontWeight: 700 }}>
        {text}
      </text>
    </g>
  );
}

export {
  HANDLE_SIZE,
  LABEL_FONT,
  LABEL_BG,
  dashArray,
  strokeProps,
  tint,
  Label,
  HitLine,
  HitPath,
  Handles,
  AnchorDots,
  PriceTag,
};
