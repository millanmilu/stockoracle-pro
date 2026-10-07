export function determinePremiumDiscount(candles, settings = {}) {
  const empty = { swingHigh: null, swingLow: null, equilibrium: null, premium: null, discount: null, zone: 'unknown' };
  if (!Array.isArray(candles) || candles.length === 0) {
    return empty;
  }

  const requested = Number(settings.lookback);
  const lookback = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 120;
  const recent = candles.slice(-lookback);
  const highs = recent.map((c) => Number(c.high)).filter((n) => Number.isFinite(n) && n > 0);
  const lows = recent.map((c) => Number(c.low)).filter((n) => Number.isFinite(n) && n > 0);
  if (!highs.length || !lows.length) return empty;
  const swingHigh = Math.max(...highs);
  const swingLow = Math.min(...lows);
  const equilibrium = (swingHigh + swingLow) / 2;
  const close = Number(candles.at(-1)?.close);

  return {
    swingHigh,
    swingLow,
    equilibrium,
    premium: { top: swingHigh, bottom: equilibrium },
    discount: { top: equilibrium, bottom: swingLow },
    zone: !Number.isFinite(close) || close <= 0 ? 'unknown' : close > equilibrium
      ? 'premium'
      : close < equilibrium ? 'discount' : 'equilibrium',
  };
}
