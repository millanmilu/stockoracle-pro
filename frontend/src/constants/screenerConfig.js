/**
 * StockOracle Pro - Screener Configuration & Constants
 * Defines universes, sectors, presets, technical thresholds, and pagination options.
 */

export const UNIVERSES = [
  { id: 'NIFTY 50', label: '🏢 Nifty 50 (50 Stocks)', count: 50, icon: '🏢' },
  { id: 'BANK NIFTY', label: '🏦 Bank Nifty (12 Banks)', count: 12, icon: '🏦' },
  { id: 'NIFTY IT', label: '💻 Nifty IT (10 Stocks)', count: 10, icon: '💻' },
  { id: 'NIFTY AUTO', label: '🚗 Nifty Auto (10 Stocks)', count: 10, icon: '🚗' },
  { id: 'NIFTY PHARMA', label: '💊 Nifty Pharma (10 Stocks)', count: 10, icon: '💊' },
  { id: 'NIFTY 100', label: '🌟 Nifty 100 (100 Stocks)', count: 100, icon: '🌟' },
];

export const INDEX_CONSTITUENTS = {
  'NIFTY 50': [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'HUL',
    'TATAMOTORS', 'MARUTI', 'AXISBANK', 'WIPRO', 'HCLTECH', 'SUNPHARMA', 'BAJFINANCE', 'KOTAKBANK',
    'TATASTEEL', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA', 'TITAN', 'ULTRACEMCO', 'ADANIENT',
    'JSWSTEEL', 'HDFCLIFE', 'BPCL', 'HEROMOTOCO', 'BAJAJFINSV', 'INDUSINDBK', 'NESTLEIND', 'HINDALCO',
    'GRASIM', 'TECHM', 'CIPLA', 'EICHERMOT', 'DIVISLAB', 'BRITANNIA', 'TATACONSUM', 'APOLLOHOSP',
    'DRREDDY', 'ADANIPORTS', 'SBILIFE', 'LTIM', 'BEL', 'SHRIRAMFIN', 'ASIANPAINT', 'M&M'
  ],
  'BANK NIFTY': [
    'HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK',
    'PNB', 'BANKBARODA', 'FEDERALBNK', 'IDFCFIRSTB', 'AUBANK', 'BANDHANBNK'
  ],
  'NIFTY IT': [
    'TCS', 'INFY', 'HCLTECH', 'WIPRO', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'LTTS', 'MPHASIS'
  ],
  'NIFTY AUTO': [
    'TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'EICHERMOT', 'HEROMOTOCO',
    'TVSMOTOR', 'BHARATFORG', 'ASHOKLEY', 'MOTHERSON'
  ],
  'NIFTY PHARMA': [
    'SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'APOLLOHOSP', 'LUPIN',
    'AUROPHARMA', 'TORNTPHARM', 'ZYDUSLIFE', 'BIOCON'
  ],
  'NIFTY 100': [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'HUL',
    'TATAMOTORS', 'MARUTI', 'AXISBANK', 'WIPRO', 'HCLTECH', 'SUNPHARMA', 'BAJFINANCE', 'KOTAKBANK',
    'TATASTEEL', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA', 'TITAN', 'ULTRACEMCO', 'ADANIENT',
    'JSWSTEEL', 'HDFCLIFE', 'BPCL', 'HEROMOTOCO', 'BAJAJFINSV', 'INDUSINDBK', 'NESTLEIND', 'HINDALCO',
    'GRASIM', 'TECHM', 'CIPLA', 'EICHERMOT', 'DIVISLAB', 'BRITANNIA', 'TATACONSUM', 'APOLLOHOSP',
    'DRREDDY', 'ADANIPORTS', 'SBILIFE', 'LTIM', 'BEL', 'SHRIRAMFIN', 'ASIANPAINT', 'M&M',
    'PNB', 'BANKBARODA', 'FEDERALBNK', 'IDFCFIRSTB', 'AUBANK', 'BANDHANBNK',
    'PERSISTENT', 'COFORGE', 'LTTS', 'MPHASIS', 'BAJAJ-AUTO', 'TVSMOTOR', 'BHARATFORG', 'ASHOKLEY',
    'LUPIN', 'AUROPHARMA', 'TORNTPHARM', 'ZYDUSLIFE', 'BIOCON', 'HAL', 'VEDL', 'IOC', 'GAIL',
    'CHOLAFIN', 'HAVELLS', 'PIDILITIND', 'DABUR', 'GODREJCP', 'MARICO', 'SIEMENS', 'ABB', 'DLF',
    'AMBUJACEM', 'TRENT', 'ZOMATO', 'JIOFIN', 'CANBK', 'UNIONBANK', 'IRFC', 'PFC', 'RECLTD'
  ]
};

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
  'Consumer',
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
    description: 'All stocks in selected universe',
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
    description: 'Trading within 5% of 52-Week High with RSI > 55',
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
  universe: 'NIFTY 50',
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
