import React from 'react';
import * as G from '../../utils/drawingGeometry';
import {
  AnchorDots,
  HitLine,
  HitPath,
  Label,
  PriceTag,
  strokeProps,
  tint,
} from './drawingShapeParts';

// ── Annotations ─────────────────────────────────────────────────────────────
function renderCallout({ points, handlers, drawing }) {
  const [a, b] = points;
  if (!a || !b) return null;
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
        <rect x={boxX} y={boxY} width={width} height={24} rx={5}
          fill={drawing.backgroundVisible === false ? 'transparent' : tint(drawing.backgroundColor || drawing.color, drawing.backgroundOpacity ?? 0.16)}
          stroke={drawing.borderVisible === false ? 'transparent' : (drawing.borderColor || drawing.color || '#38BDF8')}
          strokeWidth={drawing.borderWidth ?? 1.5} strokeOpacity={drawing.borderOpacity ?? 1} />
        <text x={boxX + 10} y={boxY + 16} fill={drawing.textColor || '#F1F5F9'}
          style={{ fontFamily: drawing.fontFamily || 'Trebuchet MS, sans-serif', fontSize: `${drawing.fontSize || 12}px`, fontWeight: drawing.fontBold === false ? 400 : 600, fontStyle: drawing.fontItalic ? 'italic' : 'normal' }}>
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
        <rect x={a.x} y={a.y} width={width} height={30} rx={3}
          fill={drawing.backgroundVisible === false ? 'transparent' : tint(drawing.backgroundColor || drawing.color, drawing.backgroundOpacity ?? 0.2)}
          stroke={drawing.borderVisible === false ? 'transparent' : (drawing.borderColor || drawing.color || '#38BDF8')}
          strokeWidth={drawing.borderWidth ?? 1.5} strokeOpacity={drawing.borderOpacity ?? 1} />
        <text x={a.x + 10} y={a.y + 19} fill={drawing.textColor || '#F8FAFC'}
          style={{ fontFamily: drawing.fontFamily || 'Trebuchet MS, sans-serif', fontSize: `${drawing.fontSize || 12}px`, fontWeight: drawing.fontBold === false ? 400 : 700, fontStyle: drawing.fontItalic ? 'italic' : 'normal' }}>
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
  if (!a || !b) return null;
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

export {
  renderCallout,
  renderNote,
  renderPriceLabel,
  renderPriceNote,
  renderFlag,
  renderPin,
};
