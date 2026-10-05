import React, { useMemo } from 'react';
import DrawingShape from './DrawingShape';
import { FIBONACCI_LEVELS } from './drawingToolsConstants';
import { getToolSpec, isExtendedTool } from './drawingToolCatalog';

// --- in-progress drawing preview ---

export function ActiveDrawingOverlay({
  activeColor, activeStrokeWidth, candles, currentDraw, currSym, logicalToX, pendingPoints,
  priceToY, snapIndicator, surfaceSize, timeframeMs
}) {
  // Registry preview anchors for the in-progress drawing — points-based shapes
  // use their live points directly; legacy start/end shapes are converted so
  // the preview path never depends on which flow created `currentDraw`.
  const previewAnchors = useMemo(() => {
    if (!currentDraw || !isExtendedTool(currentDraw.type)) return [];
    if (Array.isArray(currentDraw.points) && currentDraw.points.length) return currentDraw.points;
    if (currentDraw.startX != null && currentDraw.endX != null) {
      return [
        { x: currentDraw.startX, y: currentDraw.startY, logical: currentDraw.startLogical, price: currentDraw.startPrice },
        { x: currentDraw.endX, y: currentDraw.endY, logical: currentDraw.endLogical, price: currentDraw.endPrice },
      ];
    }
    return [];
  }, [currentDraw]);
  const previewSpec = currentDraw ? getToolSpec(currentDraw.type) : null;
  const previewIsExtended = Boolean(currentDraw && isExtendedTool(currentDraw.type) && previewAnchors.length);
  return (
    <>
          {currentDraw && (
            <>
              {/* Registry preview: every extended tool draws as-you-go through
                  the same renderer as the committed shape. Pointer events are
                  disabled so the preview never swallows the drag. When a
                  multi-anchor tool has too few points for its full renderer
                  (which returns null), the anchor dots + dashed guide below
                  still give placement feedback. */}
              {previewIsExtended && (
                <g style={{ pointerEvents: 'none' }} opacity={0.92}>
                  <DrawingShape
                    drawing={{ ...currentDraw, id: `preview-${currentDraw.id}` }}
                    points={previewAnchors}
                    surface={surfaceSize}
                    currency={currSym}
                    timeframeMs={timeframeMs}
                    toX={logicalToX}
                    toY={priceToY}
                    candles={candles}
                    selected={false}
                    handlers={{}}
                    onHandleDown={() => {}}
                    onDoubleClick={() => {}}
                  />
                  {currentDraw.pending && previewAnchors.length > 0 && (
                    <g>
                      {previewAnchors.map((pt, i) => (
                        <circle key={`pv-${i}`} cx={pt.x} cy={pt.y} r={3.5} fill="none" stroke={activeColor} strokeWidth={1.5} strokeDasharray="3 2" />
                      ))}
                      {previewAnchors.length > 1 && (
                        <polyline
                          points={previewAnchors.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                          fill="none"
                          stroke={activeColor}
                          strokeWidth={1}
                          strokeDasharray="4 3"
                          opacity={0.8}
                        />
                      )}
                      {previewSpec && typeof previewSpec.points === 'number' && previewSpec.points >= 3 && (
                        <text x={previewAnchors[previewAnchors.length - 1].x + 10} y={previewAnchors[previewAnchors.length - 1].y - 10} fill={activeColor} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                          {`${pendingPoints.length + 1} of ${previewSpec.points}`}
                        </text>
                      )}
                      {currentDraw.polyline && (
                        <text x={previewAnchors[previewAnchors.length - 1].x + 10} y={previewAnchors[previewAnchors.length - 1].y + 16} fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                          double-click / Enter to finish · Esc to cancel
                        </text>
                      )}
                    </g>
                  )}
                </g>
              )}
              {currentDraw.type === 'trendline' && (
                <line
                  x1={currentDraw.startX} y1={currentDraw.startY}
                  x2={currentDraw.endX} y2={currentDraw.endY}
                  stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'ray' && (
                <line
                  x1={currentDraw.startX} y1={currentDraw.startY}
                  x2={currentDraw.endX} y2={currentDraw.endY}
                  stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'parallel_channel' && (() => {
                const cWidth = currentDraw.channelWidth || 35;
                const pdx = currentDraw.endX - currentDraw.startX;
                const pdy = currentDraw.endY - currentDraw.startY;
                const pAngle = Math.atan2(pdy, pdx) - Math.PI / 2;
                const pOffX = Math.cos(pAngle) * cWidth;
                const pOffY = Math.sin(pAngle) * cWidth;
                return (
                  <g stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4">
                    <line
                      x1={currentDraw.startX + pOffX} y1={currentDraw.startY + pOffY}
                      x2={currentDraw.endX + pOffX} y2={currentDraw.endY + pOffY}
                    />
                    <line
                      x1={currentDraw.startX} y1={currentDraw.startY}
                      x2={currentDraw.endX} y2={currentDraw.endY}
                    />
                    <line
                      x1={currentDraw.startX - pOffX} y1={currentDraw.startY - pOffY}
                      x2={currentDraw.endX - pOffX} y2={currentDraw.endY - pOffY}
                    />
                  </g>
                );
              })()}
              {currentDraw.type === 'horizontal_line' && (
                <line
                  x1={0} y1={currentDraw.startY}
                  x2="100%" y2={currentDraw.startY}
                  stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'fibonacci' && (
                <g>
                  {FIBONACCI_LEVELS.map((fib) => {
                    const minY = Math.min(currentDraw.startY, currentDraw.endY);
                    const maxY = Math.max(currentDraw.startY, currentDraw.endY);
                    const height = maxY - minY;
                    const y = currentDraw.startY < currentDraw.endY ? minY + height * fib.level : maxY - height * fib.level;
                    return (
                      <line
                        key={fib.level}
                        x1={Math.min(currentDraw.startX, currentDraw.endX)}
                        y1={y}
                        x2={Math.min(currentDraw.startX, currentDraw.endX) + Math.max(300, Math.abs(currentDraw.endX - currentDraw.startX))}
                        y2={y}
                        stroke={fib.color} strokeWidth={1} strokeDasharray="3,3"
                      />
                    );
                  })}
                </g>
              )}
              {currentDraw.type === 'brush' && currentDraw.points?.length > 1 && (
                <path
                  d={currentDraw.points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')}
                  fill="none" stroke={activeColor} strokeWidth={activeStrokeWidth} strokeLinecap="round"
                />
              )}
              {currentDraw.type === 'rectangle' && (
                <rect
                  x={Math.min(currentDraw.startX, currentDraw.endX)}
                  y={Math.min(currentDraw.startY, currentDraw.endY)}
                  width={Math.abs(currentDraw.endX - currentDraw.startX)}
                  height={Math.abs(currentDraw.endY - currentDraw.startY)}
                  fill="rgba(41, 98, 255, 0.15)" stroke={activeColor} strokeWidth={activeStrokeWidth} strokeDasharray="4,4"
                />
              )}
              {currentDraw.type === 'ruler' && (
                <rect
                  x={Math.min(currentDraw.startX, currentDraw.endX)}
                  y={Math.min(currentDraw.startY, currentDraw.endY)}
                  width={Math.abs(currentDraw.endX - currentDraw.startX)}
                  height={Math.abs(currentDraw.endY - currentDraw.startY)}
                  fill="rgba(59, 130, 246, 0.2)" stroke="#3B82F6" strokeWidth={1} strokeDasharray="4,4"
                />
              )}
            </>
          )}

          {/* ── Magnet Snapping Visual Indicator (Glowing Cyan Dot) ── */}
          {snapIndicator && (
            <g>
              <circle
                cx={snapIndicator.x} cy={snapIndicator.y} r={7}
                fill="none" stroke="#00E5FF" strokeWidth={2}
                opacity={0.85}
              />
              <circle
                cx={snapIndicator.x} cy={snapIndicator.y} r={3.5}
                fill="#00E5FF"
              />
              <rect
                x={snapIndicator.x + 10} y={snapIndicator.y - 14}
                width={70} height={14} rx={2}
                fill="rgba(0, 229, 255, 0.2)" stroke="#00E5FF" strokeWidth={0.75}
              />
              <text
                x={snapIndicator.x + 14} y={snapIndicator.y - 3}
                fill="#00E5FF" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono, monospace"
              >
                {snapIndicator.label}
              </text>
            </g>
          )}
    </>
  );
}
