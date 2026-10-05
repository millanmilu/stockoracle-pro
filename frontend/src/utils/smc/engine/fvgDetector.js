import { detectFVGs } from '../../marketStructure.js';

export function detectSMCFVGs(candles, settings = {}) {
  const fvgs = detectFVGs(candles, settings.maxGaps || 8).map((item, idx) => ({
    ...item,
    mid: item.mid ?? ((item.top + item.bottom) / 2),
    fill: 0,
    state: 'active',
    id: `fvg-${idx}-${item.time ?? idx}`,
  }));

  return {
    gaps: fvgs,
    active: fvgs.slice(-settings.maxGaps || 8),
    state: fvgs.length > 0 ? 'active' : 'idle',
  };
}
