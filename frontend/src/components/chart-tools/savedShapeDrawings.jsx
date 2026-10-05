import React from 'react';
import { getLineDashArray } from './drawingSettingsSchema';

// --- legacy shape renderers ---

export function renderSavedShapeDrawing(ctx) {
  const {
    beginLegacyDrag, chartToCoordCached, d, handleContextMenu, handleShapeDoubleClick,
    isSelected, pt1, pt2, startBodyDrag,
  } = ctx;

            // 8. Freehand Brush
            if (d.type === 'brush' && d.points?.length > 1) {
              const livePoints = d.points.map(pt => chartToCoordCached(pt.logical, pt.price, pt.x, pt.y, pt.time, pt.frac, pt.offMs));
              const pathData = livePoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
              return (
                <path
                  key={d.id}
                  d={pathData}
                  fill="none"
                  stroke={d.color || '#2962FF'}
                  strokeWidth={d.strokeWidth || 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                />
              );
            }

            // 9. Rectangle Zone
            if (d.type === 'rectangle') {
              const x = Math.min(pt1.x, pt2.x);
              const y = Math.min(pt1.y, pt2.y);
              const w = Math.abs(pt2.x - pt1.x);
              const h = Math.abs(pt2.y - pt1.y);
              // Corners: 0=TL, 1=TR, 2=BL, 3=BR. Dragging a corner keeps the
              // opposite corner fixed and redefines the box from
              // (opposite, cursor) — a true box resize from the grabbed
              // corner, like TradingView (handled by the `rect:i` branch in
              // processMove).
              const corners = [
                { cx: x, cy: y },
                { cx: x + w, cy: y },
                { cx: x, cy: y + h },
                { cx: x + w, cy: y + h },
              ];
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={d.backgroundVisible === false ? 'transparent' : (d.backgroundColor || 'rgba(56, 189, 248, 0.12)')}
                    fillOpacity={d.backgroundVisible === false ? 0 : d.backgroundOpacity}
                    stroke={d.borderVisible === false ? 'transparent' : (d.borderColor || d.color || '#2962FF')}
                    strokeWidth={d.borderWidth ?? d.strokeWidth ?? 1.5}
                    strokeOpacity={d.borderVisible === false ? 0 : d.borderOpacity}
                    strokeDasharray={getLineDashArray(d.lineStyle, d.strokeWidth) || (isSelected ? '4,4' : 'none')}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  {isSelected && (
                    <>
                      {corners.map((corner, i) => (
                        <circle
                          key={`corner-${i}`}
                          cx={corner.cx} cy={corner.cy} r={4.5} fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                          style={{ pointerEvents: 'all', cursor: (i === 0 || i === 3) ? 'nwse-resize' : 'nesw-resize' }}
                          onMouseDown={(e) => beginLegacyDrag(e, d.id, `rect:${i}`)}
                        />
                      ))}
                    </>
                  )}
                </g>
              );
            }

            // 10. Ruler / Measurement
            if (d.type === 'ruler') {
              const dx = Math.abs(pt2.x - pt1.x);
              const dy = pt1.y - pt2.y;
              const x = Math.min(pt1.x, pt2.x);
              const y = Math.min(pt1.y, pt2.y);
              const w = Math.abs(pt2.x - pt1.x);
              const h = Math.abs(pt2.y - pt1.y);
              const priceDelta = (d.startPrice != null && d.endPrice != null) ? d.endPrice - d.startPrice : dy * 0.45;
              const pricePercent = d.startPrice ? (priceDelta / d.startPrice) * 100 : (dy * 0.08);
              // Bar count from anchored logical indices (zoom-independent);
              // pixel guess is only a fallback for legacy drawings w/o anchors.
              const rulerBars = (d.startLogical != null && d.endLogical != null)
                ? Math.max(1, Math.round(Math.abs(d.endLogical - d.startLogical)))
                : Math.max(1, Math.round(dx / 8));

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={priceDelta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,83,80,0.15)'}
                    stroke={priceDelta >= 0 ? '#10B981' : '#EF5350'}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <text x={x + 6} y={y + 14} fill="#FFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} ({pricePercent.toFixed(2)}%) · {rulerBars} bars
                  </text>
                  {isSelected && (
                    <>
                      <circle
                        cx={pt1.x} cy={pt1.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                      />
                      <circle
                        cx={pt2.x} cy={pt2.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                      />
                    </>
                  )}
                </g>
              );
            }

            // 11. Text Note
            if (d.type === 'text') {
              return (
                <text
                  key={d.id}
                  x={pt1.x} y={pt1.y}
                  fill={d.textColor || d.color || '#F0F0FF'}
                  fontSize={d.fontSize || 12}
                  fontWeight={d.fontBold === false ? 400 : 600}
                  fontStyle={d.fontItalic ? 'italic' : 'normal'}
                  fontFamily={d.fontFamily || 'Trebuchet MS, sans-serif'}
                  textAnchor={d.textAlign === 'center' ? 'middle' : d.textAlign === 'right' ? 'end' : 'start'}
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onDoubleClick={(e) => handleShapeDoubleClick(e, d)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                >
                  {d.text}
                </text>
              );
            }

            // 12. Sticker Emoji
            if (d.type === 'sticker') {
              return (
                <text
                  key={d.id}
                  x={pt1.x - 10} y={pt1.y + 10}
                  fontSize="22"
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer', userSelect: 'none' }}
                >
                  {d.emoji}
                </text>
              );
            }
  return null;
}
