/**
 * StockOracle Pro — Institutional Screener column groups, cards & presets.
 * All columns map to REAL backend fields (screener_daily_metrics).
 * Missing values render as N/A — never fake.
 */

export const COLUMN_GROUPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'technical', label: 'Technical' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'volume', label: 'Volume' },
  { id: 'fundamental', label: 'Fundamental' },
  { id: 'structure', label: 'Structure' },
  { id: 'ai', label: 'AI' },
  { id: 'sentiment', label: 'Sentiment' },
];

// Column definition: { key, label, group, numeric, format }
// Every key maps to a REAL backend field (screener_daily_metrics).
// Missing values render as N/A — never fake.
export const ALL_COLUMNS = [
  // Overview — the institutional default strip
  { key: 'ticker', label: 'Ticker', group: 'overview', numeric: false },
  { key: 'name', label: 'Company', group: 'overview', numeric: false },
  { key: 'sector', label: 'Sector', group: 'overview', numeric: false },
  { key: 'close_price', label: 'Price ₹', group: 'overview', numeric: true, format: 'inr2' },
  { key: 'change_1d_pct', label: 'Chg %', group: 'overview', numeric: true, format: 'pct' },
  { key: 'market_cap_cr', label: 'MktCap Cr', group: 'overview', numeric: true, format: 'int' },
  { key: 'volume_ratio_20d', label: 'Volume', group: 'overview', numeric: true, format: 'x' },
  { key: 'rsi_14', label: 'RSI', group: 'overview', numeric: true, format: 'dec1' },
  { key: 'ema_alignment', label: 'EMA Trend', group: 'overview', numeric: false },
  { key: 'ai_consensus_score', label: 'AI Score', group: 'overview', numeric: true, format: 'dec1' },
  { key: 'ai_signal', label: 'Signal', group: 'overview', numeric: false },
  // Technical
  { key: 'close_price', label: 'Price ₹', group: 'technical', numeric: true, format: 'inr2' },
  { key: 'rsi_14', label: 'RSI', group: 'technical', numeric: true, format: 'dec1' },
  { key: 'macd_hist', label: 'MACD', group: 'technical', numeric: true, format: 'dec2' },
  { key: 'macd_crossover', label: 'MACD XO', group: 'technical', numeric: false },
  { key: 'adx_14', label: 'ADX', group: 'technical', numeric: true, format: 'dec1' },
  { key: 'ema_20', label: 'EMA 20', group: 'technical', numeric: true, format: 'inr2' },
  { key: 'ema_50', label: 'EMA 50', group: 'technical', numeric: true, format: 'inr2' },
  { key: 'ema_200', label: 'EMA 200', group: 'technical', numeric: true, format: 'inr2' },
  { key: 'ema_alignment', label: 'EMA Trend', group: 'technical', numeric: false },
  { key: 'trend_hint', label: 'Trend', group: 'technical', numeric: false },
  { key: 'atr_pct', label: 'ATR %', group: 'technical', numeric: true, format: 'pct' },
  { key: 'supertrend_dir', label: 'Supertrend', group: 'technical', numeric: false },
  // Momentum
  { key: 'rsi_14', label: 'RSI', group: 'momentum', numeric: true, format: 'dec1' },
  { key: 'stoch_k', label: 'Stoch %K', group: 'momentum', numeric: true, format: 'dec1' },
  { key: 'cci_20', label: 'CCI', group: 'momentum', numeric: true, format: 'dec1' },
  { key: 'roc_12', label: 'ROC %', group: 'momentum', numeric: true, format: 'pct' },
  { key: 'williams_r', label: 'Will %R', group: 'momentum', numeric: true, format: 'dec1' },
  { key: 'momentum_state', label: 'Momentum', group: 'momentum', numeric: false },
  { key: 'rs_vs_nifty_pct', label: 'RS/NIFTY %', group: 'momentum', numeric: true, format: 'pct' },
  { key: 'volume_ratio_20d', label: 'Rel Vol', group: 'momentum', numeric: true, format: 'x' },
  // Volume
  { key: 'close_price', label: 'Price ₹', group: 'volume', numeric: true, format: 'inr2' },
  { key: 'change_1d_pct', label: 'Chg %', group: 'volume', numeric: true, format: 'pct' },
  { key: 'volume_ratio_20d', label: 'Rel Vol', group: 'volume', numeric: true, format: 'x' },
  { key: 'volume_breakout', label: 'Vol Brk', group: 'volume', numeric: false },
  { key: 'pos_52w_pct', label: '52W Pos %', group: 'volume', numeric: true, format: 'pct' },
  { key: 'distance_52w_high_pct', label: 'Dist 52H %', group: 'volume', numeric: true, format: 'pct' },
  // Fundamental (Profit 3Y is the honest stand-in for earnings growth)
  { key: 'market_cap_cr', label: 'MktCap Cr', group: 'fundamental', numeric: true, format: 'int' },
  { key: 'pe_ratio', label: 'P/E', group: 'fundamental', numeric: true, format: 'dec1x' },
  { key: 'pb_ratio', label: 'P/B', group: 'fundamental', numeric: true, format: 'dec1x' },
  { key: 'roe_pct', label: 'ROE %', group: 'fundamental', numeric: true, format: 'pct' },
  { key: 'roce_pct', label: 'ROCE %', group: 'fundamental', numeric: true, format: 'pct' },
  { key: 'profit_growth_3y', label: 'Profit 3Y %', group: 'fundamental', numeric: true, format: 'pct' },
  { key: 'sales_growth_3y', label: 'Sales 3Y %', group: 'fundamental', numeric: true, format: 'pct' },
  { key: 'debt_to_equity', label: 'D/E', group: 'fundamental', numeric: true, format: 'dec2' },
  // Structure
  { key: 'structure_label', label: 'Structure', group: 'structure', numeric: false },
  { key: 'market_regime', label: 'Regime', group: 'structure', numeric: false },
  { key: 'support_price', label: 'Support', group: 'structure', numeric: true, format: 'inr2' },
  { key: 'resistance_price', label: 'Resistance', group: 'structure', numeric: true, format: 'inr2' },
  { key: 'breakout_strength', label: 'Brk Str', group: 'structure', numeric: true, format: 'dec1' },
  { key: 'retest_status', label: 'Retest', group: 'structure', numeric: false },
  { key: 'trend_hint', label: 'Trend', group: 'structure', numeric: false },
  // AI — component scores are the real confluence sub-scores; no MTF field
  // exists backend-side so none is shown (never fabricated).
  { key: 'ai_consensus_score', label: 'AI Score', group: 'ai', numeric: true, format: 'dec1' },
  { key: 'ai_trend_score', label: 'Trend', group: 'ai', numeric: true, format: 'dec1' },
  { key: 'ai_momentum_score', label: 'Momentum', group: 'ai', numeric: true, format: 'dec1' },
  { key: 'ai_pattern_score', label: 'Structure', group: 'ai', numeric: true, format: 'dec1' },
  { key: 'volume_ratio_20d', label: 'Volume', group: 'ai', numeric: true, format: 'x' },
  { key: 'sentiment_label', label: 'Sentiment', group: 'ai', numeric: false },
  { key: 'ai_confidence_score', label: 'Confidence', group: 'ai', numeric: true, format: 'dec1' },
  { key: 'confluence_score', label: 'Confluence', group: 'ai', numeric: true, format: 'dec1' },
  { key: 'ai_signal', label: 'Signal', group: 'ai', numeric: false },
  // Sentiment
  { key: 'sentiment_label', label: 'News Sent', group: 'sentiment', numeric: false },
  { key: 'news_count', label: 'News N', group: 'sentiment', numeric: true, format: 'int' },
  { key: 'ai_consensus_score', label: 'AI Score', group: 'sentiment', numeric: true, format: 'dec1' },
];

export const GROUP_COLUMNS = ALL_COLUMNS.reduce((acc, c) => {
  (acc[c.group] = acc[c.group] || []).push(c.key);
  return acc;
}, {});

export function columnsForGroup(groupId) {
  if (!groupId || groupId === 'all') {
    // Dedupe by key — several columns (price, RSI, …) belong to multiple groups.
    const seen = new Set();
    return ALL_COLUMNS.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
  }
  return ALL_COLUMNS.filter((c) => c.group === groupId);
}

/** Ticker is always first so no tab ever shows anonymous rows. */
export function groupColumnsWithTicker(groupId) {
  const cols = columnsForGroup(groupId);
  if (groupId === 'overview' || cols.some((c) => c.key === 'ticker')) return cols;
  return [{ key: 'ticker', label: 'Ticker', group: groupId, numeric: false }, ...cols];
}

export function formatCell(col, value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const n = Number(value);
  switch (col.format) {
    case 'inr2':
      return isNaN(n) ? 'N/A' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'pct':
      return isNaN(n) ? 'N/A' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    case 'dec1':
      return isNaN(n) ? 'N/A' : n.toFixed(1);
    case 'dec2':
      return isNaN(n) ? 'N/A' : n.toFixed(2);
    case 'dec1x':
      return isNaN(n) ? 'N/A' : `${n.toFixed(1)}x`;
    case 'x':
      return isNaN(n) ? 'N/A' : `${n.toFixed(2)}x`;
    case 'int':
      return isNaN(n) ? 'N/A' : Math.round(n).toLocaleString('en-IN');
    default:
      if (typeof value === 'number') return isNaN(value) ? 'N/A' : String(value);
      return String(value);
  }
}

// Clickable overview cards -> DSL filter applied on click.
export const OVERVIEW_CARDS = [
  { id: 'total', label: 'TOTAL', dsl: null, color: '#818CF8' },
  { id: 'bullish', label: 'BULLISH', dsl: "AIConsensus > 65", color: '#10B981' },
  { id: 'bearish', label: 'BEARISH', dsl: "AIConsensus < 45", color: '#EF4444' },
  { id: 'neutral', label: 'NEUTRAL', dsl: "AIConsensus >= 45 AND AIConsensus <= 65", color: '#F59E0B' },
  { id: 'breakouts', label: 'BREAKOUTS', dsl: "Distance52WHigh > -2", color: '#06B6D4' },
  { id: 'breakdowns', label: 'BREAKDOWNS', dsl: "Distance52WLow < 2", color: '#F43F5E' },
  { id: 'volume_surges', label: 'VOL SURGES', dsl: "VolumeRatio20D > 1.5", color: '#A855F7' },
  { id: 'oversold', label: 'OVERSOLD', dsl: "RSI14 < 35", color: '#38BDF8' },
  { id: 'overbought', label: 'OVERBOUGHT', dsl: "RSI14 > 70", color: '#FB923C' },
  { id: 'high_momentum', label: 'HIGH MOMENTUM', dsl: "RSI14 > 55 AND VolumeRatio20D > 1.2", color: '#34D399' },
  { id: 'ai_high_confidence', label: 'AI HIGH CONF', dsl: "AIConsensus > 80", color: '#F472B6' },
];

// 13 pre-built institutional templates (mirror backend tpl_1..tpl_13).
export const PREBUILT_SCREENS = [
  { id: 'tpl_1', name: 'Undervalued Quality', query: 'ROCE > 20 AND PE < 30 AND DebtToEquity < 0.5' },
  { id: 'tpl_2', name: 'Breakout + Volume', query: 'RSI14 > 55 AND VolumeRatio20D > 1.3 AND Distance52WHigh > -5' },
  { id: 'tpl_3', name: 'High ROCE Low Debt', query: 'ROCE > 25 AND DebtToEquity < 0.2' },
  { id: 'tpl_4', name: 'Oversold Large Caps', query: 'MarketCap > 50000 AND RSI14 < 45' },
  { id: 'tpl_5', name: 'AI High Confidence', query: 'AIConsensus > 80 AND VolumeRatio20D > 1.0' },
  { id: 'tpl_6', name: 'Momentum Stocks', query: 'RSI14 > 55 AND MACDHist > 0 AND VolumeRatio20D > 1.2' },
  { id: 'tpl_7', name: 'Volume Breakouts', query: 'VolumeBreakout > 0 AND RSI14 > 50' },
  { id: 'tpl_8', name: '52-Week High', query: 'Breakout52W > 0 AND VolumeRatio20D > 1.2' },
  { id: 'tpl_9', name: 'Oversold Reversal', query: 'RSI14 < 35 AND DebtToEquity < 1.0' },
  { id: 'tpl_10', name: 'Trend Following', query: "EMAAlignment == 'BULLISH_ALIGNED' AND ADX > 25" },
  { id: 'tpl_11', name: 'High Growth', query: 'SalesGrowth3Y > 15 AND ProfitGrowth3Y > 15 AND ROCE > 15' },
  { id: 'tpl_12', name: 'MACD Crossover', query: 'MACDHist > 0 AND RSI14 > 45 AND RSI14 < 70' },
  { id: 'tpl_13', name: 'AI High Confluence', query: 'Confluence > 70 AND AIConsensus > 70' },
];

export const RANK_OPTIONS = [
  { id: 'ai_consensus_score', label: 'AI Score' },
  { id: 'confluence_score', label: 'Technical Score' },
  { id: 'rsi_14', label: 'Momentum (RSI)' },
  { id: 'rs_vs_nifty_pct', label: 'Relative Strength' },
  { id: 'volume_ratio_20d', label: 'Volume' },
  { id: 'roce_pct', label: 'Fundamental (ROCE)' },
];

export const REFRESH_OPTIONS = [
  { id: 'realtime', label: 'Realtime' },
  { id: '5s', label: '5 sec' },
  { id: '10s', label: '10 sec' },
  { id: '30s', label: '30 sec' },
  { id: '1m', label: '1 min' },
  { id: 'manual', label: 'Manual' },
];
