import React from 'react';
import { OVERVIEW_CARDS } from './screenerColumns';

/**
 * Compact clickable market-overview cards. Every count comes from real rows.
 * Clicking a card applies its DSL filter (total clears filters).
 */
export default function ScreenerKpiCards({ stats = {}, activeCard = 'total', onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8, width: '100%' }}>
      {OVERVIEW_CARDS.map((card) => {
        const value = stats[card.id] ?? 0;
        const active = activeCard === card.id;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelect && onSelect(card)}
            title={card.dsl ? `Apply filter: ${card.dsl}` : 'Clear filters'}
            style={{
              background: active ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.025)',
              border: active ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 800, letterSpacing: '0.04em' }}>{card.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: card.color, fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{value}</div>
          </button>
        );
      })}
    </div>
  );
}
