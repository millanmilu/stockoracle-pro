import { detectOrderBlocks } from '../../marketStructure.js';

export function detectSMCOrderBlocks(candles, settings = {}) {
  const blocks = detectOrderBlocks(candles, settings.lookback || 100).map((item, idx) => ({
    ...item,
    confirmedTime: candles[candles.findIndex((candle) => candle.time === item.time) + 2]?.time,
    state: 'active',
    mitigation: 0,
    id: `ob-${idx}-${item.time ?? idx}`,
  }));

  return {
    blocks,
    active: blocks.slice(-settings.maxActiveOBs || 8),
    state: blocks.length > 0 ? 'active' : 'idle',
  };
}
