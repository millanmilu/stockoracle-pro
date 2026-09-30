import React from 'react';
import { OVERVIEW_CARDS } from './screenerColumns';
import { TN, num } from './terminalTheme';

/* Compact institutional KPI strip: flat tiles, tabular numbers.
 *
 * Every count is computed from rows that have the relevant metric, so the
 * denominator is *covered* rows, not the whole tracked universe. The coverage
 * footnote below the strip states that outright — otherwise "AI HIGH CONF 2"
 * reads as a broken screen rather than "only 51 stocks have fundamentals".
 */
export function ScreenerKpiCards({ stats = {}, activeCard = 'total', onSelect, coverage = null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', minWidth: 0 }}>
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
    {coverage && coverage.total > 0 ? (
      <div style={{ fontSize: 10, color: TN.faint, padding: '0 4px' }}>
        Counts are over covered rows:{' '}
        <span style={{ color: TN.text }}>{coverage.priced.toLocaleString('en-IN')}</span> of{' '}
        {coverage.total.toLocaleString('en-IN')} tracked have a price,
        {' '}<span style={{ color: TN.text }}>{coverage.with_fundamentals.toLocaleString('en-IN')}</span> have fundamentals
        {coverage.no_data > 0 ? <> · <span style={{ color: TN.warn }}>{coverage.no_data.toLocaleString('en-IN')} without data</span></> : null}
      </div>
    ) : null}
    </div>
  );
}

export default ScreenerKpiCards;