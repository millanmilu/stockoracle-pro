import React from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { BULL, BEAR, NEUT } from './utils';
export function MitSignal({ sig }) {
  const c = sig.action === 'BUY' ? BULL : sig.action === 'SELL' ? BEAR : NEUT;
  return (
    <div className="mit-card" style={{ borderColor: c + '44' }}>
      <div className="mit-card-h"><span className="mit-card-t"><Target size={13} color={c} />AI MARKET SIGNAL</span>
        <span style={{ fontSize: '.6rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} />ANALYTICAL</span></div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: c, letterSpacing: '.02em' }}>{sig.action}</div>
        <div style={{ fontSize: '.66rem', color: '#94A3B8' }}>Confidence <b style={{ color: '#E2E8F0' }}>{sig.conf}%</b> · {sig.level}</div>
        <div className="mit-bar" style={{ width: '100%' }}><i style={{ width: sig.conf + '%', background: c }} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {sig.parts.map((p, i) => (
            <div key={i} className="mit-tip" data-tip={p.hint} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 34px', gap: 7, alignItems: 'center', fontSize: '.62rem' }}>
              <span style={{ color: '#94A3B8', fontWeight: 700 }}>{p.k}</span>
              <div className="mit-bar"><i style={{ width: Math.min(100, Math.abs(p.v) / 25 * 100) + '%', background: p.v >= 0 ? BULL : BEAR }} /></div>
              <span style={{ textAlign: 'right', fontWeight: 800, color: p.v >= 0 ? BULL : BEAR, fontFamily: "'JetBrains Mono',monospace" }}>{p.v > 0 ? '+' : ''}{p.v}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '.58rem', color: '#475569', textAlign: 'center' }}>Weighted composite of news, momentum &amp; volatility. Not financial advice.</div>
      </div>
    </div>
  );
}
