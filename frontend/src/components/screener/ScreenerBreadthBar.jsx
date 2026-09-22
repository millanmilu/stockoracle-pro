import React from 'react';
import { TN, panel, sectionTitle, num } from './terminalTheme';

/** Compact market-breadth strip: one header line, one adv/dec bar, one stat run. Render-only. */
export default function ScreenerBreadthBar({ breadth }) {
  if (!breadth || !breadth.total) return null;
  const adv = breadth.advancing || 0;
  const dec = breadth.declining || 0;
  const advPct = breadth.total ? (adv / breadth.total) * 100 : 0;
  const decPct = breadth.total ? (dec / breadth.total) * 100 : 0;
  const stats = [
    ['ADV', adv, TN.up],
    ['DEC', dec, TN.down],
    ['UNCH', breadth.unchanged ?? 0, TN.muted],
    ['NEW HIGH', breadth.new_highs ?? 0, TN.info],
    ['NEW LOW', breadth.new_lows ?? 0, TN.warn],
    ['>EMA20', `${breadth.above_ema20_pct ?? 0}%`, TN.text],
    ['>EMA50', `${breadth.above_ema50_pct ?? 0}%`, TN.text],
    ['>EMA200', `${breadth.above_ema200_pct ?? 0}%`, TN.text],
    ['BULL', `${breadth.bullish_pct ?? 0}%`, TN.up],
    ['BEAR', `${breadth.bearish_pct ?? 0}%`, TN.down],
  ];
  return (
    <div style={panel({ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={sectionTitle({ whiteSpace: 'nowrap' })}>Market Breadth — {breadth.total} stocks</span>
        <span style={num(11, { color: TN.muted, whiteSpace: 'nowrap', flexShrink: 0 })}><span style={{ color: TN.up }}>{adv} ADV</span> · <span style={{ color: TN.down }}>{dec} DEC</span></span>
      </div>
      <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: TN.inset, width: '100%', minWidth: 0, flexShrink: 0 }} aria-hidden="true">
        <div style={{ width: `${advPct}%`, background: TN.up }} />
        <div style={{ width: `${decPct}%`, background: TN.down }} />
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
