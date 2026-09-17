import React, { useMemo } from 'react';

/** Sector rotation: Strong / Improving / Weakening / Weak from REAL rows. Click filters. */
const QUAD_ORDER = ['Strong', 'Improving', 'Weakening', 'Weak'];
const QUAD_COLOR = { Strong: '#10B981', Improving: '#38BDF8', Weakening: '#F59E0B', Weak: '#EF4444' };

export default function ScreenerSectorChart({ rows = [], sectors = [], selectedSector = 'ALL', onSelectSector }) {
  const cards = useMemo(() => {
    if (sectors && sectors.length) return [...sectors].sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
    const map = {};
    (rows || []).forEach((r) => {
      const sec = r.sector || 'Diversified';
      if (!map[sec]) map[sec] = { sector: sec, stocks: 0, bullish: 0, totalScore: 0, chg: 0 };
      map[sec].stocks += 1;
      const sig = String(r.ai_signal || '').toUpperCase();
      if (sig.includes('BUY')) map[sec].bullish += 1;
      map[sec].totalScore += Number(r.ai_consensus_score || 50);
      map[sec].chg += Number(r.change_1d_pct || 0);
    });
    return Object.values(map).map((m) => ({
      sector: m.sector, stocks: m.stocks,
      avg_ai_score: m.stocks ? +(m.totalScore / m.stocks).toFixed(1) : 50,
      avg_change_1d_pct: m.stocks ? +(m.chg / m.stocks).toFixed(2) : 0,
      bullish: m.bullish, quadrant: m.bullish / Math.max(1, m.stocks) >= 0.5 ? 'Strong' : 'Weakening',
      composite: m.bullish,
    })).sort((a, b) => b.avg_ai_score - a.avg_ai_score);
  }, [rows, sectors]);

  const grouped = useMemo(() => {
    const g = { Strong: [], Improving: [], Weakening: [], Weak: [] };
    cards.forEach((c) => { (g[c.quadrant] || g.Weakening).push(c); });
    return g;
  }, [cards]);

  if (!cards.length) return null;

  return (
    <div style={{ background: '#090D1C', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 800, letterSpacing: '0.05em' }}>
          SECTOR ROTATION — PERFORMANCE / MOMENTUM / BREADTH ({cards.length})
        </span>
        {selectedSector !== 'ALL' && (
          <button type="button" onClick={() => onSelectSector('ALL')} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: '#A5B4FC', fontSize: '0.64rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>Show All</button>
        )}
      </div>
      {QUAD_ORDER.map((q) => (
        grouped[q].length ? (
          <div key={q}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: QUAD_COLOR[q], marginBottom: 4 }}>{q.toUpperCase()} ({grouped[q].length})</div>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
              {grouped[q].map((sec) => {
                const isSel = selectedSector === sec.sector;
                return (
                  <div key={sec.sector} onClick={() => onSelectSector(isSel ? 'ALL' : sec.sector)} style={{ minWidth: 128, background: isSel ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.025)', border: isSel ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 9px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#E2E8F0', maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.sector}</span>
                      <span style={{ fontSize: '0.6rem', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{sec.stocks}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', marginTop: 3 }}>
                      <span style={{ color: (sec.avg_change_1d_pct ?? 0) >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>{(sec.avg_change_1d_pct ?? 0) >= 0 ? '+' : ''}{sec.avg_change_1d_pct ?? 0}%</span>
                      <span style={{ color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>AI {sec.avg_ai_score ?? '—'}</span>
                    </div>
                    {sec.breadth_pct != null && (
                      <div style={{ fontSize: '0.58rem', color: '#64748B', marginTop: 2 }}>Breadth {sec.breadth_pct}% • Vol {sec.avg_rel_volume ?? '—'}x</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      ))}
    </div>
  );
}
