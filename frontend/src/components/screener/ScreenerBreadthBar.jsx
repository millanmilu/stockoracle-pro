import React from 'react';
import { TN, panel, sectionTitle, num } from './terminalTheme';

/** Compact market-breadth strip: one header line, one adv/dec bar, one stat run. Render-only. */
export default function ScreenerBreadthBar({ breadth }) {
  if (!breadth || !breadth.total) return null;
  const adv = breadth.advancing || 0;
  const dec = breadth.declining || 0;
  const noData = breadth.no_data || 0;
  // Ratios are taken over the rows that actually have a computed change. Using
  // the tracked-universe total silently counted missing data as "unchanged" and
  // dragged the advance/decline read toward the middle.
  const measured = breadth.changes_available ?? Math.max(0, breadth.total - noData);
  const barBase = measured + noData;
  const advPct = barBase ? (adv / barBase) * 100 : 0;
  const decPct = barBase ? (dec / barBase) * 100 : 0;
  const noDataPct = barBase ? (noData / barBase) * 100 : 0;
  const pct = (v) => (v == null ? '—' : `${v}%`);
  const stats = [
    ['ADV', adv, TN.up],
    ['DEC', dec, TN.down],
    ['UNCH', breadth.unchanged ?? 0, TN.muted],
    ...(noData ? [['NO DATA', noData, TN.faint]] : []),
    ['NEW HIGH', breadth.new_highs ?? 0, TN.info],
    ['NEW LOW', breadth.new_lows ?? 0, TN.warn],
    ['>EMA20', pct(breadth.above_ema20_pct), TN.text],
    ['>EMA50', pct(breadth.above_ema50_pct), TN.text],
    ['>EMA200', pct(breadth.above_ema200_pct), TN.text],
    ['BULL', pct(breadth.bullish_pct), TN.up],
    ['BEAR', pct(breadth.bearish_pct), TN.down],
  ];
  return (
    <div style={panel({ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={sectionTitle({ whiteSpace: 'nowrap' })}>
          Market Breadth — {measured} of {breadth.total} stocks measured
        </span>
        <span style={num(11, { color: TN.muted, whiteSpace: 'nowrap', flexShrink: 0 })}>
          <span style={{ color: TN.up }}>{adv} ADV</span> · <span style={{ color: TN.down }}>{dec} DEC</span>
          {noData ? <span style={{ color: TN.faint }}> · {noData} no data</span> : null}
        </span>
      </div>
      <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: TN.inset, width: '100%', minWidth: 0, flexShrink: 0 }} aria-hidden="true">
        <div style={{ width: `${advPct}%`, background: TN.up }} />
        <div style={{ width: `${decPct}%`, background: TN.down }} />
        {/* Missing data is shown as its own band, not as "unchanged". */}
        <div style={{ width: `${noDataPct}%`, background: 'rgba(148,163,184,0.18)' }} />
      </div>
      <div className="tn-breadth-stats">
        {stats.map(([label, value, color]) => (
          <span key={label} style={{ fontSize: 11, color: TN.faint }}>
            {label} <span style={num(11, { color, fontWeight: 700 })}>{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
