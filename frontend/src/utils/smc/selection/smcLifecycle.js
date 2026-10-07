/**
 * StockOracle Pro — SMC lifecycle engine (state, not just detection).
 *
 * Replays candles AFTER each object's creation bar and advances:
 *
 *   FVG:      ACTIVE → TESTED → PARTIAL → FILLED → (hidden in smart)
 *             ACTIVE → INVALIDATED (opposite close through the gap)
 *   OB:       ACTIVE → TESTED → PARTIAL → MITIGATED → (faded)
 *             ACTIVE → INVALIDATED (close through the far side)
 *   Liquidity ACTIVE → APPROACHED → SWEPT → (hidden) / CONSUMED (held through)
 *
 * Pure: inputs (objects, candles) → new objects. No mutation, no storage.
 * Reloading the same candles reproduces identical states (no duplication).
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function indexAtOrAfter(candles, time) {
  if (!Array.isArray(candles)) return -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i]?.time === time) return i;
    if (typeof candles[i]?.time === typeof time && candles[i].time > time) return i;
  }
  return candles.length;
}

function atrAt(candles, idx, period = 14) {
  const rows = candles.slice(Math.max(0, idx - period), idx + 1);
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

function evolveZone(obj, candles) {
  const out = { ...obj };
  const { top, bottom, direction } = out;
  const bull = direction !== 'bearish';
  // Formation/departure bars confirm the zone; only later bars can retest it.
  const start = indexAtOrAfter(candles, out.confirmedTime ?? out.createdTime);
  const from = start < 0 ? 0 : start + 1;
  let retests = 0;
  let maxFill = 0;
  let touched = false;
  let invalidated = false;
  let invalidationBar = null;

  for (let i = from; i < candles.length; i++) {
    const c = candles[i];
    const h = num(c?.high);
    const l = num(c?.low);
    const cl = num(c?.close);
    if (![h, l, cl].every(Number.isFinite)) continue;
    const height = top - bottom;
    if (!(height > 0)) break;
    // Wick traded inside the zone = touch.
    const wicked = bull ? l <= top && h >= bottom : h >= bottom && l <= top;
    if (wicked) {
      touched = true;
      // Closed back outside (rejection) = retest, not fill.
      const rejected = bull ? cl > top : cl < bottom;
      if (rejected) retests += 1;
    }
    // Fill = adverse penetration depth as a fraction of zone height.
    const adverse = bull ? top - l : h - bottom;
    if (adverse > 0) maxFill = Math.max(maxFill, Math.min(1.5, adverse / height));
    // Close through the far side kills the zone.
    const through = bull ? cl < bottom : cl > top;
    if (through) {
      const a = atrAt(candles, i);
      const buf = Number.isFinite(a) ? a * 0.1 : 0;
      const hardThrough = bull ? cl < bottom - buf : cl > top + buf;
      if (hardThrough || maxFill >= 1) {
        invalidated = true;
        invalidationBar = c.time ?? null;
        break;
      }
    }
    if (maxFill >= 1) break; // fully filled — terminal for display
  }

  out.retests = retests;
  out.fillPct = Math.max(0, Math.min(1.5, maxFill));
  out.ageBars = Math.max(0, candles.length - 1 - Math.max(0, from - 1));
  if (invalidated) {
    out.state = 'invalidated';
    out.invalidatedAt = invalidationBar;
  } else if (out.fillPct >= 1) {
    out.state = out.kind === 'fvg' ? 'filled' : 'mitigated';
  } else if (out.fillPct >= 0.5) {
    out.state = 'partial';
  } else if (touched) {
    out.state = 'tested';
  } else {
    out.state = 'active';
  }
  return out;
}

function evolveLiquidity(obj, candles, lastClose) {
  const out = { ...obj };
  // Confirmed swings arrive with lifecycle computed by the detector for this
  // candle snapshot. Preserve its evidence and sweepDetection setting.
  if (out.confirmedTime != null) {
    out.ageBars = Math.max(0, candles.length - 1 - indexAtOrAfter(candles, out.createdTime));
    return out;
  }
  const p = Number(out.price ?? out.mid);
  if (!Number.isFinite(p)) {
    out.state = 'consumed';
    return out;
  }
  const start = indexAtOrAfter(candles, out.confirmedTime ?? out.createdTime);
  const from = start < 0 ? 0 : start + 1;
  const side = String(out.rawType || '').toLowerCase();
  const above = out.liquiditySide === 'buy' || /bsl|eqh|pdh|pwh|resistance/.test(side) ? true
    : out.liquiditySide === 'sell' || /ssl|eql|pdl|pwl|support/.test(side) ? false
      : p >= num(candles[start]?.close ?? lastClose);
  let state = 'active';
  for (let i = from; i < candles.length; i++) {
    const c = candles[i];
    const h = num(c?.high);
    const l = num(c?.low);
    const cl = num(c?.close);
    if (![h, l, cl].every(Number.isFinite)) continue;
    const a = atrAt(candles, i);
    const buf = Number.isFinite(a) ? a * 0.15 : Math.abs(p) * 0.0005;
    // Sweep: wick takes the level, body closes back on the original side.
    const wickedPast = above ? h > p + buf * 0.2 : l < p - buf * 0.2;
    const closedBack = above ? cl <= p : cl >= p;
    const closedThrough = above ? cl > p + buf : cl < p - buf;
    if (wickedPast && closedBack) {
      state = 'swept';
      out.sweptAt = c.time ?? null;
      break; // first sweep decides — later re-taps don't resurrect it
    }
    if (closedThrough) {
      state = 'consumed';
      break;
    }
    const dist = Math.abs((above ? l : h) - p);
    if (dist <= buf * 1.5) state = 'approached';
  }
  out.state = state;
  const idx = indexAtOrAfter(candles, out.createdTime);
  out.ageBars = Math.max(0, candles.length - 1 - Math.max(0, idx));
  return out;
}

/**
 * Advance lifecycle for a normalized object list.
 * Unknown kinds pass through untouched (never silently dropped here —
 * the selector decides visibility).
 */
export function updateLifecycle(objects, candles) {
  if (!Array.isArray(objects) || !Array.isArray(candles) || candles.length === 0) {
    return Array.isArray(objects) ? objects : [];
  }
  const last = candles[candles.length - 1];
  const lastClose = num(last?.close);
  return objects.map((o) => {
    if (!o || typeof o !== 'object') return o;
    try {
      if (o.kind === 'fvg' || o.kind === 'ob') return evolveZone(o, candles);
      if (o.kind === 'liquidity') return evolveLiquidity(o, candles, lastClose);
      return { ...o };
    } catch {
      return { ...o };
    }
  });
}
