import { detectSwingPoints, detectStructureSequence, detectBosChoch } from '../../marketStructure.js';

export function detectSwingStructure(candles, settings = {}) {
  const windowSize = settings.windowSize || 5;
  const swings = detectSwingPoints(candles, windowSize);
  const structure = detectStructureSequence(swings);
  const bos = detectBosChoch(candles, windowSize);

  return {
    swings,
    structure,
    bos,
    snapshot: {
      highs: swings.highs.slice(-8),
      lows: swings.lows.slice(-8),
      structure: structure.slice(-8),
      bos: bos.slice(-8),
    },
  };
}
