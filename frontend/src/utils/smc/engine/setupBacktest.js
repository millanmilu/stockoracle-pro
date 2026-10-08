/**
 * StockOracle Pro — SMC baseline backtest (pure, tested).
 *
 * Replays a simple structure-anchored template over the loaded candles and
 * reports how the setup logic has performed historically:
 *   - direction from the same 4×-aggregate efficiency trend the engine uses
 *   - entry at the bar close, stop beyond the nearest confirmed swing with an
 *     ATR buffer (mirrors deriveSetupLevels' structural stop), TP1 at 1.5R
 *   - first-touch resolution within a bounded horizon (SL before TP = loss)
 *
 * This is a baseline template, not the exact live confluence setup — the
 * panel labels it as such. O(n·window): safe on a 1k–2k candle snapshot.
 */

function num(v, fallback = NaN) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < 2) return NaN;
  const rows = candles.slice(-(period + 1));
  let sum = 0;
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const h = num(rows[i]?.high);
    const l = num(rows[i]?.low);
    const pc = num(rows[i - 1]?.close);
    if (![h, l, pc].every(Number.isFinite)) continue;
    sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    n += 1;
  }
  return n > 0 ? sum / n : NaN;
}

/** Confirmed swing extremes strictly below/above a reference price. */
function nearestSwing(candles, endIndex, bullish, refPrice, window = 3, lookback = 60) {
  const from = Math.max(0, endIndex - lookback);
  let best = null;
  for (let i = from; i <= endIndex - window; i++) {
    const pivot = candles[i];
    const price = num(pivot?.high);
    const low = num(pivot?.low);
    if (!Number.isFinite(price) || !Number.isFinite(low)) continue;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= window; k++) {
      if (num(candles[i - k]?.high) > price || num(candles[i + k]?.high) > price) isHigh = false;
      if (num(candles[i - k]?.low) < low || num(candles[i + k]?.low) < low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isLow && bullish && low < refPrice) {
      best = best == null ? low : Math.max(best, low);
    }
    if (isHigh && !bullish && price > refPrice) {
      best = best == null ? price : Math.min(best, price);
    }
  }
  return best;
}

function trendDirection(candles, endIndex, factor = 4) {
  const slice = candles.slice(Math.max(0, endIndex - 96), endIndex + 1);
  if (slice.length < 16) return 'neutral';
  const agg = [];
  for (let i = 0; i + factor <= slice.length; i += factor) {
    const group = slice.slice(i, i + factor);
    agg.push({
      open: num(group[0]?.open),
      close: num(group[group.length - 1]?.close),
      high: Math.max(...group.map((c) => num(c.high, -Infinity))),
      low: Math.min(...group.map((c) => num(c.low, Infinity))),
    });
  }
  if (agg.length < 6) return 'neutral';
  const net = num(agg.at(-1)?.close) - num(agg[0]?.close);
  let range = 0;
  for (let i = 1; i < agg.length; i++) {
    range += Math.max(
      num(agg[i].high, 0) - num(agg[i].low, 0),
      Math.abs(num(agg[i].high, 0) - num(agg[i - 1].close, 0)),
      Math.abs(num(agg[i].low, 0) - num(agg[i - 1].close, 0)),
    );
  }
  if (!Number.isFinite(net) || range <= 0) return 'neutral';
  const efficiency = Math.abs(net) / range;
  if (efficiency < 0.15) return 'neutral';
  return net > 0 ? 'bullish' : 'bearish';
}

/**
 * Backtest the baseline structure template.
 * @param {Array} candles chart candles ({time, open, high, low, close})
 * @param {Object} opts { horizon (default 120), maxTrades (default 200), rr (default 1.5), atrBuffer (default 0.2) }
 * @returns {Object|null} { trades, wins, losses, open, winRate, avgR, expectancyR, maxWinStreak, maxLossStreak, rr, horizon }
 */
export function backtestSetup(candles, opts = {}) {
  if (!Array.isArray(candles) || candles.length < 80) return null;
  const horizon = Math.max(10, Number(opts.horizon) || 120);
  const maxTrades = Math.max(20, Number(opts.maxTrades) || 200);
  const rr = Math.max(0.5, Number(opts.rr) || 1.5);
  const atrBuffer = Math.max(0.05, Number(opts.atrBuffer) || 0.2);

  const start = Math.max(40, candles.length - 1 - maxTrades * 2);
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let openTrades = 0;
  let rSum = 0;
  let streak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  for (let i = start; i < candles.length - 1 && trades < maxTrades; i++) {
    const direction = trendDirection(candles, i);
    if (direction === 'neutral') continue;
    const bullish = direction === 'bullish';
    const entry = num(candles[i]?.close);
    if (!Number.isFinite(entry) || entry <= 0) continue;
    const atrNow = atr(candles.slice(Math.max(0, i - 15), i + 1));
    const buffer = Number.isFinite(atrNow) && atrNow > 0 ? atrNow * atrBuffer : entry * 0.0005;
    const swing = nearestSwing(candles, i, bullish, entry);
    if (swing == null) continue;
    const stopLoss = bullish ? swing - buffer : swing + buffer;
    const risk = Math.abs(entry - stopLoss);
    if (!(risk > 0) || risk < entry * 0.0002) continue;
    const target = bullish ? entry + risk * rr : entry - risk * rr;

    // Resolve forward: first touch wins/loses. Same-bar ambiguity (both
    // touched) resolves as a loss — conservative.
    let outcome = null;
    for (let j = i + 1; j < candles.length && j <= i + horizon; j++) {
      const high = num(candles[j]?.high);
      const low = num(candles[j]?.low);
      if (!Number.isFinite(high) || !Number.isFinite(low)) continue;
      const hitStop = bullish ? low <= stopLoss : high >= stopLoss;
      const hitTarget = bullish ? high >= target : low <= target;
      if (hitStop) { outcome = 'loss'; break; }
      if (hitTarget) { outcome = 'win'; break; }
    }

    trades += 1;
    if (outcome === 'win') {
      wins += 1;
      rSum += rr;
      streak = streak >= 0 ? streak + 1 : 1;
      maxWinStreak = Math.max(maxWinStreak, streak);
    } else if (outcome === 'loss') {
      losses += 1;
      rSum -= 1;
      streak = streak <= 0 ? streak - 1 : -1;
      maxLossStreak = Math.max(maxLossStreak, -streak);
    } else {
      openTrades += 1;
    }
  }

  if (!trades) return null;
  const closed = wins + losses;
  return {
    trades,
    wins,
    losses,
    open: openTrades,
    winRate: closed ? wins / closed : 0,
    avgR: closed ? rSum / closed : 0,
    expectancyR: closed ? rSum / closed : 0,
    maxWinStreak,
    maxLossStreak,
    rr,
    horizon,
    closed,
  };
}

export default { backtestSetup };
