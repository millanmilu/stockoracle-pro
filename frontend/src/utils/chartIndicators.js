/**
 * StockOracle Pro — Client-Side Chart Indicator Calculations
 * High-performance, zero-dependency streaming indicator computation
 */

export function calculateSMA(candles, period = 20) {
  if (!candles || candles.length < period) return [];
  const result = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const val = Number(candles[i].close || 0);
    sum += val;
    if (i >= period) {
      sum -= Number(candles[i - period].close || 0);
    }
    if (i >= period - 1) {
      result.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(2)),
      });
    }
  }
  return result;
}

export function calculateEMA(candles, period = 20) {
  if (!candles || candles.length < period) return [];
  const result = [];
  const k = 2 / (period + 1);
  let ema = Number(candles[0].close || 0);

  // Initialize with SMA
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += Number(candles[i].close || 0);
  }
  ema = initialSum / period;
  result.push({
    time: candles[period - 1].time,
    value: Number(ema.toFixed(2)),
  });

  for (let i = period; i < candles.length; i++) {
    const close = Number(candles[i].close || 0);
    ema = close * k + ema * (1 - k);
    result.push({
      time: candles[i].time,
      value: Number(ema.toFixed(2)),
    });
  }
  return result;
}

export function calculateBollingerBands(candles, period = 20, stdDevMultiplier = 2) {
  if (!candles || candles.length < period) return { upper: [], middle: [], lower: [] };
  const upper = [];
  const middle = [];
  const lower = [];

  let sum = 0;
  let sumSq = 0;

  // Initialize initial window
  for (let i = 0; i < period; i++) {
    const val = Number(candles[i].close || 0);
    sum += val;
    sumSq += val * val;
  }

  const mean0 = sum / period;
  const var0 = Math.max(0, (sumSq / period) - (mean0 * mean0));
  const stdDev0 = Math.sqrt(var0);
  const time0 = candles[period - 1].time;
  middle.push({ time: time0, value: Number(mean0.toFixed(2)) });
  upper.push({ time: time0, value: Number((mean0 + stdDev0 * stdDevMultiplier).toFixed(2)) });
  lower.push({ time: time0, value: Number((mean0 - stdDev0 * stdDevMultiplier).toFixed(2)) });

  // Slide window in O(1) per step
  for (let i = period; i < candles.length; i++) {
    const oldVal = Number(candles[i - period].close || 0);
    const newVal = Number(candles[i].close || 0);

    sum += newVal - oldVal;
    sumSq += (newVal * newVal) - (oldVal * oldVal);

    const mean = sum / period;
    const variance = Math.max(0, (sumSq / period) - (mean * mean));
    const stdDev = Math.sqrt(variance);

    const time = candles[i].time;
    middle.push({ time, value: Number(mean.toFixed(2)) });
    upper.push({ time, value: Number((mean + stdDev * stdDevMultiplier).toFixed(2)) });
    lower.push({ time, value: Number((mean - stdDev * stdDevMultiplier).toFixed(2)) });
  }

  return { upper, middle, lower };
}

export function calculateRSI(candles, period = 14) {
  if (!candles || candles.length <= period) return [];
  const result = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = Number(candles[i].close) - Number(candles[i - 1].close);
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  result.push({ time: candles[period].time, value: Number(rsi.toFixed(2)) });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = Number(candles[i].close) - Number(candles[i - 1].close);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    result.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
  }

  return result;
}

export function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!candles || candles.length < slowPeriod + signalPeriod) return { macd: [], signal: [], histogram: [] };
  
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  // Align slow and fast
  const macdLine = [];
  const slowMap = new Map(slowEMA.map(s => [s.time, s.value]));

  fastEMA.forEach(f => {
    if (slowMap.has(f.time)) {
      macdLine.push({
        time: f.time,
        close: f.value - slowMap.get(f.time),
      });
    }
  });

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalMap = new Map(signalLine.map(s => [s.time, s.value]));

  const macd = [];
  const signal = [];
  const histogram = [];

  macdLine.forEach(m => {
    if (signalMap.has(m.time)) {
      const sigVal = signalMap.get(m.time);
      const histVal = m.close - sigVal;
      macd.push({ time: m.time, value: Number(m.close.toFixed(2)) });
      signal.push({ time: m.time, value: Number(sigVal.toFixed(2)) });
      histogram.push({
        time: m.time,
        value: Number(histVal.toFixed(2)),
        color: histVal >= 0 ? '#10B981' : '#EF5350',
      });
    }
  });

  return { macd, signal, histogram, hist: histogram };
}

export function calculateALMA(candles, windowSize = 9, offset = 0.85, sigma = 6) {
  if (!candles || candles.length < windowSize) return [];
  const result = [];
  const m = Math.floor(offset * (windowSize - 1));
  const s = windowSize / sigma;

  const weights = [];
  let norm = 0;
  for (let i = 0; i < windowSize; i++) {
    const w = Math.exp(-Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(w);
    norm += w;
  }

  for (let i = windowSize - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += Number(candles[i - windowSize + 1 + j].close || 0) * weights[j];
    }
    result.push({
      time: candles[i].time,
      value: Number((sum / norm).toFixed(2)),
    });
  }

  return result;
}

export function calculateHeikinAshi(candles) {
  if (!candles || candles.length === 0) return [];
  const haCandles = [];

  for (let i = 0; i < candles.length; i++) {
    const cur = candles[i];
    const haClose = (Number(cur.open) + Number(cur.high) + Number(cur.low) + Number(cur.close)) / 4;
    let haOpen = Number(cur.open);
    if (i > 0) {
      haOpen = (haCandles[i - 1].open + haCandles[i - 1].close) / 2;
    }
    const haHigh = Math.max(Number(cur.high), haOpen, haClose);
    const haLow = Math.min(Number(cur.low), haOpen, haClose);

    haCandles.push({
      time: cur.time,
      open: Number(haOpen.toFixed(2)),
      high: Number(haHigh.toFixed(2)),
      low: Number(haLow.toFixed(2)),
      close: Number(haClose.toFixed(2)),
      volume: cur.volume,
    });
  }

  return haCandles;
}

export function calculateKeyLevels(candles, lookback = 50) {
  if (!candles || candles.length < lookback) return [];
  const recent = candles.slice(-lookback);
  let highest = -Infinity;
  let lowest = Infinity;

  recent.forEach(c => {
    if (Number(c.high) > highest) highest = Number(c.high);
    if (Number(c.low) < lowest) lowest = Number(c.low);
  });

  const mid = (highest + lowest) / 2;
  return [
    { label: 'Resistance (High)', title: 'Resistance', price: Number(highest.toFixed(2)), color: '#EF5350' },
    { label: 'Equilibrium (Mid)', title: 'Equilibrium', price: Number(mid.toFixed(2)), color: '#F59E0B' },
    { label: 'Support (Low)', title: 'Support', price: Number(lowest.toFixed(2)), color: '#10B981' },
  ];
}

export function detectPatterns(candles) {
  if (!candles || candles.length < 5) return [];
  const markers = [];
  const n = candles.length;

  for (let i = 2; i < n; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    const c1Close = Number(c1.close);
    const c1Open = Number(c1.open);
    const c2Close = Number(c2.close);
    const c2Open = Number(c2.open);
    const c3Close = Number(c3.close);
    const c3Open = Number(c3.open);

    // Bullish Engulfing
    if (c2Close < c2Open && c3Close > c3Open && c3Open < c2Close && c3Close > c2Open) {
      markers.push({
        time: c3.time,
        position: 'belowBar',
        color: '#10B981',
        shape: 'arrowUp',
        text: 'Engulfing',
      });
    }

    // Bearish Engulfing
    if (c2Close > c2Open && c3Close < c3Open && c3Open > c2Close && c3Close < c2Open) {
      markers.push({
        time: c3.time,
        position: 'aboveBar',
        color: '#EF5350',
        shape: 'arrowDown',
        text: 'Engulfing',
      });
    }
  }

  return markers.slice(-15);
}
