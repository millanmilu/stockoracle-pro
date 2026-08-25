/**
 * StockOracle Pro - Comprehensive Master Screener Configuration
 * Defines full NSE Stock Universe (500+ stocks), all sectoral & thematic indices, presets, and filters.
 */

export const UNIVERSES = [
  { id: 'ALL NSE', label: '🌐 All NSE Stocks (500+)', count: 500, icon: '🌐' },
  { id: 'NIFTY 500', label: '📊 Nifty 500', count: 500, icon: '📊' },
  { id: 'NIFTY 200', label: '📈 Nifty 200', count: 200, icon: '📈' },
  { id: 'NIFTY 100', label: '🌟 Nifty 100', count: 100, icon: '🌟' },
  { id: 'NIFTY 50', label: '🏢 Nifty 50', count: 50, icon: '🏢' },
  { id: 'NIFTY MIDCAP', label: '🚀 Midcap 150', count: 150, icon: '🚀' },
  { id: 'NIFTY SMALLCAP', label: '⚡ Smallcap 250', count: 250, icon: '⚡' },
  { id: 'BANK NIFTY', label: '🏦 Bank Nifty', count: 12, icon: '🏦' },
  { id: 'NIFTY PSU BANK', label: '🏛️ PSU Banks', count: 12, icon: '🏛️' },
  { id: 'NIFTY IT', label: '💻 Nifty IT', count: 16, icon: '💻' },
  { id: 'NIFTY AUTO', label: '🚗 Nifty Auto', count: 15, icon: '🚗' },
  { id: 'NIFTY PHARMA', label: '💊 Nifty Pharma', count: 20, icon: '💊' },
  { id: 'NIFTY FMCG', label: '🛒 Nifty FMCG', count: 15, icon: '🛒' },
  { id: 'NIFTY METAL', label: '⚙️ Nifty Metal', count: 15, icon: '⚙️' },
  { id: 'NIFTY ENERGY', label: '⚡ Nifty Energy', count: 15, icon: '⚡' },
  { id: 'NIFTY INFRA', label: '🏗️ Nifty Infra', count: 20, icon: '🏗️' },
  { id: 'NIFTY REALTY', label: '🏠 Nifty Realty', count: 10, icon: '🏠' },
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
  'NIFTY PSU BANK': [
    'SBIN', 'PNB', 'BANKBARODA', 'CANBK', 'UNIONBANK', 'IOB', 'INDIANB', 'UCOBANK',
    'BANKINDIA', 'CENTRALBK', 'PSB', 'MAHABANK'
  ],
  'NIFTY IT': [
    'TCS', 'INFY', 'HCLTECH', 'WIPRO', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'LTTS', 'MPHASIS',
    'TATAELXSI', 'KPITTECH', 'CYIENT', 'SONACOMS', 'ZENSARTECH', 'BSOFT'
  ],
  'NIFTY AUTO': [
    'TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'EICHERMOT', 'HEROMOTOCO',
    'TVSMOTOR', 'BHARATFORG', 'ASHOKLEY', 'MOTHERSON', 'MRF', 'BALKRISIND', 'BOSCHLTD', 'APOLLOTYRE', 'EXIDEIND'
  ],
  'NIFTY PHARMA': [
    'SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'APOLLOHOSP', 'LUPIN',
    'AUROPHARMA', 'TORNTPHARM', 'ZYDUSLIFE', 'BIOCON', 'MANKIND', 'ALKEM', 'GLENMARK', 'ABBOTINDIA', 'IPCALAB',
    'LAURUSLABS', 'NATCOPHARM', 'SYNGENE', 'GRANULES', 'AJANTPHARM'
  ],
  'NIFTY FMCG': [
    'ITC', 'HUL', 'NESTLEIND', 'BRITANNIA', 'TATACONSUM', 'DABUR', 'GODREJCP', 'MARICO',
    'COLPAL', 'VBL', 'PGHH', 'EMAMILTD', 'RADICO', 'UBL', 'BALRAMCHIN'
  ],
  'NIFTY METAL': [
    'TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'JINDALSTEL', 'SAIL', 'NMDC', 'NATIONALUM',
    'HINDZINC', 'APLAPOLLO', 'RATNAMANI', 'WELCORP', 'HINDCOPPER', 'JSL'
  ],
  'NIFTY ENERGY': [
    'RELIANCE', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA', 'BPCL', 'IOC', 'GAIL',
    'TATAPOWER', 'ADANIGREEN', 'ADANIPOWER', 'ADANITRANS', 'NHPC', 'SJVN', 'OIL'
  ],
  'NIFTY INFRA': [
    'LT', 'ULTRACEMCO', 'ADANIENT', 'ADANIPORTS', 'GRASIM', 'SIEMENS', 'ABB', 'DLF', 'AMBUJACEM',
    'BEL', 'HAL', 'GMRINFRA', 'BHEL', 'CONCOR', 'IRCTC', 'RVNL', 'IRCON', 'NBCC', 'VOLTAS', 'HAVELLS'
  ],
  'NIFTY REALTY': [
    'DLF', 'GODREJPROP', 'LODHA', 'OBEROIRLTY', 'PHOENIXLTD', 'BRIGADE', 'PRESTIGE', 'SOBHA', 'SUNTECK', 'MAHLIFE'
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
    'AMBUJACEM', 'TRENT', 'ZOMATO', 'JIOFIN', 'CANBK', 'UNIONBANK', 'IRFC', 'PFC', 'RECLTD',
    'TATAPOWER', 'ADANIGREEN', 'ADANIPOWER', 'VBL', 'POLYCAB', 'JINDALSTEL', 'MANKIND', 'BOSCHLTD',
    'CGPOWER', 'MAXHEALTH', 'SOLARINDS', 'TORNTPHARM'
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
  'Realty',
  'Finance',
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
      minScore: 0,
    }
  },
  { 
    id: 'strong_buy', 
    label: 'Strong Buy AI', 
    icon: '🎯',
    description: 'AI Buy signal + High Confidence Score (>=65)',
    filter: {
      signal: 'buy',
      minRsi: 0,
      maxRsi: 75,
      volumeSpike: false,
      near52High: false,
      near52Low: false,
      minScore: 65,
    }
  },
  { 
    id: 'oversold_bounce', 
    label: 'Oversold Dip', 
    icon: '📉',
    description: 'RSI <= 38 + Mean Reversion Setup',
    filter: {
      signal: 'All',
      minRsi: 0,
      maxRsi: 38,
      volumeSpike: false,
      near52High: false,
      near52Low: false,
      minScore: 0,
    }
  },
  { 
    id: 'momentum_breakout', 
    label: 'Momentum Breakout', 
    icon: '🚀',
    description: 'Volume Spike + Near 52W High + Bullish Signal',
    filter: {
      signal: 'buy',
      minRsi: 55,
      maxRsi: 100,
      volumeSpike: true,
      near52High: true,
      near52Low: false,
      minScore: 50,
    }
  },
  { 
    id: 'volume_surge', 
    label: 'Volume Surge (>1.5x)', 
    icon: '⚡',
    description: 'Institutional volume spike > 1.5x 20-day avg',
    filter: {
      signal: 'All',
      minRsi: 0,
      maxRsi: 100,
      volumeSpike: true,
      near52High: false,
      near52Low: false,
      minScore: 0,
    }
  },
  { 
    id: '52w_high', 
    label: 'Near 52W High', 
    icon: '🏆',
    description: 'Trading within 5% of 52-week peak',
    filter: {
      signal: 'All',
      minRsi: 0,
      maxRsi: 100,
      volumeSpike: false,
      near52High: true,
      near52Low: false,
      minScore: 0,
    }
  },
];

export const DEFAULT_FILTERS = {
  universe: 'ALL NSE',
  preset: 'all',
  sector: 'All',
  signal: 'All',
  minRsi: 0,
  maxRsi: 100,
  volumeSpike: false,
  near52High: false,
  near52Low: false,
  minScore: 0,
  sortBy: 'ai_score',
  sortDir: 'desc',
  search: '',
  page: 1,
  pageSize: 25
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [15, 25, 50, 100, 200];
