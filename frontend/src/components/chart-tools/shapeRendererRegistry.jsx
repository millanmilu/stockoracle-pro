import * as G from '../../utils/drawingGeometry';
import {
  renderExtendedLine,
  renderInfoLine,
  renderTrendAngle,
  renderVerticalLine,
  renderCrossLine,
  renderArrow,
} from './trendLineRenderers';
import {
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
} from './fibGannRenderers';
import {
  renderFreehand,
  renderRotatedRectangle,
  renderEllipse,
  renderTriangle,
  renderFlatTopBottom,
  renderDisjointChannel,
} from './geometricShapeRenderers';
import {
  renderCallout,
  renderNote,
  renderPriceLabel,
  renderPriceNote,
  renderFlag,
  renderPin,
} from './annotationRenderers';
import {
  renderHeadShoulders,
  renderTrianglePattern,
  makePatternRenderer,
} from './patternRenderers';
import {
  renderForecast,
  renderProjection,
  renderBarsPattern,
} from './predictionRenderers';
import {
  renderDateRange,
  renderPriceRange,
  renderDatePriceRange,
} from './rangeRenderers';
import { renderFixedRangeVolumeProfile } from './volumeProfileRenderers';

/**
 * Renderer registry for the TradingView-style extended tool set.
 *
 * Coordinate contract: `points` arrive already resolved to chart pixels, each
 * carrying `{ x, y, logical, price }`. `toX` / `toY` convert data-space values
 * back to pixels (used by the Fib time-zone tool). Legacy tools keep their own
 * JSX in DrawingTools.jsx — only `EXTENDED_TOOL_IDS` types land here.
 */
/**
 * Every extended-tool renderer, keyed by drawing type. DrawingShape dispatches
 * through this map so adding a tool = adding one entry (plus a catalog row).
 */
const SHAPE_RENDERERS = {
  // Trend lines
  extended_line: renderExtendedLine,
  info_line: renderInfoLine,
  trend_angle: renderTrendAngle,
  vertical_line: renderVerticalLine,
  cross_line: renderCrossLine,
  arrow: renderArrow,
  // Fibonacci & Gann
  fib_extension: renderFibExtension,
  fib_channel: renderFibChannel,
  regression_trend: renderRegressionTrend,
  fib_fan: renderFibFan,
  fib_circle: renderFibCircle,
  fib_timezone: renderFibTimezone,
  gann_fan: renderGannFan,
  gann_box: renderGannBox,
  pitchfork: makePitchforkRenderer('pitchfork'),
  schiff_pitchfork: makePitchforkRenderer('schiff'),
  inside_pitchfork: makePitchforkRenderer('inside'),
  // Shapes
  highlighter: (props) => renderFreehand({ ...props, variant: 'highlighter' }),
  polyline: (props) => renderFreehand({ ...props, variant: 'polyline' }),
  rotated_rectangle: renderRotatedRectangle,
  ellipse: renderEllipse,
  circle: (props) => renderEllipse({ ...props, forceCircle: true }),
  triangle: renderTriangle,
  arc: renderArc,
  flat_top_bottom: renderFlatTopBottom,
  disjoint_channel: renderDisjointChannel,
  // Annotations
  callout: renderCallout,
  note: renderNote,
  price_label: renderPriceLabel,
  price_note: renderPriceNote,
  flag: renderFlag,
  pin: renderPin,
  // Patterns
  xabcd: makePatternRenderer(['X', 'A', 'B', 'C', 'D']),
  cypher: makePatternRenderer(['X', 'A', 'B', 'C', 'D']),
  abcd: makePatternRenderer(['A', 'B', 'C', 'D']),
  three_drives: makePatternRenderer(['1', '2', '3', '4', '5']),
  head_shoulders: renderHeadShoulders,
  triangle_pattern: renderTrianglePattern,
  elliott_impulse: makePatternRenderer(G.elliottWaveLabels(6, 'impulse')),
  elliott_correction: makePatternRenderer(G.elliottWaveLabels(4, 'correction')),
  // Prediction & measurement
  forecast: renderForecast,
  projection: renderProjection,
  bars_pattern: renderBarsPattern,
  date_range: renderDateRange,
  price_range: renderPriceRange,
  date_price_range: renderDatePriceRange,
  fixed_range_volume_profile: renderFixedRangeVolumeProfile,
};

export { SHAPE_RENDERERS };
