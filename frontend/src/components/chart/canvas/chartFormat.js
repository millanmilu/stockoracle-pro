/**
 * Format volume into readable K / L / Cr
 */
function formatVolume(vol) {
  if (vol == null || isNaN(vol) || vol <= 0) return '—';
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
  if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toLocaleString();
}

/**
 * Decimals for price display (axis labels + OHLC legend), TradingView-style:
 * large prices drop the noisy decimals (88125 not 88125.00), small coins
 * keep them (0.15 stays 0.15). Equities are always whole rupees.
 */
function decimalsForPrice(value, isCrypto) {
  if (!isCrypto) return 0;
  const a = Math.abs(Number(value) || 0);
  if (a >= 1000) return 0;
  if (a >= 100) return 1;
  return 2;
}

/**
 * Format indicator value for display in the legend badge
 */
function formatIndicatorValue(def, candle, currSym = '₹', engineValue = null) {
  if (!candle || !def) return '—';
  if (def.type === 'overlay') {
    const val = def.field ? candle[def.field] : engineValue;
    if (val == null || isNaN(Number(val))) return '—';
    return `${currSym}${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_supertrend') {
    const val = candle[def.field];
    if (val == null || isNaN(Number(val))) return '—';
    const isBull = Number(candle[def.dirField]) === 1;
    return `${isBull ? '▲' : '▼'} ${currSym}${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_psar') {
    const val = candle[def.field];
    if (val == null || isNaN(Number(val))) return '—';
    return `${currSym}${Number(val).toFixed(2)}`;
  }
  if (def.type === 'overlay_ichimoku') {
    const t = candle.ichimoku_tenkan;
    const k = candle.ichimoku_kijun;
    if (t == null || isNaN(Number(t))) return '—';
    return `T:${Number(t).toFixed(1)} K:${Number(k || 0).toFixed(1)}`;
  }
  if (def.type === 'overlay_multi') {
    if (def.subLines && def.subLines.length >= 3) {
      const u = candle[def.subLines[0].field];
      const m = candle[def.subLines[1].field];
      const l = candle[def.subLines[2].field];
      if (m != null && !isNaN(Number(m))) {
        return `M:${Number(m).toFixed(1)} U:${Number(u).toFixed(1)} L:${Number(l).toFixed(1)}`;
      }
    }
    const u = candle.bb_upper;
    const m = candle.bb_middle;
    const l = candle.bb_lower;
    if (m == null || isNaN(Number(m))) return '—';
    return `B:${Number(m).toFixed(1)} U:${Number(u).toFixed(1)} L:${Number(l).toFixed(1)}`;
  }
  if (def.type === 'levels') {
    if (def.id === 'fibonacci') {
      const f50 = candle.fib_500;
      const f61 = candle.fib_618;
      if (f50 == null || isNaN(Number(f50))) return '—';
      return `50%:${Number(f50).toFixed(1)} 61.8%:${Number(f61).toFixed(1)}`;
    }
    const p = candle.pivot;
    const r1 = candle.r1;
    const s1 = candle.s1;
    if (p == null || isNaN(Number(p))) return '—';
    return `P:${Number(p).toFixed(1)} R1:${Number(r1).toFixed(1)} S1:${Number(s1).toFixed(1)}`;
  }
  const generic = def.field ? candle[def.field] : engineValue;
  return generic != null && !isNaN(Number(generic)) ? Number(generic).toFixed(2) : '—';
}

export { formatVolume, decimalsForPrice, formatIndicatorValue };
