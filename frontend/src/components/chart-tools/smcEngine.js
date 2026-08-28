/**
 * StockOracle Pro — Smart Money Concepts (SMC) & Liquidity Imbalance Engine
 * High-performance algorithmic detection of Fair Value Gaps (FVG),
 * Institutional Order Blocks (OB), and Market Structure Breaks (BOS / CHoCH).
 */

/**
 * Detects Fair Value Gaps (FVGs) in the candle series.
 * @param {Array} candles - Array of OHLC candles
 * @param {number} maxGaps - Maximum number of active gaps to return
 */
export function detectFVGs(candles, maxGaps = 8) {
  if (!Array.isArray(candles) || candles.length < 3) return [];

  const fvgs = [];
  const n = candles.length;

  for (let i = 2; i < n; i++) {
    const c0 = candles[i - 2]; // 1st candle
    const c1 = candles[i - 1]; // Displacement candle
    const c2 = candles[i];     // 3rd candle

    const c0High = Number(c0.high);
    const c0Low  = Number(c0.low);
    const c2High = Number(c2.high);
    const c2Low  = Number(c2.low);

    if (isNaN(c0High) || isNaN(c2Low)) continue;

    // 1. Bullish FVG (Gap between c0 high and c2 low)
    if (c2Low > c0High) {
      const top = c2Low;
      const bottom = c0High;
      const mid = (top + bottom) / 2;

      // Check if subsequent candles have mitigated this FVG
      let mitigated = false;
      for (let j = i + 1; j < n; j++) {
        if (Number(candles[j].low) <= bottom) {
          mitigated = true;
          break;
        }
      }

      if (!mitigated) {
        fvgs.push({
          type: 'bullish_fvg',
          top,
          bottom,
          mid,
          time: c1.time,
          label: `Bullish FVG ₹${bottom.toFixed(1)}-${top.toFixed(1)}`,
          color: 'rgba(16, 185, 129, 0.25)',
          borderColor: '#10B981',
        });
      }
    }

    // 2. Bearish FVG (Gap between c0 low and c2 high)
    if (c2High < c0Low) {
      const top = c0Low;
      const bottom = c2High;
      const mid = (top + bottom) / 2;

      // Check if subsequent candles have mitigated this FVG
      let mitigated = false;
      for (let j = i + 1; j < n; j++) {
        if (Number(candles[j].high) >= top) {
          mitigated = true;
          break;
        }
      }

      if (!mitigated) {
        fvgs.push({
          type: 'bearish_fvg',
          top,
          bottom,
          mid,
          time: c1.time,
          label: `Bearish FVG ₹${bottom.toFixed(1)}-${top.toFixed(1)}`,
          color: 'rgba(239, 83, 80, 0.25)',
          borderColor: '#EF5350',
        });
      }
    }
  }

  // Return the most recent unmitigated FVGs
  return fvgs.slice(-maxGaps);
}

/**
 * Detects institutional Order Blocks (OB).
 */
export function detectOrderBlocks(candles, lookback = 80) {
  if (!Array.isArray(candles) || candles.length < 5) return [];

  const obs = [];
  const start = Math.max(0, candles.length - lookback);

  for (let i = start + 1; i < candles.length - 2; i++) {
    const prev = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const prevClose = Number(prev.close);
    const prevOpen  = Number(prev.open);
    const next1Close = Number(next1.close);
    const next2Close = Number(next2.close);

    const isPrevBearish = prevClose < prevOpen;
    const isPrevBullish = prevClose > prevOpen;

    // Bullish OB: Last down candle before a powerful 2-bar rally
    if (isPrevBearish && next1Close > Number(prev.high) && next2Close > next1Close) {
      obs.push({
        type: 'bullish_ob',
        top: Number(prev.high),
        bottom: Number(prev.low),
        price: Number(prev.low),
        time: prev.time,
        label: `Bullish OB ₹${Number(prev.low).toFixed(0)}`,
        color: '#10B981',
      });
    }

    // Bearish OB: Last up candle before a powerful 2-bar drop
    if (isPrevBullish && next1Close < Number(prev.low) && next2Close < next1Close) {
      obs.push({
        type: 'bearish_ob',
        top: Number(prev.high),
        bottom: Number(prev.low),
        price: Number(prev.high),
        time: prev.time,
        label: `Bearish OB ₹${Number(prev.high).toFixed(0)}`,
        color: '#EF5350',
      });
    }
  }

  return obs.slice(-6);
}

/**
 * Detects Market Structure Breaks (BOS / CHoCH).
 */
export function detectMarketStructure(candles, windowSize = 5) {
  if (!Array.isArray(candles) || candles.length < windowSize * 2 + 1) return { swingHighs: [], swingLows: [], breaks: [] };

  const swingHighs = [];
  const swingLows = [];
  const breaks = [];

  const n = candles.length;

  // 1. Identify fractal swing highs and swing lows
  for (let i = windowSize; i < n - windowSize; i++) {
    const currentHigh = Number(candles[i].high);
    const currentLow  = Number(candles[i].low);

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (Number(candles[j].high) >= currentHigh) isSwingHigh = false;
      if (Number(candles[j].low) <= currentLow) isSwingLow = false;
    }

    if (isSwingHigh) {
      swingHighs.push({ index: i, time: candles[i].time, price: currentHigh });
    }
    if (isSwingLow) {
      swingLows.push({ index: i, time: candles[i].time, price: currentLow });
    }
  }

  // 2. Identify BOS / CHoCH across recent swings
  const recentHighs = swingHighs.slice(-4);
  const recentLows = swingLows.slice(-4);

  const lastClose = Number(candles[n - 1]?.close || 0);

  recentHighs.forEach((sh) => {
    if (lastClose > sh.price) {
      breaks.push({
        type: 'BOS_BULL',
        label: `BOS (Break High) ₹${sh.price.toFixed(1)}`,
        price: sh.price,
        time: sh.time,
        color: '#10B981',
      });
    }
  });

  recentLows.forEach((sl) => {
    if (lastClose < sl.price) {
      breaks.push({
        type: 'BOS_BEAR',
        label: `BOS (Break Low) ₹${sl.price.toFixed(1)}`,
        price: sl.price,
        time: sl.time,
        color: '#EF5350',
      });
    }
  });

  return {
    swingHighs: swingHighs.slice(-6),
    swingLows: swingLows.slice(-6),
    breaks: breaks.slice(-4),
  };
}
