import { detectOrderBlocks } from '../../marketStructure.js';

function averageTrueRange(candles, endIndex, period = 14) {
  const start = Math.max(1, endIndex - period + 1);
  let total = 0;
  let count = 0;
  for (let i = start; i <= endIndex; i += 1) {
    const high = Number(candles[i]?.high);
    const low = Number(candles[i]?.low);
    const previousClose = Number(candles[i - 1]?.close);
    if (![high, low, previousClose].every(Number.isFinite)) continue;
    total += Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
    count += 1;
  }
  return count ? total / count : NaN;
}

export function detectSMCOrderBlocks(candles, settings = {}) {
  if (!Array.isArray(candles) || candles.length < 5) {
    return { blocks: [], active: [], state: 'idle' };
  }
  const maxActive = Number.isFinite(Number(settings.maxActiveOBs))
    ? Math.max(0, Math.floor(Number(settings.maxActiveOBs)))
    : 8;
  const minDisplacement = Number(settings.minDisplacement);
  const candidates = detectOrderBlocks(candles, settings.lookback || 100, Math.max(8, maxActive))
    .filter((item) => (
      (settings.bullish !== false || item.type !== 'bullish_ob')
      && (settings.bearish !== false || item.type !== 'bearish_ob')
    ))
    .filter((item) => {
      if (!Number.isFinite(minDisplacement) || minDisplacement <= 0) return true;
      const originIndex = candles.findIndex((candle) => candle.time === item.time);
      const departure = candles[originIndex + 1];
      const atr = averageTrueRange(candles, originIndex);
      if (!departure || !Number.isFinite(atr) || atr <= 0) return false;
      const body = Math.abs(Number(departure.close) - Number(departure.open));
      return Number.isFinite(body) && body / atr >= minDisplacement;
    });
  const blocks = candidates.map((item, idx) => ({
    ...item,
    confirmedTime: candles[candles.findIndex((candle) => candle.time === item.time) + 2]?.time,
    state: 'active',
    mitigation: 0,
    id: `ob-${idx}-${item.time ?? idx}`,
  }));

  return {
    blocks,
    active: maxActive === 0 ? [] : blocks.slice(-maxActive),
    state: blocks.length > 0 ? 'active' : 'idle',
  };
}
