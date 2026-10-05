export function detectImbalance(candles, settings = {}) {
  if (!Array.isArray(candles) || candles.length < 2) {
    return { priceImbalance: [], candleImbalance: [], volumeImbalance: [] };
  }

  const priceImbalance = [];
  const candleImbalance = [];
  const volumeImbalance = [];

  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const current = candles[i];
    const body = Math.abs(Number(current.close) - Number(current.open));
    const range = Math.max(Number(current.high) - Number(current.low), 0.0001);
    const imbalanceScore = body / range;
    if (imbalanceScore > (settings.threshold || 0.55)) {
      priceImbalance.push({
        time: current.time,
        score: imbalanceScore,
        direction: Number(current.close) >= Number(current.open) ? 'bullish' : 'bearish',
      });
    }
    const vol = Number(current.volume) || 0;
    if (vol > 0 && Number(prev.volume) > 0) {
      const relativeVolume = vol / Number(prev.volume);
      if (relativeVolume > (settings.volumeThreshold || 1.25)) {
        volumeImbalance.push({ time: current.time, ratio: relativeVolume });
      }
    }
    candleImbalance.push({ time: current.time, score: imbalanceScore });
  }

  return { priceImbalance, candleImbalance, volumeImbalance };
}
