// Pro Terminal V2 — Mock Candle Data
// Generates realistic-looking OHLCV data for the experimental chart.

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateCandles(symbol = 'RELIANCE', count = 200, interval = '5m') {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const basePrice = symbol === 'RELIANCE' ? 2850 : symbol === 'TCS' ? 3850 : symbol === 'HDFCBANK' ? 1650 : symbol === 'INFY' ? 1520 : 2000;
  const volatility = basePrice * 0.003;
  const intervalMinutes = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 }[interval] || 5;

  const candles = [];
  let price = basePrice * (0.95 + rand() * 0.1);
  const now = Date.now();
  const startTime = now - count * intervalMinutes * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const drift = Math.sin(i / 20) * volatility * 0.3;
    const change = (rand() - 0.48) * volatility + drift;
    const open = price;
    const close = Math.max(1, open + change);
    const high = Math.max(open, close) + rand() * volatility * 0.5;
    const low = Math.min(open, close) - rand() * volatility * 0.5;
    const volume = Math.floor(50000 + rand() * 200000 + Math.abs(change) * 500000);

    candles.push({
      time: Math.floor((startTime + i * intervalMinutes * 60 * 1000) / 1000),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return candles;
}

export function generateLineData(candles) {
  return candles.map((c) => ({ time: c.time, value: c.close }));
}

export function generateAreaData(candles) {
  return candles.map((c) => ({ time: c.time, value: c.close }));
}

export function generateEMA(candles, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = candles[0]?.close || 0;
  for (let i = 0; i < candles.length; i++) {
    ema = i === 0 ? candles[i].close : candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
  }
  return result;
}

export function generateRSI(candles, period = 14) {
  const result = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      result.push({ time: candles[i].time, value: 50 });
      continue;
    }
    const change = candles[i].close - candles[i - 1].close;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);

    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    result.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
  }
  return result;
}

export function generateMACD(candles) {
  const ema12 = generateEMA(candles, 12);
  const ema26 = generateEMA(candles, 26);
  const macdLine = [];
  for (let i = 0; i < candles.length; i++) {
    macdLine.push({
      time: candles[i].time,
      value: Number((ema12[i].value - ema26[i].value).toFixed(2)),
    });
  }
  const signalLine = [];
  const k = 2 / 10;
  let signal = macdLine[0]?.value || 0;
  for (let i = 0; i < macdLine.length; i++) {
    signal = i === 0 ? macdLine[i].value : macdLine[i].value * k + signal * (1 - k);
    signalLine.push({ time: macdLine[i].time, value: Number(signal.toFixed(2)) });
  }
  const histogram = macdLine.map((m, i) => ({
    time: m.time,
    value: Number((m.value - signalLine[i].value).toFixed(2)),
  }));
  return { macdLine, signalLine, histogram };
}

export function generateVolume(candles) {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
  }));
}

export function generateAITrend(candles) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    const slice = candles.slice(Math.max(0, i - 20), i + 1);
    const avgClose = slice.reduce((a, c) => a + c.close, 0) / slice.length;
    const momentum = ((candles[i].close - avgClose) / avgClose) * 100;
    const noise = Math.sin(i / 5) * 10;
    const value = Math.max(-100, Math.min(100, momentum * 50 + noise + 20));
    result.push({ time: candles[i].time, value: Number(value.toFixed(2)) });
  }
  return result;
}

export function generateSparkline(points = 20) {
  const result = [];
  let value = 100;
  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.48) * 3;
    result.push(Number(value.toFixed(2)));
  }
  return result;
}
