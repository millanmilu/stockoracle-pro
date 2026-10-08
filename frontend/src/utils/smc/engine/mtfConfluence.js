/**
 * StockOracle Pro — SMC Pro MTF confluence engine (pure, tested).
 *
 * Builds higher-timeframe (4×, 16×) aggregates from the loaded LTF candles
 * and derives institutional-style confluence evidence:
 *   - HTF structure: close-confirmed breaks of HTF swings (BOS/CHoCH)
 *   - HTF zones: order-block + FVG bands on the 16× aggregate
 *   - HTF premium/discount: where LTF price sits inside the HTF range
 *   - alignmentScore 0..100 with a per-component breakdown
 *
 * Aggregation-only (no network): deterministic and testable. Bias contract
 * matches mtfAnalyzer.js (`bullish` | `bearish` | `neutral`) so existing
 * consumers keep working.
 */

function num(v, fallback = NaN) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function aggregateCandles(candles, factor) {
  if (!Array.isArray(candles) || !(factor >= 1)) return [];
  const out = [];
  for (let i = 0; i + factor <= candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    const open = num(group[0]?.open);
    const close = num(group[group.length - 1]?.close);
    let high = -Infinity;
    let low = Infinity;
    let ok = Number.isFinite(open) && Number.isFinite(close);
    for (const candle of group) {
      const h = num(candle?.high);
      const l = num(candle?.low);
      if (!Number.isFinite(h) || !Number.isFinite(l)) { ok = false; break; }
      high = Math.max(high, h);
      low = Math.min(low, l);
    }
    if (!ok) continue;
    out.push({ time: group[group.length - 1]?.time, open, close, high, low });
  }
  return out;
}

/** Confirmed fractal swings (window w each side) with confirmation index. */
function findHtfSwings(candles, w = 2, cap = 60) {
  const swings = [];
  if (!Array.isArray(candles) || candles.length < w * 2 + 1) return swings;
  for (let i = w; i < candles.length - w; i++) {
    const h = num(candles[i]?.high);
    const l = num(candles[i]?.low);
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= w; k++) {
      if (num(candles[i - k]?.high) > h || num(candles[i + k]?.high) > h) isHigh = false;
      if (num(candles[i - k]?.low) < l || num(candles[i + k]?.low) < l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swings.push({ kind: 'high', price: h, time: candles[i].time, index: i, confirmedIndex: i + w });
    if (isLow) swings.push({ kind: 'low', price: l, time: candles[i].time, index: i, confirmedIndex: i + w });
  }
  return swings.slice(-cap * 2);
}

/** Close-confirmed breaks of the most recent opposing swing (BOS / CHoCH). */
function detectHtfBreaks(candles, swings) {
  const breaks = [];
  let lastHigh = null;
  let lastLow = null;
  let swingCursor = 0;
  for (let i = 0; i < candles.length; i++) {
    while (swingCursor < swings.length && swings[swingCursor].confirmedIndex <= i) {
      const s = swings[swingCursor];
      if (s.kind === 'high') lastHigh = s;
      else lastLow = s;
      swingCursor += 1;
    }
    const close = num(candles[i]?.close);
    if (!Number.isFinite(close)) continue;
    if (lastHigh && close > lastHigh.price) {
      breaks.push({
        type: breaks.some((b) => b.direction === 'bearish') ? 'CHoCH' : 'BOS',
        direction: 'bullish',
        price: lastHigh.price,
        index: i,
        time: candles[i].time,
      });
      lastHigh = null;
    } else if (lastLow && close < lastLow.price) {
      breaks.push({
        type: breaks.some((b) => b.direction === 'bullish') ? 'CHoCH' : 'BOS',
        direction: 'bearish',
        price: lastLow.price,
        index: i,
        time: candles[i].time,
      });
      lastLow = null;
    }
  }
  return breaks;
}

/** Bullish/bearish OB bands on HTF candles: last opposing candle before a displacement leg. */
function detectHtfOrderBlocks(candles, atrValue) {
  const blocks = [];
  const minBody = Math.max(0.25, num(atrValue, 0) * 0.35) || 0;
  const avgRange = (() => {
    if (candles.length < 3) return 0;
    let sum = 0;
    for (const c of candles.slice(-40)) sum += Math.max(0, num(c.high, 0) - num(c.low, 0));
    return sum / Math.min(40, candles.length);
  })();
  const threshold = Math.max(minBody, avgRange * 0.6);
  for (let i = candles.length - 2; i >= Math.max(1, candles.length - 60); i--) {
    const c = candles[i];
    const open = num(c?.open);
    const close = num(c?.close);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    const body = Math.abs(close - open);
    if (body < threshold) continue;
    const direction = close > open ? 'bullish' : 'bearish';
    // Displacement: the next candle continues in the same direction with a
    // comparable body, leaving this candle as the origin OB.
    const next = candles[i + 1];
    const nextBody = Math.abs(num(next?.close, 0) - num(next?.open, 0));
    const nextSame = direction === 'bullish'
      ? num(next?.close) > num(next?.open)
      : num(next?.close) < num(next?.open);
    if (!nextSame || nextBody < threshold * 0.6) continue;
    blocks.push({
      kind: 'ob',
      direction,
      top: Math.max(open, close, num(c.high, open)),
      bottom: Math.min(open, close, num(c.low, close)),
      time: c.time,
      index: i,
    });
    if (blocks.length >= 6) break;
  }
  return blocks;
}

/** Three-candle FVG bands on HTF candles. */
function detectHtfFvgs(candles, atrValue) {
  const gaps = [];
  const minGap = num(atrValue, 0) * 0.15;
  for (let i = candles.length - 3; i >= Math.max(0, candles.length - 60); i -= 1) {
    const a = candles[i];
    const c = candles[i + 2];
    const highA = num(a?.high);
    const lowA = num(a?.low);
    const highC = num(c?.high);
    const lowC = num(c?.low);
    if (![highA, lowA, highC, lowC].every(Number.isFinite)) continue;
    if (lowC > highA && (lowC - highA) >= minGap) {
      gaps.push({ kind: 'fvg', direction: 'bullish', top: lowC, bottom: highA, time: c.time, index: i + 2 });
    } else if (highC < lowA && (lowA - highC) >= minGap) {
      gaps.push({ kind: 'fvg', direction: 'bearish', top: lowA, bottom: highC, time: c.time, index: i + 2 });
    }
    if (gaps.length >= 6) break;
  }
  return gaps;
}

function htfAtr(candles, period = 10) {
  if (!Array.isArray(candles) || candles.length < 3) return NaN;
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

function efficiencyTrend(candles) {
  if (candles.length < 8) return { bias: 'neutral', confidence: 0 };
  const end = candles.length - 1;
  const start = Math.max(0, end - 8);
  const netMove = num(candles[end]?.close) - num(candles[start]?.close);
  let totalRange = 0;
  for (let i = start + 1; i <= end; i++) {
    const high = num(candles[i]?.high);
    const low = num(candles[i]?.low);
    const prevClose = num(candles[i - 1]?.close);
    if (![high, low, prevClose].every(Number.isFinite)) continue;
    totalRange += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  if (!Number.isFinite(netMove) || !Number.isFinite(totalRange) || totalRange <= 0) {
    return { bias: 'neutral', confidence: 0 };
  }
  const efficiency = Math.abs(netMove) / totalRange;
  if (efficiency < 0.15) return { bias: 'neutral', confidence: Math.round(efficiency * 100) };
  return { bias: netMove > 0 ? 'bullish' : 'bearish', confidence: Math.min(100, Math.round(efficiency * 100)) };
}

/**
 * Analyze MTF confluence from LTF candles.
 * @returns {Object} { bias, alignment, alignmentScore, confidence, structure,
 *   zones, premiumDiscount, priceInHtfZone, components, timeframes }
 */
export function analyzeMTFConfluence(candles) {
  if (!Array.isArray(candles) || candles.length < 32) {
    return {
      bias: 'neutral', alignment: 'neutral', alignmentScore: 0, confidence: 0,
      structure: null, zones: [], premiumDiscount: null, priceInHtfZone: null,
      components: { trend: 0, structure: 0, zones: 0, premiumDiscount: 0 },
      timeframes: [], source: 'aggregated-candles',
    };
  }
  const medium = aggregateCandles(candles, 4);
  const higher = aggregateCandles(candles, 16);
  const mediumTrend = efficiencyTrend(medium);
  const higherTrend = efficiencyTrend(higher);
  const htfAtrValue = htfAtr(higher);

  const breaks = detectHtfBreaks(higher, findHtfSwings(higher, 2));
  const latestBreak = breaks.at(-1) || null;
  const zones = [
    ...detectHtfOrderBlocks(higher, htfAtrValue),
    ...detectHtfFvgs(higher, htfAtrValue),
  ].filter((z) => Number.isFinite(z.top) && Number.isFinite(z.bottom) && z.top > z.bottom);

  // Premium/discount on the HTF range (last 30 HTF candles ≈ 480 LTF bars).
  const rangeCandles = higher.slice(-30);
  const swingHigh = rangeCandles.length ? Math.max(...rangeCandles.map((c) => num(c.high, -Infinity))) : NaN;
  const swingLow = rangeCandles.length ? Math.min(...rangeCandles.map((c) => num(c.low, Infinity))) : NaN;
  const lastClose = num(candles.at(-1)?.close);
  const validRange = Number.isFinite(swingHigh) && Number.isFinite(swingLow) && swingHigh > swingLow && Number.isFinite(lastClose);
  const premiumDiscount = validRange
    ? {
        swingHigh, swingLow,
        equilibrium: (swingHigh + swingLow) / 2,
        zone: lastClose > (swingHigh + swingLow) / 2 ? 'premium' : 'discount',
        position: (lastClose - swingLow) / (swingHigh - swingLow),
      }
    : null;

  // Price interaction with an HTF zone (inside or within 1 HTF ATR).
  let priceInHtfZone = null;
  if (Number.isFinite(lastClose)) {
    const tolerance = Number.isFinite(htfAtrValue) && htfAtrValue > 0 ? htfAtrValue : 0;
    priceInHtfZone = zones.find((z) => (
      lastClose >= z.bottom - tolerance && lastClose <= z.top + tolerance
    )) || null;
  }

  const aligned = mediumTrend.bias !== 'neutral' && mediumTrend.bias === higherTrend.bias;
  const bias = aligned ? mediumTrend.bias : 'neutral';
  const structureBias = latestBreak?.direction ?? null;

  // Breakdown components (each 0..1):
  const trendScore = aligned ? 1 : (mediumTrend.bias !== 'neutral' && higherTrend.bias !== 'neutral' ? 0.5 : 0);
  const structureScore = structureBias && bias !== 'neutral' && structureBias === bias ? 1
    : structureBias && structureBias !== bias ? 0 : 0;
  const zonesScore = priceInHtfZone && bias !== 'neutral'
    ? (priceInHtfZone.direction === bias ? 1 : 0)
    : 0;
  const pdScore = premiumDiscount && bias !== 'neutral'
    ? ((bias === 'bullish' && premiumDiscount.zone === 'discount')
      || (bias === 'bearish' && premiumDiscount.zone === 'premium') ? 1 : 0)
    : 0;
  const components = { trend: trendScore, structure: structureScore, zones: zonesScore, premiumDiscount: pdScore };
  const alignmentScore = Math.round((trendScore * 0.4 + structureScore * 0.25 + zonesScore * 0.2 + pdScore * 0.15) * 100);

  return {
    bias,
    alignment: aligned ? bias : (mediumTrend.bias !== 'neutral' && higherTrend.bias !== 'neutral' ? 'mixed' : 'neutral'),
    alignmentScore,
    confidence: aligned ? Math.round((mediumTrend.confidence + higherTrend.confidence) / 2) : 0,
    structure: latestBreak ? { type: latestBreak.type, direction: latestBreak.direction, time: latestBreak.time, price: latestBreak.price } : null,
    zones,
    premiumDiscount,
    priceInHtfZone,
    components,
    timeframes: [
      { factor: 4, ...mediumTrend },
      { factor: 16, ...higherTrend },
    ],
    source: 'aggregated-candles',
  };
}

export default { analyzeMTFConfluence, aggregateCandles };
