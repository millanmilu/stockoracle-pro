export function classifyDisplacement(candles, settings = {}) {
  if (!Array.isArray(candles) || candles.length < 2) return { level: 'weak', events: [] };

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const movement = Math.abs(Number(last.close) - Number(prev.close));
  const atr = Math.max(Math.abs(Number(last.high) - Number(last.low)), 0.0001);
  const ratio = movement / atr;

  let level = 'weak';
  if (ratio >= (settings.extremeThreshold || 3.5)) level = 'extreme';
  else if (ratio >= (settings.strongThreshold || 2.5)) level = 'strong';
  else if (ratio >= (settings.moderateThreshold || 1.5)) level = 'moderate';

  return {
    level,
    ratio,
    events: [{
      time: last.time,
      type: Number(last.close) >= Number(last.open) ? 'bullish_displacement' : 'bearish_displacement',
      strength: level,
      value: ratio,
    }],
  };
}
