/**
 * Renderer registry for the TradingView-style extended tool set — re-export
 * barrel. The registry itself lives in `shapeRendererRegistry`; individual
 * renderer groups are split into cohesive modules next to it.
 */
export { SHAPE_RENDERERS } from './shapeRendererRegistry';
export { makePatternRenderer } from './patternRenderers';
export { makePitchforkRenderer } from './fibGannRenderers';
