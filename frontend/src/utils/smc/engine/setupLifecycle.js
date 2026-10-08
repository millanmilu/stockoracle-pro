/**
 * SMC setup lifecycle helpers.
 *
 * A setup is an open trade idea once it is surfaced to the chart. Its levels
 * must remain frozen until the first target or the stop is touched. The
 * baseline candle is used so a setup created mid-bar is not immediately
 * closed by a wick that happened before the setup appeared.
 */

function finite(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function cloneSetup(setup) {
  if (!setup || typeof setup !== 'object') return null;
  return {
    ...setup,
    takeProfits: Array.isArray(setup.takeProfits) ? [...setup.takeProfits] : [],
    riskReward: Array.isArray(setup.riskReward) ? [...setup.riskReward] : setup.riskReward,
    targetSources: Array.isArray(setup.targetSources) ? [...setup.targetSources] : setup.targetSources,
  };
}

/**
 * Return the first exit event for the latest candle, or null while open.
 * Stop is deliberately checked before TP when both are touched in one bar.
 */
export function getSetupExit(setup, candle, baseline = null) {
  if (!setup || !candle) return null;
  const direction = setup.direction === 'bearish' ? 'bearish' : setup.direction === 'bullish' ? 'bullish' : null;
  const stop = finite(setup.stopLoss);
  const target = finite(setup.takeProfits?.[0]);
  const high = finite(candle.high);
  const low = finite(candle.low);
  if (!direction || stop == null || target == null || high == null || low == null) return null;

  const sameBaselineBar = baseline?.time != null && baseline.time === candle.time;
  const newHigh = !sameBaselineBar || finite(baseline.high) == null || high > Number(baseline.high);
  const newLow = !sameBaselineBar || finite(baseline.low) == null || low < Number(baseline.low);
  const close = finite(candle.close);
  const stopHit = direction === 'bullish'
    ? (newLow && low <= stop) || (close != null && close <= stop)
    : (newHigh && high >= stop) || (close != null && close >= stop);
  if (stopHit) return { kind: 'stop', price: stop };

  const targetHit = direction === 'bullish'
    ? (newHigh && high >= target) || (close != null && close >= target)
    : (newLow && low <= target) || (close != null && close <= target);
  return targetHit ? { kind: 'target', price: target } : null;
}

export function advanceSetup(lock, candles, candidate) {
  for (const candle of candles) {
    if (candle.time < lock.baseline.time) continue;
    const exit = getSetupExit(lock.setup, candle, lock.baseline);
    if (exit) return { exit, setup: lock.setup };
  }
  const setup = !lock.setup.confirmed && candidate?.confirmed
    && candidate.direction === lock.setup.direction
    ? { ...lock.setup, confirmed: true } : lock.setup;
  return { exit: null, setup };
}

export default { cloneSetup, getSetupExit };
