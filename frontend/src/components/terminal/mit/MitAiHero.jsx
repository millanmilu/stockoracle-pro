import React, { useState } from 'react';
import { Sparkles, RefreshCw, Eye, BrainCircuit, Clock } from 'lucide-react';
import { BULL, BEAR, NEUT, AI } from './utils';

export function MitAiHero({ ai, summary, intel, loading, onRefresh, updatedAt }) {
  const [tab, setTab] = useState('why');
  if (loading && !ai) {
    return (
      <div className="mit-card mit-ai-scan">
        <div className="mit-card-h"><span className="mit-card-t"><Sparkles size={13} color={AI} />AI MARKET INTELLIGENCE</span><RefreshCw size={13} className="mit-spin" color={AI} /></div>
        <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="mit-skel" style={{ height: 34 }} />
          <div className="mit-skel" style={{ height: 16 }} />
          <div style={{ fontSize: '.68rem', color: '#818CF8' }}>Running multi-factor inference…</div>
        </div>
      </div>
    );
  }
  if (!ai) {
    return (
      <div className="mit-card">
        <div className="mit-card-h"><span className="mit-card-t"><Sparkles size={13} color={AI} />AI MARKET INTELLIGENCE</span></div>
        <div className="mit-card-b" style={{ fontSize: '.74rem', color: '#94A3B8' }}>AI inference unavailable.<button onClick={onRefresh} className="mit-chipbtn" style={{ marginLeft: 8 }}>Retry</button></div>
      </div>
    );
  }
  const biasC = ai.bias === 'BULLISH' ? BULL : ai.bias === 'BEARISH' ? BEAR : NEUT;
  const sigC = ai.signal === 'BUY' ? BULL : ai.signal === 'SELL' ? BEAR : NEUT;
  return (
    <div className={`mit-card ${loading ? 'mit-ai-scan' : ''}`} style={{ borderColor: 'rgba(129,140,248,.3)' }}>
      <div className="mit-card-h">
        <span className="mit-card-t"><Sparkles size={13} color={AI} />AI MARKET INTELLIGENCE</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.62rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{updatedAt || '—'}</span>
          <button onClick={onRefresh} className="mit-chipbtn mit-tip" data-tip="Re-run AI analysis" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={11} className={loading ? 'mit-spin' : ''} />Refresh AI analysis
          </button>
        </span>
      </div>
      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))', gap: 8 }}>
          {[
            { k: 'AI MARKET BIAS', v: ai.bias, c: biasC },
            { k: 'CONFIDENCE', v: ai.conf + '%', c: '#E2E8F0' },
            { k: 'MARKET REGIME', v: ai.regime, c: AI },
            { k: 'AI SIGNAL', v: ai.signal, c: sigC },
          ].map((m) => (
            <div key={m.k} style={{ background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 6, padding: '7px 9px' }}>
              <div style={{ fontSize: '.56rem', fontWeight: 800, letterSpacing: '.08em', color: '#64748B' }}>{m.k}</div>
              <div style={{ fontSize: '.86rem', fontWeight: 900, color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.62rem', fontWeight: 800, color: '#94A3B8', marginBottom: 4 }}>
            <span>SIGNAL STRENGTH</span><span style={{ color: sigC }}>{ai.conf}%</span>
          </div>
          <div className="mit-bar"><i style={{ width: ai.conf + '%', background: sigC }} /></div>
        </div>
        <p style={{ margin: 0, fontSize: '.76rem', color: '#CBD5E1', lineHeight: 1.6, borderLeft: '2px solid rgba(129,140,248,.5)', paddingLeft: 10 }}>{ai.narrative}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['why', 'factors', 'evidence'].map((id) => (
            <button key={id} onClick={() => setTab(id)} className={`mit-chipbtn ${tab === id ? 'on' : ''}`}>{id === 'why' ? 'Explain signal' : id === 'factors' ? 'Contributing factors' : 'View evidence'}</button>
          ))}
        </div>
        {tab === 'why' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, color: BULL, marginBottom: 5 }}>POSITIVE FACTORS</div>
              {ai.pos.map((p, i) => <div key={i} style={{ fontSize: '.68rem', color: '#A7F3D0', padding: '2px 0' }}>+ {p}</div>)}
            </div>
            <div style={{ background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, color: BEAR, marginBottom: 5 }}>RISKS</div>
              {ai.risks.map((r, i) => <div key={i} style={{ fontSize: '.68rem', color: '#FECDD3', padding: '2px 0' }}>− {r}</div>)}
            </div>
          </div>
        )}
        {tab === 'factors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {intel.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 40px', gap: 8, alignItems: 'center', fontSize: '.66rem' }}>
                <span style={{ color: '#94A3B8', fontWeight: 700 }}>{f.k}</span>
                <div className="mit-bar"><i style={{ width: Math.abs(f.v) / 25 * 100 + '%', background: f.v >= 0 ? BULL : BEAR }} /></div>
                <span style={{ textAlign: 'right', fontWeight: 800, color: f.v >= 0 ? BULL : BEAR, fontFamily: "'JetBrains Mono',monospace" }}>{f.v > 0 ? '+' : ''}{f.v}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'evidence' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(summary?.evidence || []).map((e, i) => (
              <div key={i} style={{ fontSize: '.68rem', color: '#CBD5E1', background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 5, padding: '6px 9px' }}>
                <span style={{ color: AI, fontWeight: 800 }}>[{e.source}]</span> {e.title}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: '.6rem', color: '#475569' }}>Algorithmic analytical signal — not financial advice.</div>
      </div>
    </div>
  );
}
