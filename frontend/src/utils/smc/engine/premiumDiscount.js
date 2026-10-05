export function determinePremiumDiscount(candles, settings = {}) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { swingHigh: null, swingLow: null, equilibrium: null, premium: null, discount: null };
  }

  const recent = candles.slice(-settings.lookback || 120);
  const highs = recent.map((c) => Number(c.high)).filter((n) => Number.isFinite(n));
  const lows = recent.map((c) => Number(c.low)).filter((n) => Number.isFinite(n));
  const swingHigh = Math.max(...highs);
  const swingLow = Math.min(...lows);
  const equilibrium = (swingHigh + swingLow) / 2;

  return {
    swingHigh,
    swingLow,
    equilibrium,
    premium: { top: swingHigh, bottom: equilibrium },
    discount: { top: equilibrium, bottom: swingLow },
    zone: Number(candles[candles.length - 1]?.close) > equilibrium
      ? 'premium'
      : Number(candles[candles.length - 1]?.close) < equilibrium ? 'discount' : 'equilibrium',
  };
}
