import React from 'react';
import { OVERVIEW_CARDS } from './screenerColumns';
import { TN, num } from './terminalTheme';

/* Compact institutional KPI strip: flat tiles, tabular numbers. */
export function ScreenerKpiCards({ stats = {}, activeCard = 'total', onSelect }) {
  return (
    <div
      className="tn-kpi-strip"
      role="list"
      aria-label="Market overview metrics"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'visible', padding: '2px' }}
    >
      {OVERVIEW_CARDS.map((card) => {
        // A missing count renders as an em dash: showing a hard 0 would claim
        // "no stocks matched" when the truth is "no data for this metric".
        const raw = stats[card.id];
        const value = raw === null || raw === undefined ? '—' : raw;
        const active = activeCard === card.id;
        const primary = card.id === 'total' || card.id === 'bullish' || card.id === 'ai_high_confidence';
        return (
          <button
            key={card.id}
            type="button"
            role="listitem"
            onClick={() => onSelect && onSelect(card)}
            title={card.dsl ? `Apply filter: ${card.dsl}` : 'Clear filters'}
            aria-pressed={active}
            style={{
              flex: '1 1 96px',
              minWidth: primary ? 96 : 84,
              maxWidth: 160,
              height: 58,
              background: active ? 'rgba(124,140,248,0.12)' : TN.panel,
              border: active ? '1px solid rgba(124,140,248,0.5)' : `1px solid ${TN.border}`,
              borderTop: `2px solid ${active ? TN.accent : card.color}`,
              borderRadius: TN.radius,
              padding: '6px 10px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <div style={{ fontSize: 10, color: TN.faint, fontWeight: 700, letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{card.label}</div>
            <div style={num(primary ? 19 : 17, { fontWeight: 700, color: card.color, lineHeight: 1.1 })}>{value}</div>
          </button>
        );
      })}
    </div>
  );
}

export default ScreenerKpiCards;