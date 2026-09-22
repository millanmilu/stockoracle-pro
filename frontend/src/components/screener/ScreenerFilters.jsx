import React from 'react';
import { INDEX_CONSTITUENTS } from '../../constants/screenerConfig';
import { TN, sectionTitle, chip } from './terminalTheme';

const ALL_UNIVERSE = 'ALL NSE';

/**
 * Visual filter panel for the screener drawer.
 *
 * Responsibilities are deliberately narrow: universe scope, sector /
 * market-cap selects and the numeric sliders. The drawer toolbar (owned by
 * AdvancedScreener) renders the mode switch, builder toggle, Reset, Apply & Run
 * and close — this component used to duplicate every one of those, so the
 * drawer showed two of each control.
 *
 * A slider counts as ACTIVE only when the user has actually moved it
 * (`touchedFilters`), which is also what decides whether its condition is sent
 * to the backend: untouched sliders are not filters and are never applied.
 */

// Declarative slider table: one place for label, range, unit and DSL field.
const SLIDERS = [
  { key: 'roce', label: 'Min ROCE', valueKey: 'minRoce', setKey: 'setMinRoce', min: 0, max: 60, step: 1, color: TN.up, field: 'ROCE', format: (v) => `${v}%` },
  { key: 'roe', label: 'Min ROE', valueKey: 'minRoe', setKey: 'setMinRoe', min: 0, max: 50, step: 1, color: TN.info, field: 'ROE', format: (v) => `${v}%` },
  { key: 'pe', label: 'Max P/E', valueKey: 'maxPe', setKey: 'setMaxPe', min: 5, max: 80, step: 1, color: TN.info, field: 'PE', format: (v) => `${v}x` },
  { key: 'pb', label: 'Max P/B', valueKey: 'maxPb', setKey: 'setMaxPb', min: 1, max: 25, step: 1, color: TN.accent, field: 'PB', format: (v) => `${v}x` },
  { key: 'debt', label: 'Max Debt/Equity', valueKey: 'maxDebt', setKey: 'setMaxDebt', min: 0, max: 3, step: 0.1, color: TN.warn, field: 'DebtToEquity', format: (v) => `${v}x` },
  { key: 'sales', label: 'Min 3Y Sales CAGR', valueKey: 'minSalesGrowth', setKey: 'setMinSalesGrowth', min: -10, max: 50, step: 1, color: TN.ai, field: 'SalesGrowth3Y', format: (v) => `${v}%` },
  { key: 'profit', label: 'Min 3Y Profit CAGR', valueKey: 'minProfitGrowth', setKey: 'setMinProfitGrowth', min: -10, max: 60, step: 1, color: TN.ai, field: 'ProfitGrowth3Y', format: (v) => `${v}%` },
  { key: 'vol', label: 'Min Volume Surge', valueKey: 'minVolRatio', setKey: 'setMinVolRatio', min: 0.5, max: 3, step: 0.1, color: TN.warn, field: 'VolumeRatio20D', format: (v) => `${v}x` },
  { key: 'ai', label: 'Min AI Score', valueKey: 'minAiScore', setKey: 'setMinAiScore', min: 30, max: 90, step: 1, color: TN.up, field: 'AIConsensus', format: (v) => `${v}/100` },
];

const selectStyle = (extra = {}) => ({
  width: '100%',
  background: TN.inset,
  border: `1px solid ${TN.border}`,
  borderRadius: TN.radius,
  padding: '5px 6px',
  color: TN.text,
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  ...extra,
});

export default function ScreenerFilters(props) {
  const {
    universe = ALL_UNIVERSE,
    setUniverse,
    onUniverseChange,
    // Live [{id, count}] from /api/screener/universes (official NSE lists).
    // Falls back to bundled INDEX_CONSTITUENTS when null.
    universeOptions = null,
    selectedSector = 'ALL',
    setSelectedSector,
    marketCapCat = 'ALL',
    setMarketCapCat,
    touchedFilters,
    activeFilterCount = 0,
  } = props;

  const touched = touchedFilters || new Set();
  const universeList = universeOptions
    ? [{ id: ALL_UNIVERSE, count: null }, ...universeOptions.filter((u) => u.id !== ALL_UNIVERSE)]
    : [{ id: ALL_UNIVERSE, count: null }, ...Object.keys(INDEX_CONSTITUENTS).map((id) => ({ id, count: INDEX_CONSTITUENTS[id].length }))];

  const sliderCell = (s) => {
    const value = props[s.valueKey];
    const onChange = props[s.setKey];
    const isActive = touched.has(s.key);
    return (
      <div key={s.key}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: isActive ? TN.muted : TN.faint, marginBottom: 3, gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isActive && <span style={{ color: s.color, fontWeight: 700 }}>● </span>}
            {s.label}
          </span>
          <strong style={{ color: isActive ? s.color : TN.faint, fontFamily: TN.mono, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.format(value)}</strong>
        </div>
        <input
          type="range"
          min={s.min}
          max={s.max}
          step={s.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${s.label} (${s.field})`}
          title={isActive ? `Applied: ${s.field} → ${s.format(value)}` : `Not applied — move to filter on ${s.field}`}
          style={{ width: '100%', accentColor: s.color, cursor: 'pointer' }}
        />
      </div>
    );
  };

  const rsiTouched = touched.has('rsiMin') || touched.has('rsiMax');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={sectionTitle()}>Numeric filters</span>
        <span style={{ fontSize: 11, color: TN.faint }}>
          {activeFilterCount > 0
            ? `${activeFilterCount} applied — only sliders you move become conditions`
            : 'Move a slider to filter; untouched sliders are ignored'}
        </span>
      </div>

      {/* Universe scope (server-side; counts are official index sizes) */}
      <div className="tn-no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center', paddingBottom: 2 }}>
        <span style={sectionTitle({ whiteSpace: 'nowrap', marginRight: 2 })}>Universe</span>
        {universeList.map((u) => {
          const isActive = universe === u.id;
          // Coverage indicator: backend reports how many constituents already
          // have screener metrics rows. Partial coverage shows covered/total
          // and warns, so silently-missing stocks are visible up front.
          const hasCoverage = u.count != null && u.covered != null;
          const partial = hasCoverage && u.covered < u.count;
          const countLabel = hasCoverage ? ` (${u.covered}/${u.count})` : u.count != null ? ` (${u.count})` : '';
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => (onUniverseChange || setUniverse)(u.id)}
              aria-pressed={isActive}
              title={
                u.count == null
                  ? 'Every tracked stock'
                  : hasCoverage
                    ? `${u.covered}/${u.count} constituents have screener metrics (official NSE list)`
                    : `${u.count} constituents (official NSE list)`
              }
              style={chip(isActive ? 'ai' : partial ? 'warn' : 'default', { flexShrink: 0, cursor: 'pointer', height: 22 })}
            >
              {u.id}{countLabel}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {SLIDERS.slice(0, 7).map(sliderCell)}

        {/* RSI needs two bounds, so it owns a single grid cell with both handles */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: rsiTouched ? TN.muted : TN.faint, marginBottom: 3, gap: 6 }}>
            <span>
              {rsiTouched && <span style={{ color: TN.accent, fontWeight: 700 }}>● </span>}
              RSI (14) Range
            </span>
            <strong style={{ color: rsiTouched ? TN.accent : TN.faint, fontFamily: TN.mono, fontWeight: 700 }}>
              {props.minRsi} – {props.maxRsi}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="range" min="0" max="50" value={props.minRsi} onChange={(e) => props.setMinRsi(Number(e.target.value))} aria-label="Minimum RSI" title="Not applied — move to filter on RSI14" style={{ width: '50%', accentColor: TN.accent, cursor: 'pointer' }} />
            <input type="range" min="50" max="100" value={props.maxRsi} onChange={(e) => props.setMaxRsi(Number(e.target.value))} aria-label="Maximum RSI" title="Not applied — move to filter on RSI14" style={{ width: '50%', accentColor: TN.accent, cursor: 'pointer' }} />
          </div>
        </div>

        {SLIDERS.slice(7).map(sliderCell)}

        <div>
          <div style={{ fontSize: 11, color: marketCapCat !== 'ALL' ? TN.muted : TN.faint, marginBottom: 3 }}>Market Cap Category</div>
          <select value={marketCapCat} onChange={(e) => setMarketCapCat(e.target.value)} aria-label="Market cap category" style={selectStyle()}>
            <option value="ALL">All Market Caps</option>
            <option value="LARGE">Large Cap (&gt; ₹50,000 Cr)</option>
            <option value="MID">Mid Cap (₹10,000–50,000 Cr)</option>
            <option value="SMALL">Small Cap (&lt; ₹10,000 Cr)</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: selectedSector !== 'ALL' ? TN.muted : TN.faint, marginBottom: 3 }}>Sector</div>
          <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} aria-label="Sector" style={selectStyle()}>
            <option value="ALL">All Sectors</option>
            <option value="IT">IT &amp; Software</option>
            <option value="Banking">Banking &amp; Financials</option>
            <option value="Pharma">Pharma &amp; Healthcare</option>
            <option value="Auto">Automobiles</option>
            <option value="Energy">Energy &amp; Utilities</option>
            <option value="FMCG">FMCG &amp; Consumer</option>
            <option value="Metals">Metals &amp; Mining</option>
            <option value="Realty">Infrastructure &amp; Realty</option>
            <option value="Chemicals">Chemicals &amp; Materials</option>
            <option value="Telecom">Telecom &amp; Media</option>
          </select>
        </div>
      </div>
    </div>
  );
}