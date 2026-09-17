import React from 'react';
import { formatCell } from './screenerColumns';

function badgeStyle(kind) {
  switch (kind) {
    case 'buy': return { background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.4)' };
    case 'sell': return { background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.35)' };
    case 'info': return { background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' };
    case 'warn': return { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' };
    default: return { background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.06)' };
  }
}

function cellContent(col, row, liveTick) {
  const key = col.key;
  if (key === 'ticker') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: '#38BDF8', fontWeight: 800 }}>{row.ticker}</span>
        <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 400, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name || row.ticker}</span>
      </div>
    );
  }
  if (key === 'close_price' && liveTick?.price != null) {
    return <span style={{ fontWeight: 700, color: '#F1F5F9' }}>₹{Number(liveTick.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ color: '#10B981', fontSize: '0.58rem' }}>●</span></span>;
  }
  if (key === 'change_1d_pct') {
    const v = liveTick?.change_pct != null ? liveTick.change_pct : row.change_1d_pct;
    if (v === null || v === undefined) return 'N/A';
    const pos = Number(v) >= 0;
    return <span style={{ color: pos ? '#10B981' : '#EF4444', fontWeight: 700 }}>{pos ? '+' : ''}{Number(v).toFixed(2)}%</span>;
  }
  if (key === 'ai_consensus_score') {
    const v = row.ai_consensus_score;
    if (v === null || v === undefined) return 'N/A';
    const strong = Number(v) >= 80;
    return <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 800, ...(strong ? badgeStyle('buy') : badgeStyle('info')) }}>{Number(v).toFixed(1)}</span>;
  }
  if (key === 'ai_signal') {
    const s = String(row.ai_signal || 'N/A').toUpperCase();
    const kind = s.includes('BUY') ? 'buy' : (s.includes('SELL') || s === 'AVOID') ? 'sell' : 'warn';
    return <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 800, ...badgeStyle(kind) }}>{s}</span>;
  }
  if (key === 'rsi_14') {
    const v = row.rsi_14;
    if (v === null || v === undefined) return 'N/A';
    const n = Number(v);
    const kind = n >= 70 ? 'sell' : n <= 35 ? 'buy' : 'default';
    return <span style={{ padding: '2px 5px', borderRadius: 3, fontWeight: 700, ...badgeStyle(kind) }}>{n.toFixed(1)}</span>;
  }
  if (key === 'volume_ratio_20d') {
    const v = row.volume_ratio_20d;
    if (v === null || v === undefined) return 'N/A';
    return <span style={{ color: Number(v) >= 1.5 ? '#A855F7' : '#94A3B8', fontWeight: 700 }}>{Number(v).toFixed(2)}x</span>;
  }
  if (key === 'market_regime' || key === 'structure_label' || key === 'ema_alignment' || key === 'momentum_state' || key === 'macd_crossover' || key === 'retest_status' || key === 'sentiment_label') {
    const v = row[key];
    if (v === null || v === undefined || v === '') return 'N/A';
    return <span style={{ padding: '2px 5px', borderRadius: 3, fontSize: '0.6rem', background: 'rgba(255,255,255,0.04)', color: '#CBD5E1' }}>{String(v)}</span>;
  }
  if (key === 'supertrend_dir') {
    const v = row.supertrend_dir;
    if (v === null || v === undefined) return 'N/A';
    return <span style={{ color: Number(v) > 0 ? '#10B981' : '#EF4444', fontWeight: 800 }}>{Number(v) > 0 ? 'BULL' : 'BEAR'}</span>;
  }
  if (key === 'volume_breakout') {
    const v = row.volume_breakout;
    if (v === null || v === undefined) return 'N/A';
    return Number(v) ? <span style={{ ...badgeStyle('buy'), padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>YES</span> : <span style={{ color: '#64748B' }}>—</span>;
  }
  return formatCell(col, row[key]);
}

function ScreenerTableRowComponent({ row, index, columns = [], isSelected = false, onToggleSelect, onInspect, onNavigateChart, onNavigateFundamentals, liveTick }) {
  return (
    <tr
      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right', color: '#CBD5E1', background: isSelected ? 'rgba(99,102,241,0.14)' : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', cursor: 'pointer' }}
      onClick={() => onInspect(row)}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}
    >
      <td style={{ textAlign: 'center', padding: '6px 8px', width: 30 }} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(row.ticker)} style={{ cursor: 'pointer', accentColor: '#6366F1' }} />
      </td>
      <td style={{ textAlign: 'left', padding: '6px 8px', color: '#475569', fontSize: '0.62rem' }}>{index + 1}</td>
      {columns.map((c) => (
        <td key={c.key} style={{ padding: '6px 8px', textAlign: c.key === 'ticker' || c.key === 'name' || c.key === 'sector' ? 'left' : 'right', whiteSpace: c.key === 'ticker' ? 'normal' : 'nowrap' }}>
          {cellContent(c, row, liveTick)}
        </td>
      ))}
      <td style={{ padding: '6px 8px', textAlign: 'center', width: 96 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button onClick={() => onNavigateChart(row.ticker)} title="Open Live Chart" style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700 }}>Chart</button>
          <button onClick={() => onNavigateFundamentals(row.ticker)} title="View Fundamentals" style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700 }}>Info</button>
        </div>
      </td>
    </tr>
  );
}

export const ScreenerTableRow = React.memo(ScreenerTableRowComponent);
export default ScreenerTableRow;
