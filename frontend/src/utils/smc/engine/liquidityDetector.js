import { detectLiquidity, detectSwingPoints } from '../../marketStructure.js';

export function detectLiquidityZones(candles, settings = {}) {
  if (!Array.isArray(candles) || !candles.length) return { levels: [], sweeps: [], state: 'idle' };
  const window = Math.max(1, Math.floor(Number(settings.windowSize) || 3));
  const lookback = Math.max(window * 2 + 1, Math.floor(Number(settings.lookback) || 150));
  const offset = Math.max(0, candles.length - lookback);
  const swings = detectSwingPoints(candles.slice(offset), window);
  const levels = detectLiquidity(candles, settings.bins || 8).map((item) => ({
    ...item, state: 'untouched', id: `liquidity-${item.time}-${item.bottom}`,
  }));

  // Only confirmed swing levels can supply sweep evidence. Volume pockets
  // describe traded volume; their labels say nothing about a wick rejection.
  const addSwing = (swing, buySide) => {
    const confirmedIndex = offset + swing.index + window;
    const level = {
      type: buySide ? 'bsl' : 'ssl',
      liquiditySide: buySide ? 'buy' : 'sell',
      direction: buySide ? 'bearish' : 'bullish',
      price: swing.price, top: swing.price, bottom: swing.price,
      time: swing.time, confirmedTime: candles[confirmedIndex].time,
      label: `${buySide ? 'BSL' : 'SSL'} ${swing.price.toFixed(1)}`,
      color: buySide ? '#EF5350' : '#10B981',
      state: 'active', id: `${buySide ? 'bsl' : 'ssl'}-${swing.time}-${swing.price}`,
    };
    for (let i = confirmedIndex + 1; i < candles.length; i++) {
      const { high, low, close } = candles[i];
      if (![high, low, close].every((value) => value != null && Number.isFinite(Number(value)))) continue;
      const through = buySide ? Number(close) > swing.price : Number(close) < swing.price;
      if (through) { level.state = 'consumed'; break; }
      const wickedPast = buySide ? Number(high) > swing.price : Number(low) < swing.price;
      if (wickedPast && settings.sweepDetection !== false) {
        level.state = 'swept';
        level.sweptAt = candles[i].time;
        level.sweptIndex = i;
        break;
      }
    }
    levels.push(level);
  };
  if (settings.bsL !== false) swings.highs.forEach((swing) => addSwing(swing, true));
  if (settings.ssL !== false) swings.lows.forEach((swing) => addSwing(swing, false));
  return {
    levels,
    sweeps: levels.filter((item) => item.state === 'swept'),
    state: levels.length ? 'active' : 'idle',
  };
}
