import React, { useState } from 'react';
import { Scale, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { BULL, BEAR, NEUT } from './utils';

/* AI executive summary: narrative · drivers · risks · conclusion + evidence trace */
export function MitSummary({ summary, loading, onRegen }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mit-card">
      <div className="mit-card-h" onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer' }}>
        <span className="mit-card-t"><Scale size={13} color="#818CF8" />AI EXECUTIVE SUMMARY</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={(e) => { e.stopPropagation(); onRegen(); }} className="mit-chipbtn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><RefreshCw size={11} className={loading ? 'mit-spin' : ''} />Regenerate</button>
          {open ? <ChevronUp size={14} color="#64748B" /> : <ChevronDown size={14} color="#64748B" />}
        </span>
      </div>
      {open && (
        <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (<><div className="mit-skel" style={{ height: 44 }} /><div className="mit-skel" style={{ height: 16, width: '70%' }} /></>) : !summary ? (
            <div style={{ fontSize: '.74rem', color: '#94A3B8' }}>No summary available for this symbol yet.</div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.08em', color: '#64748B', marginBottom: 4 }}>MARKET NARRATIVE</div>
                <p style={{ margin: 0, fontSize: '.76rem', color: '#E2E8F0', lineHeight: 1.6 }}>{summary.narrative}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: '.6rem', fontWeight: 800, color: BULL, marginBottom: 5 }}>KEY DRIVERS</div>
                  {summary.drivers.map((d, i) => <div key={i} style={{ fontSize: '.68rem', color: '#CBD5E1', padding: '2px 0' }}>• {d}</div>)}
                </div>
                <div style={{ background: 'rgba(9,13,30,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: '.6rem', fontWeight: 800, color: BEAR, marginBottom: 5 }}>RISK FACTORS</div>
                  {summary.risks.map((r, i) => <div key={i} style={{ fontSize: '.68rem', color: '#CBD5E1', padding: '2px 0' }}>• {r}</div>)}
                </div>
              </div>
              <div style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(129,140,248,.3)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.08em', color: '#818CF8', marginBottom: 4 }}>AI CONCLUSION</div>
                <div style={{ fontSize: '.74rem', color: '#E2E8F0', fontStyle: 'italic', lineHeight: 1.55 }}>“{summary.conclusion}”</div>
                <div style={{ fontSize: '.62rem', color: '#64748B', marginTop: 5 }}>Sentiment {summary.label} · Impact {summary.impact} · {summary.evidence.length} supporting articles linked below</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
