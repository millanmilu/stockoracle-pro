import React, { useEffect, useRef, useState } from 'react';
import { formatCell } from './screenerColumns';
import ScreenerHoverPreview from './ScreenerHoverPreview';
import { TN } from './terminalTheme';

const HOVER_DELAY_MS = 350;

const badge = (tone) => {
  const map = {
    up: { color: TN.up, border: 'rgba(34,197,94,0.35)', bg: TN.upDim },
    down: { color: TN.down, border: 'rgba(248,113,113,0.35)', bg: TN.downDim },
    ai: { color: TN.ai, border: 'rgba(167,139,250,0.35)', bg: TN.aiDim },
    warn: { color: TN.warn, border: 'rgba(251,191,36,0.35)', bg: TN.warnDim },
    info: { color: TN.info, border: 'rgba(56,189,248,0.35)', bg: 'rgba(56,189,248,0.10)' },
  };
  const t = map[tone] || { color: TN.muted, border: TN.border, bg: 'rgba(148,163,184,0.06)' };
  return { background: t.bg, color: t.color, border: `1px solid ${t.border}`, padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' };
};

function cellContent(col, row, liveTick, flash) {
  const key = col.key;
  if (key === 'ticker') {
    return (
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TN.info, fontWeight: 700 }} title={`${row.ticker} — ${row.name || row.ticker}`}>
        {row.ticker}
      </span>
    );
  }
  if (key === 'name') {
    return <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TN.muted }} title={row.name}>{row.name || '—'}</span>;
  }
  if (key === 'close_price' && liveTick?.price != null) {
    return (
      <span className={flash ? 'tn-flash' : undefined} style={{ fontWeight: 700, color: TN.text, padding: '1px 4px' }}>
        ₹{Number(liveTick.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
        <span style={{ color: TN.up, fontSize: 9 }}>●</span>
      </span>
    );
  }
  if (key === 'change_1d_pct') {
    const v = liveTick?.change_pct != null ? liveTick.change_pct : row.change_1d_pct;
    if (v === null || v === undefined) return <span style={{ color: TN.faint }}>N/A</span>;
    const pos = Number(v) >= 0;
    return <span style={{ color: pos ? TN.up : TN.down, fontWeight: 700 }}>{pos ? '+' : ''}{Number(v).toFixed(2)}%</span>;
  }
  if (key === 'ai_consensus_score') {
    const v = row.ai_consensus_score;
    if (v === null || v === undefined) return <span style={{ color: TN.faint }}>N/A</span>;
    return <span style={badge(Number(v) >= 80 ? 'up' : 'ai')}>{Number(v).toFixed(1)}</span>;
  }
  if (key === 'ai_signal') {
    const s = String(row.ai_signal || 'N/A').toUpperCase();
    const tone = s.includes('BUY') ? 'up' : (s.includes('SELL') || s === 'AVOID') ? 'down' : 'warn';
    // Divergence warning: trend_hint (swing structure) vs ai_signal (EMA-based) conflict
    const trendHint = String(row.trend_hint || '').toUpperCase();
    const isBuySignal = s.includes('BUY');
    const isSellSignal = s.includes('SELL') || s === 'AVOID';
    const trendDiverges = (trendHint === 'BEARISH' && isBuySignal) || (trendHint === 'BULLISH' && isSellSignal);
    const divergeTitle = trendDiverges
      ? `⚠ Structure/Signal divergence: price swing pattern is ${trendHint} but AI multi-factor score says ${s}. Check EMA Trend column for EMA-based trend confirmation.`
      : undefined;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <span style={badge(tone)}>{s}</span>
        {trendDiverges && (
          <span style={{ fontSize: 10, color: TN.warn, cursor: 'help', lineHeight: 1 }} title={divergeTitle}>⚠</span>
        )}
      </span>
    );
  }
  if (key === 'rsi_14') {
    const v = row.rsi_14;
    if (v === null || v === undefined) return <span style={{ color: TN.faint }}>N/A</span>;
    const n = Number(v);
    return <span style={badge(n >= 70 ? 'down' : n <= 35 ? 'up' : undefined)}>{n.toFixed(1)}</span>;
  }
  if (key === 'volume_ratio_20d') {
    const v = row.volume_ratio_20d;
    if (v === null || v === undefined) return <span style={{ color: TN.faint }}>N/A</span>;
    return <span style={{ color: Number(v) >= 1.5 ? TN.ai : TN.muted, fontWeight: 700 }}>{Number(v).toFixed(2)}x</span>;
  }
  if (key === 'trend_hint') {
    const v = row.trend_hint;
    if (v === null || v === undefined || v === '' || v === 'N/A') return <span style={{ color: TN.faint }}>N/A</span>;
    const s = String(v).toUpperCase();
    return (
      <span
        style={{ color: s === 'BULLISH' ? TN.up : s === 'BEARISH' ? TN.down : TN.muted, fontWeight: 700, cursor: 'help' }}
        title="Price swing structure (HH/HL pivot pattern) — measures recent swing sequence, not EMA position. May differ from AI Signal which uses EMA + RSI + volume + fundamentals."
      >
        {s === 'BULLISH' ? 'BULL' : s === 'BEARISH' ? 'BEAR' : s}
      </span>
    );
  }
  if (key === 'ema_alignment') {
    const v = row.ema_alignment;
    if (v === null || v === undefined || v === '' || v === 'N/A') return <span style={{ color: TN.faint }}>N/A</span>;
    const s = String(v).toUpperCase();
    const isBull = s === 'BULLISH_ALIGNED';
    const isBear = s === 'BEARISH_ALIGNED';
    const color = isBull ? TN.up : isBear ? TN.down : TN.warn;
    const label = isBull ? 'BULL▲' : isBear ? 'BEAR▼' : 'MIX';
    return (
      <span
        style={{ color, fontWeight: 700, fontSize: 11, cursor: 'help' }}
        title={`EMA Alignment: ${v} — EMA 20 > EMA 50 > EMA 200 relative position. Directly consistent with AI Signal scoring methodology.`}
      >
        {label}
      </span>
    );
  }
  if (key === 'market_regime' || key === 'structure_label' || key === 'momentum_state' || key === 'macd_crossover' || key === 'retest_status' || key === 'sentiment_label' || key === 'sector') {
    const v = row[key];
    if (v === null || v === undefined || v === '') return <span style={{ color: TN.faint }}>N/A</span>;
    return <span style={{ color: '#C3CEDD', fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(v)}>{String(v)}</span>;
  }
  if (key === 'supertrend_dir') {
    const v = row.supertrend_dir;
    if (v === null || v === undefined) return <span style={{ color: TN.faint }}>N/A</span>;
    return <span style={{ color: Number(v) > 0 ? TN.up : TN.down, fontWeight: 700 }}>{Number(v) > 0 ? 'BULL' : 'BEAR'}</span>;
  }
  if (key === 'volume_breakout') {
    const v = row.volume_breakout;
    if (v === null || v === undefined) return <span style={{ color: TN.faint }}>N/A</span>;
    return Number(v) ? <span style={badge('up')}>YES</span> : <span style={{ color: TN.faint }}>—</span>;
  }
  const formatted = formatCell(col, row[key]);
  return <span style={{ color: formatted === 'N/A' ? TN.faint : '#C3CEDD', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatted}>{formatted}</span>;
}

const actionBtn = {
  padding: '3px 6px',
  borderRadius: 3,
  background: 'rgba(148,163,184,0.07)',
  color: TN.muted,
  border: `1px solid ${TN.border}`,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  lineHeight: 1.4,
};

function ScreenerTableRowComponent({
  row, index, columns = [], isSelected = false,
  onToggleSelect, onInspect, onNavigateChart, onNavigateFundamentals,
  onAddWatchlist, onAlertFor, liveTick,
}) {
  // Brief background flash when a live tick updates the price cell.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(null);
  const hoverTimer = useRef(null);
  const [previewAt, setPreviewAt] = useState(null);
  const lastPrice = useRef(liveTick?.price);
  useEffect(() => {
    if (liveTick?.price != null && lastPrice.current != null && liveTick.price !== lastPrice.current) {
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 750);
    }
    lastPrice.current = liveTick?.price;
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [liveTick?.price]);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  // A fixed-position preview would go stale on scroll — dismiss it on any
  // scroll (capture phase reaches the table's inner scroll containers too).
  useEffect(() => {
    const onScroll = () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setPreviewAt(null);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  const beginHover = (e) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const x = e.clientX;
    const y = e.clientY;
    hoverTimer.current = setTimeout(() => setPreviewAt({ x, y }), HOVER_DELAY_MS);
  };
  const endHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPreviewAt(null);
  };

  return (
    <tr
      className="tn-row"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onInspect(row); }}
      style={{
        borderBottom: '1px solid rgba(148,163,184,0.07)',
        textAlign: 'right', color: '#C3CEDD', height: 32,
        background: isSelected ? 'rgba(124,140,248,0.12)' : index % 2 === 0 ? 'transparent' : 'rgba(148,163,184,0.02)',
        cursor: 'pointer',
      }}
      onClick={() => onInspect(row)}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(124,140,248,0.06)'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(148,163,184,0.02)'; }}
    >
      <td style={{ textAlign: 'center', padding: '4px 6px' }} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(row.ticker)} aria-label={`Select ${row.ticker}`} style={{ cursor: 'pointer', accentColor: '#7C8CF8' }} />
      </td>
      <td style={{ textAlign: 'left', padding: '4px 6px', color: TN.faint, fontSize: 11 }}>{index + 1}</td>
      {columns.map((c) => (
        <td
          key={c.key}
          style={{ padding: '4px 6px', textAlign: c.key === 'ticker' || c.key === 'name' || c.key === 'sector' ? 'left' : 'right', overflow: c.key === 'ticker' ? 'visible' : 'hidden' }}
          onMouseEnter={c.key === 'ticker' ? beginHover : undefined}
          onMouseLeave={c.key === 'ticker' ? endHover : undefined}
        >
          {cellContent(c, row, liveTick, flash)}
          {c.key === 'ticker' && previewAt && (
            <ScreenerHoverPreview
              row={row}
              x={previewAt.x}
              y={previewAt.y}
              onNavigateChart={onNavigateChart}
              onInspect={onInspect}
              onAlertFor={onAlertFor}
            />
          )}
        </td>
      ))}
      <td style={{ padding: '4px 6px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="tn-row-actions" style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button onClick={() => onNavigateChart(row.ticker)} title="Open chart" style={actionBtn}>Chart</button>
          <button onClick={() => onInspect(row)} title="Open analysis drawer" style={actionBtn}>Analysis</button>
          {onAlertFor && <button onClick={() => onAlertFor(row)} title="Create alert" style={actionBtn}>Alert</button>}
          {onAddWatchlist && <button onClick={() => onAddWatchlist(row)} title="Add to watchlist" style={actionBtn}>Watch</button>}
        </div>
      </td>
    </tr>
  );
}

export const ScreenerTableRow = React.memo(ScreenerTableRowComponent);
export default ScreenerTableRow;
