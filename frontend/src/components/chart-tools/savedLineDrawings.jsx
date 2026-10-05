import React from 'react';
import * as DG from '../../utils/drawingGeometry';
import { FIBONACCI_LEVELS } from './drawingToolsConstants';

// --- legacy line-shape renderers ---

export function renderSavedLineDrawing(ctx) {
  const {
    beginLegacyDrag, chartToCoordCached, currSym, d, handleContextMenu, isSelected, pt1, pt2,
    startBodyDrag, strokeDash, surfaceSize,
  } = ctx;

            // 1. Horizontal Line
            if (d.type === 'horizontal_line') {
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={0} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke={d.color || '#2962FF'} strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <circle
                    cx={10} cy={pt1.y} r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <rect
                    x={8} y={pt1.y - 18} width={75} height={16} rx={3}
                    fill="#131722" stroke={d.color || '#2962FF'} strokeWidth={1}
                  />
                  <text x={12} y={pt1.y - 6} fill={d.color || '#2962FF'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {currSym}{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // 2. Horizontal Ray
            if (d.type === 'horizontal_ray') {
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={pt1.x} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={pt1.x} y1={pt1.y} x2="100%" y2={pt1.y}
                    stroke={d.color || '#2962FF'} strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <circle cx={pt1.x} cy={pt1.y} r={isSelected ? 5 : 3.5} fill="#FFF" stroke={d.color || '#2962FF'} strokeWidth={1.5} />
                  <rect
                    x={pt1.x + 8} y={pt1.y - 18} width={75} height={16} rx={3}
                    fill="#131722" stroke={d.color || '#2962FF'} strokeWidth={1}
                  />
                  <text x={pt1.x + 12} y={pt1.y - 6} fill={d.color || '#2962FF'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                    {currSym}{d.startPrice?.toFixed(2)}
                  </text>
                </g>
              );
            }

            // 3. Trend Line
            if (d.type === 'trendline') {
              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                    stroke={d.color || '#2962FF'}
                    strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  {/* Start & End Handles */}
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                  />
                </g>
              );
            }

            // 4. Trend Ray (Ray extending to the chart edge, TradingView parity)
            if (d.type === 'ray') {
              let extPt = null;
              try {
                extPt = DG.edgeExit(pt1, pt2, surfaceSize);
              } catch (_) {
                extPt = null;
              }
              if (!extPt || !Number.isFinite(extPt.x) || !Number.isFinite(extPt.y)) {
                const dx = pt2.x - pt1.x;
                const dy = pt2.y - pt1.y;
                const angle = Math.atan2(dy, dx);
                const extendedLength = 3000;
                extPt = { x: pt1.x + Math.cos(angle) * extendedLength, y: pt1.y + Math.sin(angle) * extendedLength };
              }
              const extX = extPt.x;
              const extY = extPt.y;

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <line
                    x1={pt1.x} y1={pt1.y} x2={extX} y2={extY}
                    stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke' }}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  <line
                    x1={pt1.x} y1={pt1.y} x2={extX} y2={extY}
                    stroke={d.color || '#2962FF'}
                    strokeWidth={d.strokeWidth || 2}
                    strokeDasharray={strokeDash}
                  />
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 6 : 4}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                  />
                </g>
              );
            }

            // 5. Parallel Channel
            if (d.type === 'parallel_channel') {
              const cWidth = d.channelWidth || 35;
              const dx = pt2.x - pt1.x;
              const dy = pt2.y - pt1.y;
              const angle = Math.atan2(dy, dx);
              const perpAngle = angle - Math.PI / 2;

              const offX = Math.cos(perpAngle) * cWidth;
              const offY = Math.sin(perpAngle) * cWidth;

              const upperP1 = { x: pt1.x + offX, y: pt1.y + offY };
              const upperP2 = { x: pt2.x + offX, y: pt2.y + offY };
              const lowerP1 = { x: pt1.x - offX, y: pt1.y - offY };
              const lowerP2 = { x: pt2.x - offX, y: pt2.y - offY };

              const polyPoints = `${upperP1.x},${upperP1.y} ${upperP2.x},${upperP2.y} ${lowerP2.x},${lowerP2.y} ${lowerP1.x},${lowerP1.y}`;

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  {/* Channel Fill */}
                  <polygon
                    points={polyPoints}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="none"
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />
                  {/* Upper & Lower Channel Lines */}
                  <line x1={upperP1.x} y1={upperP1.y} x2={upperP2.x} y2={upperP2.y} stroke={d.color || '#2962FF'} strokeWidth={d.strokeWidth || 1.5} />
                  <line x1={lowerP1.x} y1={lowerP1.y} x2={lowerP2.x} y2={lowerP2.y} stroke={d.color || '#2962FF'} strokeWidth={d.strokeWidth || 1.5} />
                  {/* Median Line */}
                  <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y} stroke={d.color || '#2962FF'} strokeWidth={1} strokeDasharray="4,4" />

                  {/* Median endpoints — drag to reposition / resize the channel */}
                  <circle
                    cx={pt1.x} cy={pt1.y} r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                  />
                  <circle
                    cx={pt2.x} cy={pt2.y} r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#FFFFFF' : d.color || '#2962FF'}
                    stroke="#131722" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                  />

                  {/* Channel Width Handle */}
                  {isSelected && (
                    <circle
                      cx={upperP1.x} cy={upperP1.y} r={5}
                      fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                      style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                      onMouseDown={(e) => beginLegacyDrag(e, d.id, 'channel')}
                    />
                  )}
                </g>
              );
            }

            // 6. Long / Short Position (Risk:Reward Position Tool)
            if (d.type === 'long_position' || d.type === 'short_position') {
              const isLong = d.type === 'long_position';
              const entryY = pt1.y;
              const entryPrice = d.startPrice || 1000;
              const targetPrice = d.targetPrice || (isLong ? entryPrice * 1.03 : entryPrice * 0.97);
              const stopPrice   = d.stopPrice   || (isLong ? entryPrice * 0.985 : entryPrice * 1.015);

              const targetCoord = chartToCoordCached(d.startLogical, targetPrice, pt1.x, pt1.y - 60, d.startTime, d.startFrac, d.startOffMs);
              const stopCoord   = chartToCoordCached(d.startLogical, stopPrice, pt1.x, pt1.y + 40, d.startTime, d.startFrac, d.startOffMs);

              const targetY = targetCoord.y;
              const stopY   = stopCoord.y;

              const boxWidth = Math.max(160, Math.abs(pt2.x - pt1.x));
              const startX   = pt1.x;

              const targetDelta = Math.abs(targetPrice - entryPrice);
              const stopDelta   = Math.abs(stopPrice - entryPrice);
              const rrRatio     = stopDelta > 0 ? (targetDelta / stopDelta) : 0;
              const targetPct   = entryPrice > 0 ? ((targetDelta / entryPrice) * 100) : 0;
              const stopPct     = entryPrice > 0 ? ((stopDelta / entryPrice) * 100) : 0;

              const targetBoxTop    = Math.min(entryY, targetY);
              const targetBoxHeight = Math.abs(targetY - entryY);
              const stopBoxTop      = Math.min(entryY, stopY);
              const stopBoxHeight   = Math.abs(stopY - entryY);

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  {/* Target Box (Green) */}
                  <rect
                    x={startX} y={targetBoxTop} width={boxWidth} height={targetBoxHeight}
                    fill="rgba(16, 185, 129, 0.18)"
                    stroke="#10B981" strokeWidth={1}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />

                  {/* Stop Loss Box (Red) */}
                  <rect
                    x={startX} y={stopBoxTop} width={boxWidth} height={stopBoxHeight}
                    fill="rgba(239, 83, 80, 0.18)"
                    stroke="#EF5350" strokeWidth={1}
                    onMouseDown={(e) => startBodyDrag(e, d.id)}
                  />

                  {/* Entry Line */}
                  <line
                    x1={startX} y1={entryY} x2={startX + boxWidth} y2={entryY}
                    stroke="#38BDF8" strokeWidth={1.5} strokeDasharray="3,3"
                  />

                  {/* Info Badge */}
                  <rect
                    x={startX + 6} y={entryY - 12} width={boxWidth - 12} height={24} rx={4}
                    fill="rgba(15, 23, 42, 0.95)" stroke="#6366F1" strokeWidth={1}
                  />
                  <text
                    x={startX + 12} y={entryY + 4}
                    fill="#FFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace"
                  >
                    R:R {rrRatio.toFixed(2)} · TP +{currSym}{targetDelta.toFixed(1)} (+{targetPct.toFixed(1)}%) · SL -{currSym}{stopDelta.toFixed(1)} (-{stopPct.toFixed(1)}%)
                  </text>

                  {/* Target Handle */}
                  <circle
                    cx={startX + boxWidth / 2} cy={targetY} r={5}
                    fill="#10B981" stroke="#FFF" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'target')}
                  />

                  {/* Stop Handle */}
                  <circle
                    cx={startX + boxWidth / 2} cy={stopY} r={5}
                    fill="#EF5350" stroke="#FFF" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                    onMouseDown={(e) => beginLegacyDrag(e, d.id, 'stop')}
                  />

                  {/* Width Handle (right edge) — drag to extend the boxes in time */}
                  {isSelected && (
                    <circle
                      cx={startX + boxWidth} cy={entryY} r={5}
                      fill="#FFF" stroke="#2962FF" strokeWidth={1.5}
                      style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
                      onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                    />
                  )}
                </g>
              );
            }

            // 7. Fibonacci Retracement
            if (d.type === 'fibonacci') {
              const minY = Math.min(pt1.y, pt2.y);
              const maxY = Math.max(pt1.y, pt2.y);
              const height = maxY - minY;
              const startX = Math.min(pt1.x, pt2.x);
              const width = Math.max(300, Math.abs(pt2.x - pt1.x));

              return (
                <g
                  key={d.id}
                  style={{ pointerEvents: 'visiblePainted', cursor: isSelected ? 'move' : 'pointer' }}
                  onMouseDown={(e) => startBodyDrag(e, d.id)}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  {FIBONACCI_LEVELS.slice(0, -1).map((fib, idx) => {
                    const nextFib = FIBONACCI_LEVELS[idx + 1];
                    const y1 = pt1.y < pt2.y ? minY + height * fib.level : maxY - height * fib.level;
                    const y2 = pt1.y < pt2.y ? minY + height * nextFib.level : maxY - height * nextFib.level;
                    const bandTop = Math.min(y1, y2);
                    const bandHeight = Math.abs(y2 - y1);
                    if (d.backgroundVisible === false) return null;
                    return (
                      <rect
                        key={`band-${fib.level}`}
                        x={startX} y={bandTop} width={width} height={bandHeight}
                        fill={fib.fill}
                        opacity={d.backgroundOpacity != null ? Math.min(1, d.backgroundOpacity * 8) : 1}
                      />
                    );
                  })}

                  {(d.fibLevelsVisible ?? FIBONACCI_LEVELS.map((f) => f.level)).length >= 0 && FIBONACCI_LEVELS.filter((fib) => (d.fibLevelsVisible ?? FIBONACCI_LEVELS.map((f) => f.level)).includes(fib.level)).map((fib) => {
                    // TradingView-style custom level values: { 0.236: 0.35 }
                    const lvl = d.fibLevelValues?.[fib.level] ?? fib.level;
                    const y = pt1.y < pt2.y ? minY + height * lvl : maxY - height * lvl;
                    const pct = Math.round(lvl * 1000) / 10;
                    return (
                      <g key={fib.level}>
                        <line
                          x1={startX} y1={y} x2={startX + width} y2={y}
                          stroke={fib.color} strokeWidth={1}
                          strokeDasharray={isSelected ? '2,2' : 'none'}
                        />
                        <text
                          x={startX + 6} y={y - 4}
                          fill={fib.color} fontSize="10" fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {`${lvl} (${pct}%)`}
                        </text>
                      </g>
                    );
                  })}

                  {isSelected && (
                    <>
                      <circle
                        cx={pt1.x} cy={pt1.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'start')}
                      />
                      <circle
                        cx={pt2.x} cy={pt2.y} r={5} fill="#FFF" stroke="#2962FF" strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onMouseDown={(e) => beginLegacyDrag(e, d.id, 'end')}
                      />
                    </>
                  )}
                </g>
              );
            }
  return null;
}
