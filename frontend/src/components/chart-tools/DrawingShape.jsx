import React from 'react';
import { SHAPE_RENDERERS } from './drawingShapeRenderers';
import { Handles } from './drawingShapeParts';
import { loadDrawingSettings, withDrawingDefaults } from './drawingSettingsSchema';

/**
 * Dispatches a drawing to its extended-tool renderer and overlays selection
 * handles.
 *
 * `points` must already be resolved to chart pixels — each entry is
 * `{ x, y, logical, price }`. Legacy drawing types (trendline, rectangle,
 * brush, …) are rendered by their original JSX inside DrawingTools and never
 * reach this component.
 */
export default function DrawingShape({
  drawing,
  points = [],
  surface,
  handlers = {},
  selected = false,
  currency = '₹',
  timeframeMs = 0,
  toX,
  toY,
  candles = [],
  onHandleDown,
  onDoubleClick,
}) {
  if (!drawing || !Array.isArray(points) || points.length === 0) return null;
  const normalizedDrawing = withDrawingDefaults(drawing);
  const render = SHAPE_RENDERERS[normalizedDrawing.type];
  if (!render) return null;

  const content = render({ drawing: normalizedDrawing, points, surface, handlers, currency, timeframeMs, toX, toY, candles });
  if (!content) return null;
  const drawingTheme = loadDrawingSettings().theme;
  const effectiveOpacity = normalizedDrawing.locked ? drawingTheme.lockedOpacity : normalizedDrawing.opacity;

  return (
    <g data-drawing-id={drawing.id} opacity={selected ? drawingTheme.selectedOpacity : effectiveOpacity}>
      {content}
      {selected ? (
        <Handles
          points={points}
          onHandleDown={onHandleDown}
          onDoubleClick={onDoubleClick}
          color={drawingTheme.selectionColor || drawing.color || '#2962FF'}
          size={drawingTheme.controlPointSize}
          pointColor={drawingTheme.controlPointColor}
        />
      ) : null}
    </g>
  );
}