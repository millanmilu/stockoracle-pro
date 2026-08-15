/**
 * StockOracle Pro - Screener Configuration & Constants
 * Defines sectors, presets, technical thresholds, and pagination options.
 */

export const SECTORS = [
  'All',
  'Banking',
  'IT',
  'Energy',
  'FMCG',
  'Telecom',
  'Infrastructure',
  'Auto',
  'Pharma',
  'Metals',
  'Other'
];

export const SIGNALS = [
  'All',
  'buy',
  'hold',
  'sell'
];

export const THRESHOLDS = {
  RSI_OVERSOLD: 38,
  RSI_OVERBOUGHT: 70,
  RSI_BULLISH_MIN: 50,
  RSI_MOMENTUM_MIN: 55,
  VOLUME_SURGE_RATIO: 1.5,
  AI_SCORE_HIGH: 70,
  AI_SCORE_MEDIUM: 50,
  AI_SCORE_LOW: 40,
  AI_SCORE_BULLISH_MIN: 50,
};

export const PRESETS = [
  { 
    id: 'all', 
    label: 'All Stocks', 
    icon: '🌐',
    description: 'All 30+ tracked Nifty / Largecap stocks',
    filter: {
      signal: 'All',
      minRsi: 0,
      maxRsi: 100,
      volumeSpike: false,
      near52High: false,
      near52Low: false,
      minScore: 0
    }
  },
  { 
    id: 'bullish', 
    label: '🚀 Bullish Breakout', 
    icon: '🚀',
    description: 'Buy signal + RSI > 50 + Volume surge + AI Score > 50',
    filter: {
      signal: 'buy',
      minRsi: THRESHOLDS.RSI_BULLISH_MIN,
      maxRsi: 100,
      volumeSpike: true,
      near52High: false,
      near52Low: false,
      minScore: THRESHOLDS.AI_SCORE_BULLISH_MIN
    }
  },
  { 
    id: 'oversold', 
    label: '💎 Oversold Bargains', 
    icon: '💎',
    description: 'RSI < 38 with strong fundamentals and AI Score > 40',
    filter: {
      signal: 'All',
      minRsi: 0,
      maxRsi: THRESHOLDS.RSI_OVERSOLD,
      volumeSpike: false,
      near52High: false,
      near52Low: false,
      minScore: THRESHOLDS.AI_SCORE_LOW
    }
  },
  { 
    id: 'volume', 
    label: '🔥 Volume Surge', 
    icon: '🔥',
    description: 'Abnormal volume >= 1.5x of 20-day average',
    filter: {
      signal: 'All',
      minRsi: 0,
      maxRsi: 100,
      volumeSpike: true,
      near52High: false,
      near52Low: false,
      minScore: 0
    }
  },
  { 
    id: 'momentum', 
    label: '🎯 52W High Momentum', 
    icon: '🎯',
    description: 'Trading within 3% of 52-Week High with RSI > 55',
    filter: {
      signal: 'All',
      minRsi: THRESHOLDS.RSI_MOMENTUM_MIN,
      maxRsi: 100,
      volumeSpike: false,
      near52High: true,
      near52Low: false,
      minScore: 0
    }
  },
];

export const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

export const DEFAULT_PAGE_SIZE = 25;

export const DEFAULT_FILTERS = {
  preset: 'all',
  sector: 'All',
  signal: 'All',
  minRsi: 0,
  maxRsi: 100,
  volumeSpike: false,
  near52High: false,
  near52Low: false,
  minScore: 0,
  search: '',
  sortBy: 'ai_score',
  sortDir: 'desc',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE
};
