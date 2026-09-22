/**
 * StockOracle Pro — Volume Profile engine (TradingView VPVR parity).
 *
 * Pure, render-free computation over OHLCV candles:
 *   - Splits the visible price range into N rows; each bar's volume is
 *     distributed across the rows its [low, high] range overlaps,
 *     proportional to the overlap (flat bars go fully into one row).
 *   - Splits each row into up/down volume (close >= open → up, TV convention).
 *   - POC = highest-volume row; Value Area expands from POC adding the
 *     larger-volume neighbour until `valueAreaPercent` of total is covered.
 *
 * Run with: node --test src/utils/volumeProfile.test.js (no deps, no DOM).
 */

export const DEFAULT_PROFILE_ROWS = 24;
export const DEFAULT_VALUE_AREA_PERCENT = 70;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {Array} candles OHLCV bars ({open,high,low,close,volume})
 * @param {Object} opts { rows, valueAreaPercent }
 * @returns profile object or null when there is nothing computable.
 */
export function computeVolumeProfile(candles, opts = {}) {
  const rows = Math.max(4, Math.min(200, Math.round(num(opts.rows, DEFAULT_PROFILE_ROWS)) || DEFAULT_PROFILE_ROWS));
  const vaPct = Math.max(1, Math.min(99, num(opts.valueAreaPercent, DEFAULT_VALUE_AREA_PERCENT)));

  if (!Array.isArray(candles) || candles.length === 0) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;
  const clean = [];
  for (const c of candles) {
    if (!c) continue;
    const o = num(c.open, NaN);
    const h = num(c.high, NaN);
    const l = num(c.low, NaN);
    const cl = num(c.close, NaN);
    const v = num(c.volume, 0);
    if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(cl)) continue;
    if (h < l) continue;
    const hi = Math.max(h, o, cl);
    const lo = Math.min(l, o, cl);
    if (hi > maxPrice) maxPrice = hi;
    if (lo < minPrice) minPrice = lo;
    if (v > 0) totalVolume += v;
    clean.push({ o, h: hi, l: lo, c: cl, v });
  }
  if (clean.length === 0 || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) return null;
  if (totalVolume <= 0) return null;
  // Degenerate flat range (all same price): single-row profile.
  if (!(maxPrice > minPrice)) {
    const mid = minPrice;
    return {
      rows: [{ low: mid, high: mid, mid, volume: totalVolume, upVolume: totalVolume, downVolume: 0 }],
      poc: { price: mid, volume: totalVolume, rowIndex: 0 },
      vah: mid,
      val: mid,
      totalVolume,
      valueAreaVolume: totalVolume,
      minPrice,
      maxPrice,
    };
  }

  const span = maxPrice - minPrice;
  const rowH = span / rows;
  const vols = new Array(rows).fill(0);
  const ups = new Array(rows).fill(0);
  const downs = new Array(rows).fill(0);

  for (const c of clean) {
    if (c.v <= 0) continue;
    const up = c.c >= c.o;
    const range = c.h - c.l;
    if (range <= 0) {
      // Flat bar: everything into the containing row.
      const idx = Math.max(0, Math.min(rows - 1, Math.floor((c.l - minPrice) / rowH)));
      vols[idx] += c.v;
      if (up) ups[idx] += c.v;
      else downs[idx] += c.v;
      continue;
    }
    // Pro-rata split across overlapped rows.
    let first = Math.floor((c.l - minPrice) / rowH);
    let last = Math.floor((c.h - minPrice) / rowH);
    first = Math.max(0, Math.min(rows - 1, first));
    last = Math.max(0, Math.min(rows - 1, last));
    for (let i = first; i <= last; i += 1) {
      const edgeLo = minPrice + i * rowH;
      const edgeHi = edgeLo + rowH;
      const overlap = Math.max(0, Math.min(c.h, edgeHi) - Math.max(c.l, edgeLo));
      if (overlap <= 0) continue;
      const share = (overlap / range) * c.v;
      vols[i] += share;
      if (up) ups[i] += share;
      else downs[i] += share;
    }
  }

  // POC — first max wins (deterministic).
  let pocIndex = 0;
  for (let i = 1; i < rows; i += 1) {
    if (vols[i] > vols[pocIndex]) pocIndex = i;
  }

  // Value Area: expand from POC, always adding the larger neighbour.
  const target = totalVolume * (vaPct / 100);
  let vaTop = pocIndex;
  let vaBottom = pocIndex;
  let vaVol = vols[pocIndex];
  while (vaVol < target && (vaTop < rows - 1 || vaBottom > 0)) {
    const upNext = vaTop < rows - 1 ? vols[vaTop + 1] : -1;
    const downNext = vaBottom > 0 ? vols[vaBottom - 1] : -1;
    if (upNext < 0 && downNext < 0) break;
    if (upNext >= downNext) {
      vaTop += 1;
      vaVol += vols[vaTop];
    } else {
      vaBottom -= 1;
      vaVol += vols[vaBottom];
    }
  }

  const outRows = vols.map((volume, i) => ({
    low: minPrice + i * rowH,
    high: minPrice + (i + 1) * rowH,
    mid: minPrice + (i + 0.5) * rowH,
    volume,
    upVolume: ups[i],
    downVolume: downs[i],
  }));

  return {
    rows: outRows,
    poc: { price: outRows[pocIndex].mid, volume: vols[pocIndex], rowIndex: pocIndex },
    vah: outRows[vaTop].high,
    val: outRows[vaBottom].low,
    totalVolume,
    valueAreaVolume: vaVol,
    minPrice,
    maxPrice,
  };
}
