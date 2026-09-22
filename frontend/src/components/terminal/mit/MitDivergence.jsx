import React from 'react';
import { Activity } from 'lucide-react';
import { BULL, BEAR, NEUT, fmtN } from './utils';
export function MitDivergence({ div }) {
  const c = div.status.includes('BULLISH') ? BULL : div.status.includes('BEARISH') ? BEAR : NEUT;
  return (
    <div className="mit-card" style={{ borderColor: c + '44' }}>
      <div className="mit-card-h"><span className="mit-card-t"><Activity size={13} color={c} />AI SENTIMENT DIVERGENCE</span></div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '.56rem', fontWeight: 800, color: '#64748B' }}>PRICE MOMENTUM</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: div.pricePct >= 0 ? BULL : BEAR, fontFamily: "'JetBrains Mono',monospace" }}>{div.pricePct >= 0 ? '+' : ''}{fmtN(div.pricePct)}%</div>
          </div>
          <div style={{ background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '.56rem', fontWeight: 800, color: '#64748B' }}>NEWS SENTIMENT</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: div.sent >= 0 ? BULL : BEAR, fontFamily: "'JetBrains Mono',monospace" }}>{div.sent >= 0 ? '+' : ''}{fmtN(div.sent)}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '.78rem', fontWeight: 900, color: c, background: c + '12', border: `1px solid ${c}44`, borderRadius: 6, padding: '7px' }}>{div.status}</div>
        <div style={{ fontSize: '.66rem', color: '#94A3B8', lineHeight: 1.55 }}>{div.note}</div>
      </div>
    </div>
  );
}
