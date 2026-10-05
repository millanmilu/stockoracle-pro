function aggregateCandles(candles, factor) {
  const aggregated = [];
  for (let i = 0; i + factor <= candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    const open = Number(group[0]?.open);
    const close = Number(group[group.length - 1]?.close);
    const highs = group.map((candle) => Number(candle.high));
    const lows = group.map((candle) => Number(candle.low));
    if (!Number.isFinite(open) || !Number.isFinite(close)
      || highs.some((value) => !Number.isFinite(value))
      || lows.some((value) => !Number.isFinite(value))) continue;
    aggregated.push({
      time: group[group.length - 1]?.time,
      open,
      close,
      high: Math.max(...highs),
      low: Math.min(...lows),
    });
  }
  return aggregated;
}

function measureTrend(candles) {
  if (candles.length < 8) return { bias: 'neutral', confidence: 0 };
  const end = candles.length - 1;
  const start = Math.max(0, end - 8);
  const netMove = Number(candles[end]?.close) - Number(candles[start]?.close);
  let totalRange = 0;
  for (let i = start + 1; i <= end; i++) {
    const candle = candles[i];
    const previousClose = Number(candles[i - 1]?.close);
    const high = Number(candle?.high);
    const low = Number(candle?.low);
    totalRange += Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  }
  if (!Number.isFinite(netMove) || !Number.isFinite(totalRange) || totalRange <= 0) {
    return { bias: 'neutral', confidence: 0 };
  }

  const efficiency = Math.abs(netMove) / totalRange;
  if (efficiency < 0.15) return { bias: 'neutral', confidence: Math.round(efficiency * 100) };
  return {
    bias: netMove > 0 ? 'bullish' : 'bearish',
    confidence: Math.min(100, Math.round(efficiency * 100)),
  };
}

export function analyzeMultiTimeframe(candles) {
  if (!Array.isArray(candles) || candles.length < 8) {
    return {
      bias: 'neutral', alignment: 'neutral', structure: 'neutral',
      confidence: 0, source: 'aggregated-candles', timeframes: [],
    };
  }

  const timeframes = [1, 4, 16].map((factor) => ({
    factor,
    ...measureTrend(factor === 1 ? candles : aggregateCandles(candles, factor)),
  }));
  const structure = timeframes.find((frame) => frame.factor === 4)?.bias || 'neutral';
  const medium = timeframes.find((frame) => frame.factor === 4);
  const higher = timeframes.find((frame) => frame.factor === 16);
  const aligned = medium?.bias !== 'neutral' && medium?.bias === higher?.bias;
  const bias = aligned ? medium.bias : 'neutral';

  return {
    bias,
    alignment: aligned ? bias : medium?.bias !== 'neutral' && higher?.bias !== 'neutral' ? 'mixed' : 'neutral',
    structure,
    confidence: aligned ? Math.round((medium.confidence + higher.confidence) / 2) : 0,
    source: 'aggregated-candles',
    timeframes,
  };
}
