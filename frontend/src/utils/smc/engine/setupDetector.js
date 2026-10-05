export function detectSetup(context = {}, settings = {}) {
  const bias = context.bias === 'bullish' || context.bias === 'bearish' ? context.bias : 'neutral';
  const scoreValue = Number(context.score);
  const score = Math.max(0, Math.min(100, Number.isFinite(scoreValue) ? scoreValue : 0));
  const reasons = [];

  if (context.structure && context.structure !== 'neutral') reasons.push(`${context.structure} structure`);
  if (context.liquidity && context.liquidity.length) reasons.push('liquidity sweep');
  if (context.fvg?.length) reasons.push('fvg confirmation');
  if (context.orderBlocks?.length) reasons.push('order block');
  const minimumConfluence = Math.max(1, Number(settings.minimumConfluence) || 2);
  const direction = bias !== 'neutral' && reasons.length >= minimumConfluence ? bias : 'neutral';

  const findZone = () => {
    if (direction === 'bullish') return 'discount';
    if (direction === 'bearish') return 'premium';
    return 'equilibrium';
  };

  return {
    direction,
    score,
    confidence: direction === 'neutral' ? 0 : score,
    bias: direction,
    zone: findZone(),
    entry: direction === 'neutral' ? null : context.entry ?? null,
    stopLoss: direction === 'neutral' ? null : context.stopLoss ?? null,
    takeProfit: direction === 'neutral' ? null : context.takeProfit ?? null,
    reasons,
  };
}
