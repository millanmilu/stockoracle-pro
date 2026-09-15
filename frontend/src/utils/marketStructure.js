/**
 * StockOracle Pro — Market Structure / Smart Money Concepts (SMC) Engine
 * Algorithmic detection for overlays drawn on the main price chart.
 *
 * Each detector returns plain marker/level descriptors that the chart layer
 * maps onto Lightweight Charts price lines + series markers:
 *   { type, price || {top,bottom}, time, label, color, position }
 */

const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? null : n;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Swing Highs / Lows (fractal)
// ─────────────────────────────────────────────────────────────────────────────
export function detectSwingPoints(candles, windowSize = 5) {
  if (!Array.isArray(candles) || candles.length < windowSize * 2 + 1) {
    return { highs: [], lows: [] };
  }
  const highs = [];
  const lows = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    const currentHigh = num(candles[i].high);
    const currentLow = num(candles[i].low);
    let isHigh = true;
    let isLow = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      const h = num(candles[j].high);
      const l = num(candles[j].low);
      if (h != null && currentHigh != null && h >= currentHigh) isHigh = false;
      if (l != null && currentLow != null && l <= currentLow) isLow = false;
    }
    if (isHigh && currentHigh != null) {
      highs.push({ index: i, time: candles[i].time, price: currentHigh });
    }
    if (isLow && currentLow != null) {
      lows.push({ index: i, time: candles[i].time, price: currentLow });
    }
  }
  // Keep recent, de-duplicated
  return { highs: highs.slice(-30), lows: lows.slice(-30) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HH / HL / LH / LL market structure labels
// ─────────────────────────────────────────────────────────────────────────────
export function detectStructureSequence(swings) {
  // swings: { highs: [{time, price}], lows: [{time, price}] }
  const events = [];
  const highs = swings.highs || [];
  const lows = swings.lows || [];

  for (let i = 1; i < highs.length; i++) {
    const prev = highs[i - 1];
    const cur = highs[i];
    const label = cur.price > prev.price ? 'HH' : cur.price < prev.price ? 'LH' : null;
    if (label) events.push({ type: 'high', label, ...cur });
  }
  for (let i = 1; i < lows.length; i++) {
    const prev = lows[i - 1];
    const cur = lows[i];
    const label = cur.price > prev.price ? 'HL' : cur.price < prev.price ? 'LL' : null;
    if (label) events.push({ type: 'low', label, ...cur });
  }

  events.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOS (Break of Structure) / CHoCH (Change of Character)
// ─────────────────────────────────────────────────────────────────────────────
export function detectBosChoch(candles, windowSize = 5) {
  const swings = detectSwingPoints(candles, windowSize);
  const breaks = [];
  const lastClose = num(candles[candles.length - 1]?.close) ?? 0;

  const recentHighs = swings.highs.slice(-8);
  const recentLows = swings.lows.slice(-8);

  // A BOS happens when an earlier swing is decisively broken in the trend direction.
  recentHighs.forEach((sh) => {
    if (lastClose > sh.price) {
      breaks.push({
        type: 'BOS',
        direction: 'bull',
        label: `BOS ↑ ${sh.price.toFixed(1)}`,
        price: sh.price,
        time: sh.time,
        color: '#10B981',
        position: 'belowBar',
        shape: 'arrowUp',
      });
    } else {
      breaks.push({
        type: 'CHoCH',
        direction: 'bear',
        label: `CHoCH ${sh.price.toFixed(1)}`,
        price: sh.price,
        time: sh.time,
        color: '#EF5350',
        position: 'aboveBar',
        shape: 'arrowDown',
      });
    }
  });

  recentLows.forEach((sl) => {
    if (lastClose < sl.price) {
      breaks.push({
        type: 'BOS',
        direction: 'bear',
        label: `BOS ↓ ${sl.price.toFixed(1)}`,
        price: sl.price,
        time: sl.time,
        color: '#EF5350',
        position: 'aboveBar',
        shape: 'arrowDown',
      });
    } else {
      breaks.push({
        type: 'CHoCH',
        direction: 'bull',
        label: `CHoCH ${sl.price.toFixed(1)}`,
        price: sl.price,
        time: sl.time,
        color: '#10B981',
        position: 'belowBar',
        shape: 'arrowUp',
      });
    }
  });

  return breaks.slice(-10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Supply / Demand Zones
// ─────────────────────────────────────────────────────────────────────────────
export function detectSupplyDemand(candles, lookback = 120) {
  if (!Array.isArray(candles) || candles.length < 3) return [];
  const zones = [];
  const start = Math.max(0, candles.length - lookback);

  for (let i = start; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    const body = Math.abs(num(c.close) - num(c.open));
    const range = num(c.high) - num(c.low);

    // Demand zone: rally candle with strong upward move and small upper wick
    const bull = num(c.close) > num(c.open);
    const strongMove = next && num(next.close) > num(c.high);
    if (bull && strongMove && body / (range || 1) > 0.4) {
      const top = num(c.open) + body * 0.5;
      const bottom = num(c.open);
      zones.push({
        type: 'demand',
        top: Math.max(top, bottom),
        bottom: Math.min(top, bottom),
        time: c.time,
        label: `Demand ${bottom.toFixed(1)}`,
        color: '#10B981',
      });
      i += 1;
      continue;
    }

    // Supply zone: drop candle with strong downward move and small lower wick
    const bear = num(c.close) < num(c.open);
    const strongDrop = next && num(next.close) < num(c.low);
    if (bear && strongDrop && body / (range || 1) > 0.4) {
      const top = num(c.open);
      const bottom = num(c.open) - body * 0.5;
      zones.push({
        type: 'supply',
        top: Math.max(top, bottom),
        bottom: Math.min(top, bottom),
        time: c.time,
        label: `Supply ${top.toFixed(1)}`,
        color: '#EF5350',
      });
      i += 1;
    }
  }

  return zones.slice(-8);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Order Blocks
// ─────────────────────────────────────────────────────────────────────────────
export function detectOrderBlocks(candles, lookback = 100) {
  if (!Array.isArray(candles) || candles.length < 5) return [];
  const obs = [];
  const start = Math.max(0, candles.length - lookback);

  for (let i = start + 1; i < candles.length - 2; i++) {
    const prev = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const isPrevBearish = num(prev.close) < num(prev.open);
    const isPrevBullish = num(prev.close) > num(prev.open);

    if (isPrevBearish && num(next1.close) > num(prev.high) && num(next2.close) > num(next1.close)) {
      obs.push({
        type: 'bullish_ob',
        top: num(prev.high),
        bottom: num(prev.low),
        time: prev.time,
        label: `Bullish OB ${num(prev.low).toFixed(0)}`,
        color: '#10B981',
      });
    }
    if (isPrevBullish && num(next1.close) < num(prev.low) && num(next2.close) < num(next1.close)) {
      obs.push({
        type: 'bearish_ob',
        top: num(prev.high),
        bottom: num(prev.low),
        time: prev.time,
        label: `Bearish OB ${num(prev.high).toFixed(0)}`,
        color: '#EF5350',
      });
    }
  }
  return obs.slice(-8);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Fair Value Gaps (FVG)
// ─────────────────────────────────────────────────────────────────────────────
export function detectFVGs(candles, maxGaps = 8) {
  if (!Array.isArray(candles) || candles.length < 3) return [];
  const fvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    const c0High = num(c0.high);
    const c0Low = num(c0.low);
    const c2High = num(c2.high);
    const c2Low = num(c2.low);

    let mitigated = false;
    if (c2Low != null && c0High != null && c2Low > c0High) {
      for (let j = i + 1; j < candles.length; j++) {
        if (num(candles[j].low) <= c0High) { mitigated = true; break; }
      }
      if (!mitigated) {
        fvgs.push({
          type: 'bullish_fvg',
          top: c2Low,
          bottom: c0High,
          time: candles[i - 1].time,
          label: `FVG ${c0High.toFixed(1)}-${c2Low.toFixed(1)}`,
          color: '#10B981',
        });
      }
    }
    if (c2High != null && c0Low != null && c2High < c0Low) {
      mitigated = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (num(candles[j].high) >= c0Low) { mitigated = true; break; }
      }
      if (!mitigated) {
        fvgs.push({
          type: 'bearish_fvg',
          top: c0Low,
          bottom: c2High,
          time: candles[i - 1].time,
          label: `FVG ${c2High.toFixed(1)}-${c0Low.toFixed(1)}`,
          color: '#EF5350',
        });
      }
    }
  }

  return fvgs.slice(-maxGaps);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Liquidity Zones (high-volume price pockets)
// ─────────────────────────────────────────────────────────────────────────────
export function detectLiquidity(candles, bins = 8) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const recent = candles.slice(-120);
  const lows = recent.map((c) => num(c.low)).filter((v) => v != null);
  const highs = recent.map((c) => num(c.high)).filter((v) => v != null);
  if (!lows.length || !highs.length) return [];

  const min = Math.min(...lows);
  const max = Math.max(...highs);
  if (max - min <= 0) return [];

  const binSize = (max - min) / bins;
  const histogram = Array(bins).fill(0);
  recent.forEach((c) => {
    const vol = num(c.volume) || 0;
    const mid = (num(c.high) + num(c.low)) / 2;
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((mid - min) / binSize)));
    histogram[idx] += vol;
  });

  const maxVol = Math.max(...histogram);
  const zones = [];
  histogram.forEach((v, idx) => {
    if (v >= maxVol * 0.6) {
      const bottom = min + idx * binSize;
      const top = bottom + binSize;
      zones.push({
        type: 'liquidity',
        top,
        bottom,
        time: recent[recent.length - 1]?.time,
        label: `Liq ${bottom.toFixed(1)}-${top.toFixed(1)}`,
        color: '#FB923C',
      });
    }
  });
  return zones.slice(-4);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Support / Resistance (rolling swing levels)
// ─────────────────────────────────────────────────────────────────────────────
export function detectSR(candles, lookback = 150) {
  if (!Array.isArray(candles) || candles.length < 5) return [];
  const swings = detectSwingPoints(candles, 3);
  const levels = [];
  const seen = new Set();

  const addLevel = (price, kind) => {
    if (price == null || !isFinite(price)) return;
    const rounded = Math.round(price * 100) / 100;
    if (seen.has(rounded)) return;
    seen.add(rounded);
    levels.push({
      type: kind, // 'support' | 'resistance'
      price: rounded,
      time: candles[candles.length - 1]?.time,
      label: `${kind === 'support' ? 'S' : 'R'} ${rounded.toFixed(1)}`,
      color: kind === 'support' ? '#10B981' : '#EF5350',
    });
  };

  swings.lows.slice(-6).forEach((sw) => addLevel(sw.price, 'support'));
  swings.highs.slice(-6).forEach((sw) => addLevel(sw.price, 'resistance'));

  return levels.slice(-12);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher: matches a catalog `smcType` to its detector
// ─────────────────────────────────────────────────────────────────────────────
export function detectSMC(smcType, candles, params = {}) {
  switch (smcType) {
    case 'swing_hl': {
      const s = detectSwingPoints(candles, params.windowSize || 5);
      return [
        ...s.highs.map((p) => ({ type: 'swing_high', price: p.price, time: p.time, label: `HH`, color: '#34D399', position: 'aboveBar', shape: 'circle' })),
        ...s.lows.map((p) => ({ type: 'swing_low', price: p.price, time: p.time, label: 'LL', color: '#F87171', position: 'belowBar', shape: 'circle' })),
      ];
    }
    case 'hh_hl': {
      const s = detectSwingPoints(candles, params.windowSize || 5);
      return detectStructureSequence(s).map((e) => ({
        type: e.type === 'high' ? 'structure_high' : 'structure_low',
        price: e.price,
        time: e.time,
        label: e.label,
        color: e.label.startsWith('H') ? '#34D399' : '#F87171',
        position: e.type === 'high' ? 'aboveBar' : 'belowBar',
        shape: 'circle',
      }));
    }
    case 'bos_choch':
      return detectBosChoch(candles, params.windowSize || 5);
    case 'supply_demand':
      return detectSupplyDemand(candles, params.lookback || 120);
    case 'order_blocks':
      return detectOrderBlocks(candles, params.lookback || 100);
    case 'fvg':
      return detectFVGs(candles, params.maxGaps || 8);
    case 'liquidity':
      return detectLiquidity(candles, params.bins || 8);
    case 'sr_lines':
      return detectSR(candles, params.lookback || 150);
    default:
      return [];
  }
}