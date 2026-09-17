import React from 'react';

/** Compact market-breadth visualisation from REAL screener rows. */
export default function ScreenerBreadthBar({ breadth }) {
  if (!breadth || !breadth.total) return null;
  const advPct = breadth.total ? (breadth.advancing / breadth.total) * 100 : 0;
  const decPct = breadth.total ? (breadth.declining / breadth.total) * 100 : 0;
  const items = [
    { label: 'Adv', value: breadth.advancing, color: '#10B981' },
    { label: 'Dec', value: breadth.declining, color: '#EF4444' },
    { label: 'Unch', value: breadth.unchanged, color: '#64748B' },
    { label: 'New Hi', value: breadth.new_highs, color: '#06B6D4' },
    { label: 'New Lo', value: breadth.new_lows, color: '#F59E0B' },
    { label: '>EMA20', value: `${breadth.above_ema20_pct ?? 0}%`, color: '#818CF8' },
    { label: '>EMA50', value: `${breadth.above_ema50_pct ?? 0}%`, color: '#A855F7' },
    { label: '>EMA200', value: `${breadth.above_ema200_pct ?? 0}%`, color: '#38BDF8' },
    { label: 'Bull %', value: `${breadth.bullish_pct ?? 0}%`, color: '#34D399' },
    { label: 'Bear %', value: `${breadth.bearish_pct ?? 0}%`, color: '#FB7185' },
  ];
  return (
    <div style={{ background: '#090D1C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 800, letterSpacing: '0.05em' }}>
          MARKET BREADTH — {breadth.total} STOCKS
        </span>
        <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>{breadth.advancing}▲ / {breadth.declining}▼</span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#060913' }}>
        <div style={{ width: `${advPct}%`, background: '#10B981' }} />
        <div style={{ width: `${decPct}%`, background: '#EF4444' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {items.map((it) => (
          <span key={it.label} style={{ fontSize: '0.64rem', color: '#94A3B8' }}>
            <span style={{ color: it.color, fontWeight: 800 }}>{it.label} {it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
