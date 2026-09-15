/**
 * StockOracle Pro — TradingView-style Drawing Tool Catalog
 *
 * Single source of truth for the left drawing toolbar: tool groups (flyouts),
 * per-tool anchor requirements and rendering ownership.
 *
 * `points` describes how many anchors the tool collects before it finishes:
 *   - 0        → cursor / mode tool (no drawing is created)
 *   - 1        → single click placement
 *   - 2..6     → click-to-place anchors (the last click finalises the drawing)
 *   - 'free'   → freehand stroke, released on mouse-up
 *
 * `legacy: true` means DrawingTools.jsx already renders and drags that type;
 * every other id is rendered by the registry-driven `DrawingShape` component.
 */

export const DRAWING_TOOL_GROUPS = [
  {
    id: 'cursors',
    label: 'Cursors',
    tools: [
      { id: 'cross', label: 'Cursor', points: 0, kind: 'cursor', hint: 'Select, move and edit objects' },
      { id: 'crosshair', label: 'Crosshair', points: 0, kind: 'cursor', hint: 'Default pointer — chart pans and zooms' },
      { id: 'dot', label: 'Dot', points: 0, kind: 'cursor', hint: 'Precision dot pointer' },
    ],
  },
  {
    id: 'lines',
    label: 'Trend Line Tools',
    tools: [
      { id: 'trendline', label: 'Trend Line', points: 2, legacy: true, hint: 'Click-drag a straight trend line' },
      { id: 'ray', label: 'Ray', points: 2, legacy: true, hint: 'Extends to the right edge of the chart' },
      { id: 'extended_line', label: 'Extended Line', points: 2, hint: 'Infinite line in both directions' },
      { id: 'info_line', label: 'Info Line', points: 2, hint: 'Line with price change, % and bar count' },
      { id: 'trend_angle', label: 'Trend Angle', points: 2, hint: 'Line labelled with its screen angle' },
      { id: 'horizontal_line', label: 'Horizontal Line', points: 1, legacy: true, hint: 'Price level line across the chart' },
      { id: 'horizontal_ray', label: 'Horizontal Ray', points: 1, legacy: true, hint: 'Price level from the click to the right' },
      { id: 'vertical_line', label: 'Vertical Line', points: 1, hint: 'Time marker for a single bar' },
      { id: 'cross_line', label: 'Cross Line', points: 1, hint: 'Full-width + full-height crosshair' },
    ],
  },
  {
    id: 'fib_gann',
    label: 'Gann and Fibonacci Tools',
    tools: [
      { id: 'fibonacci', label: 'Fib Retracement', points: 2, legacy: true, hint: 'Retracement levels between two anchors' },
      { id: 'fib_extension', label: 'Trend-based Fib Extension', points: 3, hint: 'Projects the AB move from C' },
      { id: 'fib_channel', label: 'Fib Channel', points: 3, hint: 'Parallel Fibonacci rails' },
      { id: 'fib_timezone', label: 'Fib Time Zone', points: 1, hint: 'Vertical lines at Fibonacci bar counts' },
      { id: 'gann_fan', label: 'Gann Fan', points: 2, hint: 'Nine Gann angle rays' },
      { id: 'gann_box', label: 'Gann Box', points: 2, hint: 'Retracement grid inside a box' },
      { id: 'pitchfork', label: "Andrew's Pitchfork", points: 3, hint: 'Median line with two parallel tines' },
      { id: 'schiff_pitchfork', label: 'Schiff Pitchfork', points: 3, hint: 'Schiff variant of the pitchfork' },
      { id: 'inside_pitchfork', label: 'Inside Pitchfork', points: 3, hint: 'Inside (modified Schiff) pitchfork' },
    ],
  },
  {
    id: 'shapes',
    label: 'Geometric Shapes',
    tools: [
      { id: 'brush', label: 'Brush', points: 'free', legacy: true, hint: 'Freehand sketch' },
      { id: 'highlighter', label: 'Highlighter', points: 'free', hint: 'Thick translucent marker' },
      { id: 'arrow', label: 'Arrow', points: 2, hint: 'Arrow with a solid marker head' },
      { id: 'rectangle', label: 'Rectangle', points: 2, legacy: true, hint: 'Zone / supply-demand box' },
      { id: 'rotated_rectangle', label: 'Rotated Rectangle', points: 3, hint: 'Box rotated along the trend' },
      { id: 'ellipse', label: 'Ellipse', points: 2, hint: 'Oval zone' },
      { id: 'circle', label: 'Circle', points: 2, hint: 'Circle from centre to radius' },
      { id: 'triangle', label: 'Triangle', points: 2, hint: 'Triangle zone' },
      { id: 'polyline', label: 'Polyline', points: 'free', hint: 'Multi-segment line, double-click to finish' },
      { id: 'parallel_channel', label: 'Parallel Channel', points: 2, legacy: true, hint: 'Trend corridor' },
      { id: 'flat_top_bottom', label: 'Flat Top/Bottom', points: 2, hint: 'Channel with one horizontal rail' },
      { id: 'disjoint_channel', label: 'Disjoint Channel', points: 4, hint: 'Two independent channel rails' },
    ],
  },
  {
    id: 'annotations',
    label: 'Annotation Tools',
    tools: [
      { id: 'text', label: 'Text', points: 1, legacy: true, hint: 'Click on the chart to type' },
      { id: 'callout', label: 'Callout', points: 2, hint: 'Text bubble with a leader line' },
      { id: 'note', label: 'Note', points: 1, hint: 'Sticky note pinned to a price' },
      { id: 'price_label', label: 'Price Label', points: 1, hint: 'Price tag showing the exact level' },
      { id: 'price_note', label: 'Price Note', points: 2, hint: 'Price readout between two levels' },
      { id: 'flag', label: 'Flag', points: 1, hint: 'Event flag marker' },
      { id: 'pin', label: 'Pin', points: 1, hint: 'Pin marker for a bar' },
    ],
  },
  {
    id: 'patterns',
    label: 'Patterns',
    tools: [
      { id: 'xabcd', label: 'XABCD Pattern', points: 5, hint: 'Five-point harmonic pattern with leg ratios' },
      { id: 'cypher', label: 'Cypher Pattern', points: 5, hint: 'Cypher harmonic pattern' },
      { id: 'head_shoulders', label: 'Head and Shoulders', points: 5, hint: 'Reversal pattern with neckline' },
      { id: 'abcd', label: 'ABCD Pattern', points: 4, hint: 'Four-point AB=CD pattern' },
      { id: 'triangle_pattern', label: 'Triangle Pattern', points: 3, hint: 'Three-touch triangle with labels' },
      { id: 'three_drives', label: 'Three Drives', points: 5, hint: 'Three-drive reversal pattern' },
      { id: 'elliott_impulse', label: 'Elliott Impulse Wave', points: 6, hint: 'Waves 0-1-2-3-4-5' },
      { id: 'elliott_correction', label: 'Elliott Correction Wave', points: 4, hint: 'Waves 0-A-B-C' },
    ],
  },
  {
    id: 'prediction',
    label: 'Prediction and Measurement',
    tools: [
      { id: 'long_position', label: 'Long Position', points: 2, legacy: true, hint: 'Entry, stop and target for a long' },
      { id: 'short_position', label: 'Short Position', points: 2, legacy: true, hint: 'Entry, stop and target for a short' },
      { id: 'forecast', label: 'Forecast', points: 3, hint: 'Projects the AB move from C' },
      { id: 'projection', label: 'Projection', points: 3, hint: 'Projects two future levels' },
      { id: 'bars_pattern', label: 'Bars Pattern', points: 2, hint: 'Copies the bars between two anchors' },
      { id: 'date_range', label: 'Date Range', points: 2, hint: 'Measures bars and elapsed time' },
      { id: 'price_range', label: 'Price Range', points: 2, hint: 'Measures price change and percentage' },
      { id: 'date_price_range', label: 'Date and Price Range', points: 2, hint: 'Measures both time and price' },
      { id: 'ruler', label: 'Measure', points: 2, legacy: true, hint: 'Ruler: price, %, bars and duration' },
    ],
  },
  {
    id: 'icons',
    label: 'Icons & Stickers',
    tools: [
      { id: 'smile', label: 'Stickers & Emoji', points: 1, legacy: true, hint: 'Place an emoji marker' },
    ],
  },
];

export const ALL_DRAWING_TOOLS = DRAWING_TOOL_GROUPS.flatMap((group) =>
  group.tools.map((tool) => ({ ...tool, group: group.id, groupLabel: group.label })),
);

const TOOL_INDEX = new Map(ALL_DRAWING_TOOLS.map((tool) => [tool.id, tool]));

export function getToolSpec(toolId) {
  return TOOL_INDEX.get(toolId) || null;
}

export function getToolLabel(toolId) {
  return TOOL_INDEX.get(toolId)?.label || toolId;
}

/** Tool groups keyed by id — handy for the toolbar flyout state. */
export const TOOL_GROUPS_BY_ID = DRAWING_TOOL_GROUPS.reduce((acc, group) => {
  acc[group.id] = group;
  return acc;
}, {});

/** Cursor-only modes never create drawings. */
export const CURSOR_TOOLS = ALL_DRAWING_TOOLS.filter((tool) => tool.kind === 'cursor').map((tool) => tool.id);

/** Types already rendered by the existing renderer inside DrawingTools.jsx. */
export const LEGACY_TOOL_IDS = ALL_DRAWING_TOOLS.filter((tool) => tool.legacy).map((tool) => tool.id);

/**
 * Types rendered by the registry-driven `DrawingShape` component. Keeping the
 * legacy set separate means the long-standing tools keep their exact rendering.
 */
export const EXTENDED_TOOL_IDS = ALL_DRAWING_TOOLS.filter(
  (tool) => !tool.legacy && tool.kind !== 'cursor',
).map((tool) => tool.id);

const EXTENDED_ID_SET = new Set(EXTENDED_TOOL_IDS);

export function isExtendedTool(toolId) {
  return EXTENDED_ID_SET.has(toolId);
}

/** Every drawing type the app can render (legacy + extended). */
export const RENDERABLE_TOOL_IDS = [...LEGACY_TOOL_IDS, ...EXTENDED_TOOL_IDS];

export const DEFAULT_TOOL = 'crosshair';

/** Magnet modes match TradingView: off → weak → strong. */
export const MAGNET_MODES = ['off', 'weak', 'strong'];

export const MAGNET_LABELS = {
  off: 'Magnet OFF',
  weak: 'Magnet WEAK — snaps when close to OHLC',
  strong: 'Magnet STRONG — always snaps to OHLC',
};

/** Snap radius in px for weak magnet mode (strong mode ignores the radius). */
export const MAGNET_WEAK_RADIUS = 14;
export const MAGNET_SNAP_RADIUS = 35;

export function nextMagnetMode(mode) {
  const index = MAGNET_MODES.indexOf(mode);
  return MAGNET_MODES[(index + 1) % MAGNET_MODES.length];
}