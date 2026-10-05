// Pro Terminal V2 — Constants
// All values are local to the experimental module. No external imports.

export const V2_COLORS = {
  bg: {
    primary: '#0B0E14',
    secondary: '#11151D',
    tertiary: '#161B26',
    elevated: '#1C2230',
    hover: '#222836',
    active: '#2A3142',
    border: '#1E2532',
    borderLight: '#2A3142',
  },
  text: {
    primary: '#E8EAF0',
    secondary: '#9CA3AF',
    muted: '#6B7280',
    disabled: '#4B5563',
  },
  accent: {
    primary: '#3B82F6',
    secondary: '#6366F1',
    purple: '#8B5CF6',
    cyan: '#06B6D4',
  },
  positive: '#10B981',
  negative: '#EF4444',
  warning: '#F59E0B',
  neutral: '#6B7280',
};

export const V2_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const V2_RADIUS = {
  sm: 3,
  md: 5,
  lg: 8,
};

export const V2_FONT = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  size: {
    xs: 10,
    sm: 11,
    md: 12,
    lg: 13,
    xl: 15,
    xxl: 18,
  },
};

export const V2_INTERVALS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
];

export const V2_CHART_TYPES = [
  { label: 'Candles', value: 'candlestick' },
  { label: 'Line', value: 'line' },
  { label: 'Area', value: 'area' },
  { label: 'Bars', value: 'bar' },
];

export const V2_KEYBOARD_SHORTCUTS = {
  SEARCH: 'Ctrl+K',
  SAVE: 'Ctrl+S',
  INDICATORS: 'Alt+I',
  AI_INDICATORS: 'Alt+A',
  UNDO: 'Ctrl+Z',
  CLOSE: 'Escape',
};

/** Indicator presets applied from the toolbar Templates menu. */
export const V2_TEMPLATES = [
  { id: 'Default', indicators: ['ema_20', 'ema_50', 'ema_200', 'volume', 'rsi', 'macd'], ai: ['ai_sr'] },
  { id: 'Trend Following', indicators: ['ema_20', 'ema_50', 'ema_200', 'volume'], ai: [] },
  { id: 'Momentum', indicators: ['ema_20', 'ema_50', 'volume', 'rsi', 'macd'], ai: ['ai_momentum'] },
  { id: 'Mean Reversion', indicators: ['ema_200', 'volume', 'rsi'], ai: ['ai_sr'] },
  { id: 'Breakout', indicators: ['ema_20', 'ema_50', 'ema_200', 'volume', 'macd'], ai: ['ai_breakout', 'ai_forecast'] },
];

/** Drawing tools that commit immediately on the first click. */
export const V2_INSTANT_DRAWING_TOOLS = [
  'horizontal_line', 'vertical_line', 'text', 'callout', 'price_label',
];

export const V2_INDICATORS = [
  { id: 'ema_20', name: 'EMA 20', shortName: 'EMA20', color: '#06B6D4', type: 'overlay', defaultVisible: true },
  { id: 'ema_50', name: 'EMA 50', shortName: 'EMA50', color: '#F97316', type: 'overlay', defaultVisible: true },
  { id: 'ema_200', name: 'EMA 200', shortName: 'EMA200', color: '#A855F7', type: 'overlay', defaultVisible: true },
  { id: 'volume', name: 'Volume', shortName: 'VOL', color: '#6366F1', type: 'pane', defaultVisible: true },
  { id: 'rsi', name: 'RSI', shortName: 'RSI', color: '#F59E0B', type: 'pane', defaultVisible: true },
  { id: 'macd', name: 'MACD', shortName: 'MACD', color: '#3B82F6', type: 'pane', defaultVisible: true },
  { id: 'ai_trend', name: 'AI Trend', shortName: 'AI', color: '#10B981', type: 'pane', defaultVisible: false },
];

export const V2_AI_INDICATORS = [
  { id: 'ai_trend', name: 'AI Trend', shortName: 'AI Trend' },
  { id: 'ai_momentum', name: 'AI Momentum', shortName: 'AI Mom' },
  { id: 'ai_sr', name: 'AI Support/Resistance', shortName: 'AI S/R' },
  { id: 'ai_breakout', name: 'AI Breakout', shortName: 'AI BRK' },
  { id: 'ai_pattern', name: 'AI Pattern Detection', shortName: 'AI Pat' },
  { id: 'ai_forecast', name: 'AI Forecast', shortName: 'AI Fcst' },
];

export const V2_DRAWING_TOOLS = [
  {
    id: 'cursor',
    label: 'Cursor',
    icon: 'cursor',
    category: 'tools',
  },
  {
    id: 'lines',
    label: 'Lines',
    icon: 'line',
    category: 'group',
    children: [
      { id: 'trend_line', label: 'Trend Line', icon: 'trend' },
      { id: 'ray', label: 'Ray', icon: 'ray' },
      { id: 'horizontal_line', label: 'Horizontal Line', icon: 'horizontal' },
      { id: 'vertical_line', label: 'Vertical Line', icon: 'vertical' },
      { id: 'parallel_channel', label: 'Parallel Channel', icon: 'channel' },
      { id: 'regression_trend', label: 'Regression Trend', icon: 'regression' },
      { id: 'info_line', label: 'Info Line', icon: 'info' },
    ],
  },
  {
    id: 'fibonacci',
    label: 'Fibonacci',
    icon: 'fib',
    category: 'group',
    children: [
      { id: 'fib_retracement', label: 'Retracement', icon: 'fib_retr' },
      { id: 'fib_extension', label: 'Extension', icon: 'fib_ext' },
      { id: 'fib_fan', label: 'Fan', icon: 'fib_fan' },
      { id: 'fib_channel', label: 'Channel', icon: 'fib_chan' },
    ],
  },
  {
    id: 'patterns',
    label: 'Patterns',
    icon: 'pattern',
    category: 'group',
    children: [
      { id: 'head_shoulders', label: 'Head & Shoulders', icon: 'hs' },
      { id: 'double_top', label: 'Double Top', icon: 'dt' },
      { id: 'double_bottom', label: 'Double Bottom', icon: 'db' },
      { id: 'triangle', label: 'Triangle', icon: 'tri' },
      { id: 'wedge', label: 'Wedge', icon: 'wedge' },
      { id: 'flag', label: 'Flag', icon: 'flag' },
    ],
  },
  {
    id: 'shapes',
    label: 'Shapes',
    icon: 'shape',
    category: 'group',
    children: [
      { id: 'rectangle', label: 'Rectangle', icon: 'rect' },
      { id: 'circle', label: 'Circle', icon: 'circle' },
      { id: 'ellipse', label: 'Ellipse', icon: 'ellipse' },
      { id: 'triangle_shape', label: 'Triangle', icon: 'tri_shape' },
    ],
  },
  {
    id: 'annotations',
    label: 'Annotations',
    icon: 'annotation',
    category: 'group',
    children: [
      { id: 'text', label: 'Text', icon: 'text' },
      { id: 'arrow', label: 'Arrow', icon: 'arrow' },
      { id: 'callout', label: 'Callout', icon: 'callout' },
      { id: 'price_label', label: 'Price Label', icon: 'price_label' },
    ],
  },
  {
    id: 'measure',
    label: 'Measure',
    icon: 'measure',
    category: 'tools',
  },
  {
    id: 'magnet',
    label: 'Magnet',
    icon: 'magnet',
    category: 'tools',
  },
  {
    id: 'lock',
    label: 'Lock',
    icon: 'lock',
    category: 'tools',
  },
  {
    id: 'hide',
    label: 'Hide',
    icon: 'hide',
    category: 'tools',
  },
  {
    id: 'remove',
    label: 'Remove',
    icon: 'remove',
    category: 'tools',
  },
];

/** Flatten every drawing tool (groups + children) into an id → label lookup. */
const DRAWING_TOOL_LABELS = V2_DRAWING_TOOLS.reduce((acc, tool) => {
  acc[tool.id] = tool.label;
  (tool.children || []).forEach((child) => { acc[child.id] = child.label; });
  return acc;
}, {});

export function getDrawingToolLabel(id) {
  return DRAWING_TOOL_LABELS[id] || id;
}

/**
 * How many anchors each drawing tool needs before it can be committed.
 * 1 = single click (price/time level), 2 = click-drag / click-click.
 * Tools missing here default to 2 anchors.
 */
export const V2_DRAWING_POINT_COUNT = {
  horizontal_line: 1,
  vertical_line: 1,
  text: 1,
  callout: 1,
  price_label: 1,
};

export const V2_BOTTOM_TABS = [
  { id: 'overview', label: 'Market Overview' },
  { id: 'screener', label: 'Stock Screener' },
  { id: 'financials', label: 'Financials' },
  { id: 'technicals', label: 'Technicals' },
  { id: 'ai_analysis', label: 'AI Analysis' },
  { id: 'peers', label: 'Peer Comparison' },
  { id: 'shareholding', label: 'Shareholding' },
  { id: 'corporate_actions', label: 'Corporate Actions' },
  { id: 'historical', label: 'Historical Data' },
  { id: 'news', label: 'News & Sentiment' },
  { id: 'options', label: 'Options Chain' },
];

export const V2_SCREENER_COLUMNS = [
  { id: 'rank', label: '#', width: 40, pinned: true },
  { id: 'symbol', label: 'Symbol', width: 120, pinned: true, sortable: true },
  { id: 'ltp', label: 'LTP', width: 100, sortable: true },
  { id: 'change', label: '% Change', width: 90, sortable: true },
  { id: 'marketCap', label: 'Market Cap', width: 110, sortable: true },
  { id: 'pe', label: 'P/E', width: 70, sortable: true },
  { id: 'roe', label: 'ROE', width: 70, sortable: true },
  { id: 'roce', label: 'ROCE', width: 70, sortable: true },
  { id: 'debtEquity', label: 'Debt/Equity', width: 90, sortable: true },
  { id: 'rsi', label: 'RSI', width: 60, sortable: true },
  { id: 'aboveEma200', label: 'Close > EMA200', width: 110, sortable: true },
];
