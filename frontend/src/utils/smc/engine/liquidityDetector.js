import { detectLiquidity, detectSR } from '../../marketStructure.js';

export function detectLiquidityZones(candles, settings = {}) {
  const levels = detectLiquidity(candles, settings.bins || 8);
  const sr = detectSR(candles, settings.lookback || 150);

  const liquidityLevels = [...levels, ...sr].map((item, idx) => ({
    ...item,
    state: item.state || 'untouched',
    id: `${item.type || 'liquidity'}-${idx}-${item.time ?? idx}`,
  }));

  return {
    levels: liquidityLevels,
    sweeps: liquidityLevels.filter((item) => /sweep|liquidity/i.test(item.label || '')),
    state: liquidityLevels.length > 0 ? 'active' : 'idle',
  };
}
