/**
 * Color and formatting utilities for StockOracle Pro Market Heatmap
 */

export function getStockColor(metric, value) {
  const val = typeof value === 'number' ? value : 0.0;

  // 1. Return Metrics: 1D, 1W, 1M, 1Y
  if (['change_1d_pct', 'change_1w_pct', 'change_1m_pct', 'change_1y_pct'].includes(metric)) {
    if (val >= 3.0)  return { bg: '#064e3b', text: '#34d399', border: '#10B981', glow: 'rgba(16, 185, 129, 0.4)' };
    if (val >= 1.5)  return { bg: '#065f46', text: '#6ee7b7', border: '#34D399', glow: 'rgba(52, 211, 153, 0.3)' };
    if (val >= 0.5)  return { bg: '#064e3b90', text: '#a7f3d0', border: '#10B98160', glow: 'none' };
    if (val >= 0.0)  return { bg: '#022c22', text: '#6ee7b7', border: '#10B98130', glow: 'none' };
    if (val >= -0.5) return { bg: '#3f0a0a', text: '#fca5a5', border: '#F43F5E30', glow: 'none' };
    if (val >= -1.5) return { bg: '#5f1212', text: '#fca5a5', border: '#F43F5E60', glow: 'none' };
    if (val >= -3.0) return { bg: '#7f1d1d', text: '#f87171', border: '#F43F5E', glow: 'rgba(244, 63, 94, 0.3)' };
    return { bg: '#450a0a', text: '#ef4444', border: '#F43F5E', glow: 'rgba(244, 63, 94, 0.5)' };
  }

  // 2. RSI (14)
  if (metric === 'rsi_14') {
    if (val >= 70) return { bg: '#4c1d95', text: '#c084fc', border: '#A855F7', glow: 'rgba(168, 85, 247, 0.4)', badge: 'OVERBOUGHT' };
    if (val >= 60) return { bg: '#065f46', text: '#34d399', border: '#10B981', glow: 'none', badge: 'BULLISH' };
    if (val >= 40) return { bg: '#1e1b4b', text: '#93c5fd', border: '#3B82F6', glow: 'none', badge: 'NEUTRAL' };
    if (val >= 30) return { bg: '#78350f', text: '#fcd34d', border: '#F59E0B', glow: 'none', badge: 'WEAK' };
    return { bg: '#0c4a6e', text: '#38bdf8', border: '#06B6D4', glow: 'rgba(6, 182, 212, 0.4)', badge: 'OVERSOLD' };
  }

  // 3. Volume Surge (20D)
  if (metric === 'volume_ratio_20d') {
    if (val >= 3.0) return { bg: '#7c2d12', text: '#fb923c', border: '#F97316', glow: 'rgba(249, 115, 22, 0.4)', badge: 'SUPER SURGE' };
    if (val >= 1.5) return { bg: '#065f46', text: '#34d399', border: '#10B981', glow: 'rgba(16, 185, 129, 0.3)', badge: 'HIGH VOL' };
    if (val >= 0.8) return { bg: '#1e293b', text: '#94a3b8', border: '#475569', glow: 'none', badge: 'NORMAL' };
    return { bg: '#0f172a', text: '#64748b', border: '#334155', glow: 'none', badge: 'LOW VOL' };
  }

  // 4. P/E Ratio
  if (metric === 'pe_ratio') {
    if (val <= 15.0 && val > 0) return { bg: '#065f46', text: '#34d399', border: '#10B981', glow: 'none', badge: 'VALUE' };
    if (val <= 30.0) return { bg: '#1e3a8a', text: '#60a5fa', border: '#3B82F6', glow: 'none', badge: 'FAIR' };
    if (val <= 50.0) return { bg: '#312e81', text: '#a5b4fc', border: '#6366F1', glow: 'none', badge: 'GROWTH' };
    return { bg: '#4c0519', text: '#fda4af', border: '#F43F5E', glow: 'none', badge: 'PREMIUM' };
  }

  // 5. AI Quant Score
  if (metric === 'ai_consensus_score') {
    if (val >= 75) return { bg: '#064e3b', text: '#34d399', border: '#10B981', glow: 'rgba(16, 185, 129, 0.4)', badge: 'STRONG BUY' };
    if (val >= 60) return { bg: '#065f46', text: '#6ee7b7', border: '#34D399', glow: 'none', badge: 'BUY' };
    if (val >= 40) return { bg: '#1e1b4b', text: '#94a3b8', border: '#6366F1', glow: 'none', badge: 'HOLD' };
    return { bg: '#7f1d1d', text: '#f43f5e', border: '#F43F5E', glow: 'rgba(244, 63, 94, 0.3)', badge: 'CAUTION' };
  }

  // Fallback
  return { bg: '#1e293b', text: '#94a3b8', border: '#475569', glow: 'none' };
}

export function formatMetricDisplay(metric, stock) {
  if (['change_1d_pct', 'change_1w_pct', 'change_1m_pct', 'change_1y_pct'].includes(metric)) {
    const val = stock[metric] ?? stock.change_pct ?? 0.0;
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  }
  if (metric === 'rsi_14') {
    return `RSI ${(stock.rsi_14 ?? 50).toFixed(1)}`;
  }
  if (metric === 'volume_ratio_20d') {
    return `${(stock.volume_ratio_20d ?? 1.0).toFixed(2)}x Vol`;
  }
  if (metric === 'pe_ratio') {
    return `P/E ${(stock.pe_ratio ?? 0).toFixed(1)}`;
  }
  if (metric === 'ai_consensus_score') {
    return `AI ${(stock.ai_consensus_score ?? 50).toFixed(0)}/100`;
  }
  return `${stock.change_pct >= 0 ? '+' : ''}${(stock.change_pct ?? 0).toFixed(2)}%`;
}
