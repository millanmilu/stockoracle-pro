import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TN, panel, sectionTitle, btn, num } from './terminalTheme';

/**
 * Sector rotation as a compact ≤70px strip: one line with the title,
 * quadrant counts and a horizontal scroll of dense sector chips.
 * An expanded quadrant view is one click away. Clicking a chip filters
 * the table. `collapsed` hides everything but the title line.
 */
const QUAD_ORDER = ['Strong', 'Improving', 'Weakening', 'Weak'];
const QUAD_COLOR = { Strong: TN.up, Improving: TN.info, Weakening: TN.warn, Weak: TN.down };

export default function ScreenerSectorChart({
  rows = [],
  sectors = [],
  selectedSector = 'ALL',
  onSelectSector,
  collapsed = false,
  onToggleCollapse,
  expanded = false,
  onToggleExpanded,
}) {
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

  const chipFor = (sec) => {
    const isSel = selectedSector === sec.sector;
    const chg = sec.avg_change_1d_pct ?? 0;
    return (
      <button
        key={sec.sector}
        type="button"
        onClick={() => onSelectSector(isSel ? 'ALL' : sec.sector)}
        aria-pressed={isSel}
        title={`${sec.sector}: ${chg >= 0 ? '+' : ''}${chg}% · AI ${sec.avg_ai_score ?? '—'} — click to filter`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 24,
          flexShrink: 0,
          padding: '0 8px',
          background: isSel ? 'rgba(124,140,248,0.12)' : 'transparent',
          border: isSel ? '1px solid rgba(124,140,248,0.5)' : `1px solid ${TN.border}`,
          borderRadius: 3,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontSize: 11,
        }}
      >
        <span style={{ fontWeight: 700, color: isSel ? TN.accent : TN.text }}>{sec.sector}</span>
        <span style={num(11, { color: chg >= 0 ? TN.up : TN.down, fontWeight: 700 })}>{chg >= 0 ? '+' : ''}{chg}%</span>
        <span style={num(10, { color: TN.faint })}>AI {sec.avg_ai_score ?? '—'}</span>
      </button>
    );
  };

  return (
    <div style={panel({ padding: collapsed ? '5px 10px' : '6px 10px' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 26 }}>
        <span style={sectionTitle({ whiteSpace: 'nowrap', flexShrink: 0 })}>Sector Rotation</span>
        <span style={{ display: 'inline-flex', gap: 8, fontSize: 11, color: TN.faint, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {QUAD_ORDER.map((q) => (
            <span key={q}><span style={{ color: QUAD_COLOR[q], fontWeight: 700 }}>{q} {grouped[q].length}</span></span>
          )).reduce((acc, el, i) => (i === 0 ? [el] : [...acc, <span key={`s${i}`} style={{ opacity: 0.4 }}>|</span>, el]), [])}
        </span>
        <div className="tn-no-scrollbar" style={{ display: 'flex', gap: 5, overflowX: 'auto', flex: 1, minWidth: 0, padding: '1px 0' }}>
          {cards.map(chipFor)}
        </div>
        <span style={{ display: 'inline-flex', gap: 5, flexShrink: 0 }}>
          {selectedSector !== 'ALL' && (
            <button type="button" onClick={() => onSelectSector('ALL')} style={btn(false, { height: 24, fontSize: 11 })}>View All</button>
          )}
          {onToggleExpanded && (
            <button type="button" onClick={onToggleExpanded} aria-expanded={expanded} title={expanded ? 'Compact strip' : 'Quadrant view'} style={btn(expanded, { height: 24, fontSize: 11 })}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {expanded ? 'Strip' : 'Quads'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleCollapse && onToggleCollapse()}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sectors' : 'Collapse sectors'}
            style={btn(false, { height: 24, fontSize: 11 })}
          >
            {collapsed ? 'Expand' : 'Hide'}
          </button>
        </span>
      </div>
      {!collapsed && expanded && (
        <div className="tn-scroll" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
          {QUAD_ORDER.map((q) => grouped[q].length ? (
            <div key={q} style={{ minWidth: 150 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: QUAD_COLOR[q], marginBottom: 3 }}>{q.toUpperCase()} ({grouped[q].length})</div>
              {grouped[q].slice(0, 6).map((sec) => (
                <div key={sec.sector} style={{ fontSize: 11, color: TN.muted, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1px 0' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.sector}</span>
                  <span style={num(11, { color: (sec.avg_change_1d_pct ?? 0) >= 0 ? TN.up : TN.down })}>{(sec.avg_change_1d_pct ?? 0) >= 0 ? '+' : ''}{sec.avg_change_1d_pct ?? 0}%</span>
                </div>
              ))}
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}
