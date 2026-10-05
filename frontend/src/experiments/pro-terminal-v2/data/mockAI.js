// Pro Terminal V2 — Mock AI Analysis Data

export const mockAIAnalysis = {
  RELIANCE: {
    direction: 'Bullish',
    confidence: 78,
    trend: 78,
    momentum: 72,
    breakout: 68,
    volatility: 55,
    volume: 65,
    structure: 70,
    regime: 'TREND',
    regimeConfidence: 72,
    pattern: 'Ascending Triangle',
    patternCompletion: 65,
    support: 2820,
    resistance: 2920,
    target: 2980,
    stopLoss: 2780,
    riskReward: 2.1,
    signals: [
      { name: 'EMA Stack', value: 'Bullish', weight: 0.15 },
      { name: 'RSI', value: 'Neutral', weight: 0.10 },
      { name: 'MACD', value: 'Bullish', weight: 0.15 },
      { name: 'Stochastic', value: 'Overbought', weight: 0.08 },
      { name: 'ADX', value: 'Strong Trend', weight: 0.12 },
      { name: 'Volume', value: 'Above Average', weight: 0.10 },
      { name: 'Bollinger', value: 'Upper Band', weight: 0.08 },
      { name: 'CCI', value: 'Bullish', weight: 0.07 },
      { name: 'MFI', value: 'Neutral', weight: 0.08 },
      { name: 'BOS/CHoCH', value: 'Bullish', weight: 0.07 },
    ],
  },
  TCS: {
    direction: 'Bullish',
    confidence: 82,
    trend: 82,
    momentum: 78,
    breakout: 72,
    volatility: 48,
    volume: 70,
    structure: 75,
    regime: 'TREND',
    regimeConfidence: 80,
    pattern: 'Bull Flag',
    patternCompletion: 72,
    support: 3780,
    resistance: 3920,
    target: 4050,
    stopLoss: 3720,
    riskReward: 2.4,
    signals: [
      { name: 'EMA Stack', value: 'Bullish', weight: 0.15 },
      { name: 'RSI', value: 'Bullish', weight: 0.10 },
      { name: 'MACD', value: 'Bullish', weight: 0.15 },
      { name: 'Stochastic', value: 'Neutral', weight: 0.08 },
      { name: 'ADX', value: 'Strong Trend', weight: 0.12 },
      { name: 'Volume', value: 'Above Average', weight: 0.10 },
      { name: 'Bollinger', value: 'Middle Band', weight: 0.08 },
      { name: 'CCI', value: 'Bullish', weight: 0.07 },
      { name: 'MFI', value: 'Bullish', weight: 0.08 },
      { name: 'BOS/CHoCH', value: 'Bullish', weight: 0.07 },
    ],
  },
  HDFCBANK: {
    direction: 'Neutral',
    confidence: 55,
    trend: 55,
    momentum: 48,
    breakout: 42,
    volatility: 38,
    volume: 52,
    structure: 58,
    regime: 'RANGE',
    regimeConfidence: 60,
    pattern: 'None',
    patternCompletion: 0,
    support: 1620,
    resistance: 1680,
    target: 1720,
    stopLoss: 1590,
    riskReward: 1.4,
    signals: [
      { name: 'EMA Stack', value: 'Neutral', weight: 0.15 },
      { name: 'RSI', value: 'Neutral', weight: 0.10 },
      { name: 'MACD', value: 'Neutral', weight: 0.15 },
      { name: 'Stochastic', value: 'Neutral', weight: 0.08 },
      { name: 'ADX', value: 'Weak Trend', weight: 0.12 },
      { name: 'Volume', value: 'Average', weight: 0.10 },
      { name: 'Bollinger', value: 'Middle Band', weight: 0.08 },
      { name: 'CCI', value: 'Neutral', weight: 0.07 },
      { name: 'MFI', value: 'Neutral', weight: 0.08 },
      { name: 'BOS/CHoCH', value: 'Neutral', weight: 0.07 },
    ],
  },
};

/**
 * Derives a plausible AI analysis for symbols without a hand-written mock.
 * Levels come from real recent candle data so S/R/target always sit around
 * the CURRENT price instead of RELIANCE's hardcoded 2820/2920.
 */
export function synthesizeAIAnalysis(candles, changePct = 0) {
  const recent = candles.slice(-50);
  const support = recent.length ? Math.min(...recent.map((c) => c.low)) : 0;
  const resistance = recent.length ? Math.max(...recent.map((c) => c.high)) : 0;
  const price = candles[candles.length - 1]?.close || 0;
  const bullish = changePct >= 0;
  const target = bullish ? resistance + (resistance - support) * 0.25 : support - (resistance - support) * 0.25;
  const stopLoss = bullish ? support : resistance;
  const risk = Math.abs(price - stopLoss) || 1;
  const reward = Math.abs(target - price);
  return {
    direction: bullish ? 'Bullish' : 'Bearish',
    confidence: Math.min(85, Math.max(45, Math.round(55 + Math.abs(changePct) * 8))),
    trend: Math.min(90, Math.max(30, Math.round(50 + changePct * 10))),
    momentum: Math.min(90, Math.max(30, Math.round(50 + changePct * 12))),
    breakout: 60,
    volatility: 50,
    volume: 58,
    structure: 62,
    regime: Math.abs(changePct) > 1 ? 'TREND' : 'RANGE',
    regimeConfidence: 60,
    pattern: 'None',
    patternCompletion: 0,
    support: Number(support.toFixed(2)),
    resistance: Number(resistance.toFixed(2)),
    target: Number(target.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    riskReward: Number((reward / risk).toFixed(1)),
    signals: [],
  };
}

export const mockAIForecast = {
  RELIANCE: {
    median: [2874, 2885, 2898, 2910, 2925, 2940, 2955],
    upper: [2874, 2895, 2920, 2945, 2970, 2995, 3020],
    lower: [2874, 2875, 2876, 2875, 2880, 2885, 2890],
    confidence: 78,
    horizon: '7 days',
  },
};

export const mockMarketIndices = [
  { name: 'NIFTY 50', value: 24852.35, change: 185.45, changePct: 0.75, sparkline: [24700, 24720, 24750, 24780, 24800, 24820, 24852] },
  { name: 'SENSEX', value: 81452.80, change: 612.30, changePct: 0.76, sparkline: [81000, 81100, 81200, 81300, 81350, 81400, 81452] },
  { name: 'BANKNIFTY', value: 51245.60, change: -125.40, changePct: -0.24, sparkline: [51400, 51380, 51350, 51320, 51300, 51280, 51245] },
  { name: 'FINNIFTY', value: 23456.75, change: 98.25, changePct: 0.42, sparkline: [23380, 23400, 23420, 23430, 23440, 23450, 23456] },
];

export const mockSectors = [
  { name: 'IT', change: 1.85, marketCap: '12.5 LCr' },
  { name: 'Banking', change: 0.92, marketCap: '18.2 LCr' },
  { name: 'Oil & Gas', change: -0.45, marketCap: '8.9 LCr' },
  { name: 'Auto', change: 1.25, marketCap: '6.8 LCr' },
  { name: 'Pharma', change: 0.68, marketCap: '5.2 LCr' },
  { name: 'FMCG', change: -0.15, marketCap: '4.8 LCr' },
  { name: 'Metal', change: 2.15, marketCap: '3.9 LCr' },
  { name: 'Realty', change: -0.85, marketCap: '2.1 LCr' },
];
