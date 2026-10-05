import React from 'react';
import DrawingShape from './DrawingShape';
import { getLineDashArray, isDrawingVisibleOn, loadDrawingSettings, withDrawingDefaults } from './drawingSettingsSchema';
import { isExtendedTool } from './drawingToolCatalog';
import { renderSavedLineDrawing } from './savedLineDrawings';
import { renderSavedShapeDrawing } from './savedShapeDrawings';

// --- saved drawings layer ---

export function SavedDrawingsLayer({
  beginLegacyDrag, candles, chartToCoordCached, currSym, drawings, handleContextMenu,
  handleShapeDoubleClick, hiddenIds, interval, logicalToX, priceToY, resolveAnchorsCached,
  selectedDrawingId, selectedDrawingIds = [], startBodyDrag, startPointDrag, surfaceSize, timeframeMs
}) {
  const drawingTheme = loadDrawingSettings().theme;
  return drawings.map((storedDrawing) => {
            const d = withDrawingDefaults(storedDrawing);
            // Per-drawing visibility (TradingView eye toggle) — hidden objects vanish.
            if (hiddenIds.has(d.id) || d.hidden) return null;
            // TradingView Visibility tab — hidden on unchecked timeframes.
            if (!isDrawingVisibleOn(d, interval)) return null;
            // ── Extended (TradingView tool-set) drawings render via the registry ──
            // Legacy types (trendline, fib, brush…) keep their bespoke JSX below.
            if (isExtendedTool(d.type)) {
              const anchors = resolveAnchorsCached(d);
              if (!anchors.length) return null;
              return (
                <g
                  key={d.id}
                  data-drawing-id={d.id}
                  onContextMenu={(e) => handleContextMenu(e, d.id)}
                >
                  <DrawingShape
                    drawing={d}
                    points={anchors}
                    surface={surfaceSize}
                    currency={currSym}
                    timeframeMs={timeframeMs}
                    toX={logicalToX}
                    toY={priceToY}
                    candles={candles}
                    selected={selectedDrawingIds.includes(d.id) || selectedDrawingId === d.id}
                    handlers={{
                      onBodyDown: (e) => startBodyDrag(e, d.id),
                      onDoubleClick: (e) => handleShapeDoubleClick(e, d),
                    }}
                    onHandleDown={(e, index) => startPointDrag(e, d.id, index)}
                    onDoubleClick={(e) => handleShapeDoubleClick(e, d)}
                  />
                </g>
              );
            }

            const isSelected = selectedDrawingIds.includes(d.id) || selectedDrawingId === d.id;
            const pt1 = chartToCoordCached(d.startLogical, d.startPrice, d.startX, d.startY, d.startTime, d.startFrac, d.startOffMs);
            const pt2 = chartToCoordCached(d.endLogical,   d.endPrice,   d.endX,   d.endY, d.endTime, d.endFrac, d.endOffMs);

            const strokeDash = getLineDashArray(d.lineStyle, d.strokeWidth) || (isSelected ? '4,4' : 'none');
            const lineDrawing = renderSavedLineDrawing({
              beginLegacyDrag, chartToCoordCached, currSym, d, handleContextMenu, isSelected,
              pt1, pt2, startBodyDrag, strokeDash, surfaceSize,
            });
            if (lineDrawing) return React.cloneElement(lineDrawing, {
              opacity: isSelected ? drawingTheme.selectedOpacity : (d.locked ? drawingTheme.lockedOpacity : d.opacity),
            });
            const shapeDrawing = renderSavedShapeDrawing({
              beginLegacyDrag, chartToCoordCached, d, handleContextMenu, handleShapeDoubleClick,
              isSelected, pt1, pt2, startBodyDrag,
            });
            if (shapeDrawing) return React.cloneElement(shapeDrawing, {
              opacity: isSelected ? drawingTheme.selectedOpacity : (d.locked ? drawingTheme.lockedOpacity : d.opacity),
            });
            return null;
  });
}
