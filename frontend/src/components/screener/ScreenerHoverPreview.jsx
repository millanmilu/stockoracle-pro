import React from 'react';
import { TN, panel, num } from './terminalTheme';

/**
 * Ticker hover preview: compact intelligence card pinned near the cursor.
 * All values come from the already-loaded row — no extra fetch.
 * Click (row) opens the full drawer; buttons offer the same quick actions.
 */
export default function ScreenerHoverPreview({ row, x, y, onNavigateChart, onInspect, onAlertFor }) {
  if (!row) return null;
  const chg = row.change_1d_pct;
  const pos = (chg ?? 0) >= 0;
  const trend = String(row.trend_hint || '').toUpperCase();
  const left = Math.max(8, Math.min(x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 248));
  const top = Math.max(8, Math.min(y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220));
  const statRow = (k, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
      <span style={{ color: TN.faint }}>{k}</span>
      <span style={num(11, { color: TN.text, fontWeight: 700 })}>{v}</span>
    </div>
  );
  const actionBtn = {
    flex: 1, padding: '3px 0', borderRadius: 3, background: 'rgba(148,163,184,0.07)',
    color: TN.muted, border: `1px solid ${TN.border}`, cursor: 'pointer', fontSize: 11, fontWeight: 600,
  };
  return (
    <div
      style={panel({
        position: 'fixed', left, top, width: 232, zIndex: 300, padding: '9px 11px',
        background: '#0B1120', boxShadow: '0 14px 36px rgba(0,0,0,0.65)',
        display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'auto',
      })}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TN.text }}>{row.ticker}</span>
        <span style={num(11, { color: pos ? TN.up : TN.down, fontWeight: 700 })}>
          ₹{Number(row.close_price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {pos ? '+' : ''}{chg != null ? Number(chg).toFixed(2) : '—'}%
        </span>
      </div>
      <div style={{ height: 1, background: TN.border }} />
      {statRow('AI Score', row.ai_consensus_score ?? 'N/A')}
      {statRow('Trend', trend === 'BULLISH' ? 'Bullish' : trend === 'BEARISH' ? 'Bearish' : (row.trend_hint || 'N/A'))}
      {statRow('RSI', row.rsi_14 ?? 'N/A')}
      {statRow('Relative Vol', row.volume_ratio_20d != null ? `${row.volume_ratio_20d}x` : 'N/A')}
      {statRow('Signal', row.ai_signal || 'N/A')}
      <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
        <button onClick={() => onNavigateChart(row.ticker)} style={actionBtn}>Chart</button>
        <button onClick={() => onInspect(row)} style={actionBtn}>Analysis</button>
        {onAlertFor && <button onClick={() => onAlertFor(row)} style={actionBtn}>Alert</button>}
      </div>
    </div>
  );
}
