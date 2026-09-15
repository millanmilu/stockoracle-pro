import React from 'react';
import { SHAPE_RENDERERS } from './drawingShapeRenderers';
import { Handles } from './drawingShapeParts';

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
  onHandleDown,
  onDoubleClick,
}) {
  if (!drawing || !Array.isArray(points) || points.length === 0) return null;
  const render = SHAPE_RENDERERS[drawing.type];
  if (!render) return null;

  const content = render({ drawing, points, surface, handlers, currency, timeframeMs, toX });
  if (!content) return null;

  return (
    <g data-drawing-id={drawing.id}>
      {content}
      {selected ? (
        <Handles
          points={points}
          onHandleDown={onHandleDown}
          onDoubleClick={onDoubleClick}
          color={drawing.color || '#2962FF'}
        />
      ) : null}
    </g>
  );
}