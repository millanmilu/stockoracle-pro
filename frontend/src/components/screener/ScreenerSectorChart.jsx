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

// Labels the pipeline writes when it has no real classification. They are not
// sectors — "Diversified" alone covered 60% of the tracked universe while mixing
// unrelated industries, so it must never be drawn as a rotation bar.
const PLACEHOLDER_SECTORS = new Set(['', '-', 'n/a', 'na', 'none', 'unknown', 'diversified', 'other']);
const isRealSector = (value) => !PLACEHOLDER_SECTORS.has(String(value ?? '').trim().toLowerCase());

/** A sector whose quadrant is measured (i.e. it has real ingredients). */
const isMeasured = (sec) => QUAD_ORDER.includes(sec.quadrant);

export default function ScreenerSectorChart({
  rows = [],
  sectors = [],
  sectorsExcluded = null,
  selectedSector = 'ALL',
  onSelectSector,
  collapsed = false,
  onToggleCollapse,
  expanded = false,
  onToggleExpanded,
}) {
  const cards = useMemo(() => {
    if (sectors && sectors.length) {
      return [...sectors]
        .filter(isMeasured)
        .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
    }
    // Local fallback when the overview payload is unavailable. Rows without a
    // real sector are skipped rather than lumped into a fabricated bucket.
    const map = {};
    const acc = {};
    (rows || []).forEach((r) => {
      const sec = r.sector;
      if (!isRealSector(sec)) return;
      if (!map[sec]) { map[sec] = { sector: sec, stocks: 0, bullish: 0, totalScore: 0, aiCount: 0, chg: 0, chgCount: 0 }; }
      const m = map[sec];
      m.stocks += 1;
      if (String(r.ai_signal || '').toUpperCase().includes('BUY')) m.bullish += 1;
      const ai = Number(r.ai_consensus_score);
      if (Number.isFinite(ai)) { m.totalScore += ai; m.aiCount += 1; }
      const chg = Number(r.change_1d_pct);
      if (Number.isFinite(chg)) { m.chg += chg; m.chgCount += 1; }
      acc[sec] = m;
    });
    return Object.values(map)
      .filter((m) => m.stocks >= 3)
      .map((m) => ({
        sector: m.sector, stocks: m.stocks,
        avg_ai_score: m.aiCount ? +(m.totalScore / m.aiCount).toFixed(1) : null,
        avg_change_1d_pct: m.chgCount ? +(m.chg / m.chgCount).toFixed(2) : null,
        bullish: m.bullish,
        quadrant: m.aiCount && m.chgCount
          ? (m.bullish / Math.max(1, m.stocks) >= 0.5 ? 'Strong' : 'Weakening')
          : 'No Data',
        composite: m.aiCount && m.chgCount ? m.bullish : null,
      }))
      .filter(isMeasured)
      .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
  }, [rows, sectors]);

  const grouped = useMemo(() => {
    const g = { Strong: [], Improving: [], Weakening: [], Weak: [] };
    cards.forEach((c) => { if (g[c.quadrant]) g[c.quadrant].push(c); });
    return g;
  }, [cards]);

  // Rows the chart refuses to plot. Stated outright instead of absorbed.
  const excludedNote = useMemo(() => {
    const unclassified = sectorsExcluded?.unclassified ?? 0;
    const unmeasured = sectorsExcluded?.no_data_stocks ?? 0;
    const tiny = sectorsExcluded?.below_min_stocks ?? 0;
    // Tracked size, but too few of the rows are measured to rank the sector —
    // without this the backend would drop a bar and say nothing about it.
    const thin = sectorsExcluded?.below_measured_stocks ?? 0;
    const parts = [];
    if (unclassified) parts.push(`${unclassified} unclassified`);
    if (unmeasured) parts.push(`${unmeasured} in sectors without data`);
    if (thin) parts.push(`${thin} in sectors with too few measured stocks`);
    if (tiny) parts.push(`${tiny} in sectors below ${sectorsExcluded?.min_stocks ?? 3} stocks`);
    return parts.length ? `Not plotted: ${parts.join(' · ')}` : null;
  }, [sectorsExcluded]);

  if (!cards.length) return null;

  const chipFor = (sec) => {
    const isSel = selectedSector === sec.sector;
    const chg = sec.avg_change_1d_pct;
    const chgLabel = chg == null ? '—' : `${chg >= 0 ? '+' : ''}${chg}%`;
    // "15 stocks" when only 2 of them were measured overstates the bar, so say
    // both numbers whenever they differ.
    const measuredOf = (s) => (s.stocks_measured != null && s.stocks_measured !== s.stocks
      ? `${s.stocks_measured} of ${s.stocks}`
      : `${s.stocks}`);
    return (
      <button
        key={sec.sector}
        type="button"
        onClick={() => onSelectSector(isSel ? 'ALL' : sec.sector)}
        aria-pressed={isSel}
        title={`${sec.sector}: ${chgLabel} · AI ${sec.avg_ai_score ?? '—'} · ${measuredOf(sec)} stocks — click to filter`}
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
        <span style={num(11, { color: chg == null ? TN.faint : chg >= 0 ? TN.up : TN.down, fontWeight: 700 })}>{chgLabel}</span>
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
          {/* "stocks plotted" must count the rows the bars are drawn from, not
              every row that happens to carry the sector label. */}
          <span style={{ color: TN.faint }} title="Rows backing the bars, out of all rows carrying a plotted sector">
            · {cards.reduce((sum, c) => sum + (c.stocks_measured ?? c.stocks ?? 0), 0)}
            {cards.reduce((sum, c) => sum + (c.stocks || 0), 0) !== cards.reduce((sum, c) => sum + (c.stocks_measured ?? c.stocks ?? 0), 0)
              ? ` of ${cards.reduce((sum, c) => sum + (c.stocks || 0), 0)}` : ''} stocks plotted
          </span>
          {excludedNote ? <span style={{ color: TN.warn }} title={excludedNote}>· {excludedNote}</span> : null}
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
