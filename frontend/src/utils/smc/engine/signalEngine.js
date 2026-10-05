export function buildSignal(context = {}) {
  const direction = context.setup?.direction || context.bias || 'neutral';
  const setupScore = Number(context.setup?.score || 0);
  const score = Math.max(0, Math.min(100, setupScore));

  return {
    direction,
    score,
    confidence: score,
    reason: context.setup?.reasons?.join(', ') || 'SMC confluence',
    entry: context.setup?.entry ?? null,
    stopLoss: context.setup?.stopLoss ?? null,
    takeProfit: context.setup?.takeProfit ?? null,
  };
}
