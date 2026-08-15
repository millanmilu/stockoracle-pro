import React from 'react';
import { SECTORS, SIGNALS, UNIVERSES } from '../../constants/screenerConfig';
import FilterPill from './FilterPill';

/**
 * Enhanced Filter Control Panel with Index Universe Selector
 */
export default function ScreenerFilters({
  universe,
  setUniverse,
  sector,
  setSector,
  signal,
  setSignal,
  minRsi,
  setMinRsi,
  maxRsi,
  setMaxRsi,
  volumeSpike,
  setVolumeSpike,
  near52High,
  setNear52High,
  near52Low,
  setNear52Low,
  minScore,
  setMinScore,
  search,
  setSearch,
  onResetFilters,
  isFiltered
}) {
  return (
    <div className="screener-filter-panel">
      {/* Row 0: Multi-Index Universe Selector */}
      <div className="screener-filter-row" style={{ paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="screener-filter-label" style={{ color: '#A855F7' }}>INDEX</span>
        {UNIVERSES.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`screener-universe-pill ${universe === u.id ? 'active' : ''}`}
            onClick={() => setUniverse(u.id)}
          >
            <span>{u.icon}</span>
            <span>{u.id}</span>
            <span className="screener-universe-count">{u.count}</span>
          </button>
        ))}
      </div>

      {/* Row 1: Sector Pills */}
      <div className="screener-filter-row">
        <span className="screener-filter-label">SECTOR</span>
        {SECTORS.map((s) => (
          <FilterPill key={s} active={sector === s} onClick={() => setSector(s)}>
            {s}
          </FilterPill>
        ))}
      </div>

      {/* Row 2: Signal Pills */}
      <div className="screener-filter-row">
        <span className="screener-filter-label">SIGNAL</span>
        {SIGNALS.map((s) => (
          <FilterPill key={s} active={signal === s} onClick={() => setSignal(s)}>
            {s === 'All' ? 'All Signals' : s.toUpperCase()}
          </FilterPill>
        ))}

        {isFiltered && (
          <button
            type="button"
            className="screener-btn-reset"
            onClick={onResetFilters}
            style={{ marginLeft: 'auto' }}
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Row 3: Technical parameters & search */}
      <div className="screener-filter-row" style={{ paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {/* RSI Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#6B7280', fontSize: '0.74rem', fontWeight: 600 }}>RSI</span>
          <input
            type="number"
            min={0}
            max={100}
            value={minRsi}
            onChange={(e) => setMinRsi(Math.max(0, Math.min(100, +e.target.value)))}
            className="screener-input-number"
            title="Minimum RSI"
          />
          <span style={{ color: '#6B7280' }}>–</span>
          <input
            type="number"
            min={0}
            max={100}
            value={maxRsi}
            onChange={(e) => setMaxRsi(Math.max(0, Math.min(100, +e.target.value)))}
            className="screener-input-number"
            title="Maximum RSI"
          />
        </div>

        {/* Min AI Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#6B7280', fontSize: '0.74rem', fontWeight: 600 }}>MIN SCORE</span>
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Math.max(0, Math.min(100, +e.target.value)))}
            className="screener-input-number"
            title="Minimum AI Score (0-100)"
          />
        </div>

        {/* Checkbox Toggles */}
        <label className="screener-checkbox-label" style={{ color: '#F59E0B' }}>
          <input
            type="checkbox"
            checked={volumeSpike}
            onChange={(e) => setVolumeSpike(e.target.checked)}
          />
          <span>🔥 Volume Spike</span>
        </label>

        <label className="screener-checkbox-label" style={{ color: '#10B981' }}>
          <input
            type="checkbox"
            checked={near52High}
            onChange={(e) => setNear52High(e.target.checked)}
          />
          <span>⬆ Near 52W High</span>
        </label>

        <label className="screener-checkbox-label" style={{ color: '#F43F5E' }}>
          <input
            type="checkbox"
            checked={near52Low}
            onChange={(e) => setNear52Low(e.target.checked)}
          />
          <span>⬇ Near 52W Low</span>
        </label>

        {/* Search Input with Clear Button */}
        <div className="screener-search-wrap">
          <span className="screener-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search ticker or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="screener-search-input"
          />
          {search && (
            <button
              type="button"
              className="screener-search-clear"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
