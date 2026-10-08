import { detectFVGs } from '../../marketStructure.js';

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

export function detectSMCFVGs(candles, settings = {}) {
  if (!Array.isArray(candles) || candles.length < 3 || settings.fvg === false) {
    return { gaps: [], active: [], state: 'idle' };
  }
  const requestedMax = Number(settings.maxGaps);
  const maxGaps = Number.isFinite(requestedMax) ? Math.max(0, Math.floor(requestedMax)) : 8;
  const requestedThreshold = Number(settings.minGapAtr);
  const minGapAtr = Number.isFinite(requestedThreshold) ? Math.max(0, requestedThreshold) : 0;
  const candidates = maxGaps === 0 ? [] : detectFVGs(candles, Math.max(100, candles.length))
    .filter((item) => {
      const originIndex = candles.findIndex((candle) => candle.time === item.time);
      const confirmationIndex = originIndex + 1;
      const atr = averageTrueRange(candles, confirmationIndex);
      if (!Number.isFinite(atr) || atr <= 0) return minGapAtr === 0;
      const gapSize = Math.abs(Number(item.top) - Number(item.bottom));
      return Number.isFinite(gapSize) && gapSize / atr >= minGapAtr;
    })
    .slice(-maxGaps);
  const fvgs = candidates.map((item, idx) => ({
    ...item,
    confirmedTime: candles[candles.findIndex((candle) => candle.time === item.time) + 1]?.time,
    mid: item.mid ?? ((item.top + item.bottom) / 2),
    fill: 0,
    state: 'active',
    id: `fvg-${idx}-${item.time ?? idx}`,
  }));

  const active = fvgs.slice(-maxGaps);
  return {
    gaps: fvgs,
    active,
    state: fvgs.length > 0 ? 'active' : 'idle',
  };
}
