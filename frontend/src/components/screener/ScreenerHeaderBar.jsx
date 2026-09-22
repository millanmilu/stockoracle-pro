import React from 'react';
import { Filter, Download, Save, FlaskConical, Bell } from 'lucide-react';
import { REFRESH_OPTIONS } from './screenerColumns';
import { TN, panel, btn, btnGreen, input } from './terminalTheme';

/**
 * Institutional screener header. Flat two-row bar:
 * title + live status + actions, then universe/search/refresh controls.
 * Render-only — all props and callbacks unchanged.
 */
export default function ScreenerHeaderBar({
  filtersOpen,
  onToggleFilters,
  activeFilterCount = 0,
  dataAsOf,
  marketStatus = 'UNKNOWN',
  feedLive = false,
  wsState = 'idle',
  scannedCount = 0,
  universe = 'ALL NSE',
  onUniverseChange,
  universes = ['ALL NSE'],
  refreshMode = 'manual',
  onRefreshMode,
  onExportCsv,
  onOpenSaveModal,
  onOpenBacktestModal,
  onCreateAlert,
  onRefresh,
  loading = false,
}) {
  const live = wsState === 'live' || feedLive;
  const wsLabel = wsState === 'connecting' || wsState === 'reconnecting'
    ? 'RECONNECTING'
    : live ? '● LIVE' : '○ OFFLINE';
  return (
    <div style={panel({ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 7 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: TN.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Institutional Screener</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: TN.accent, border: `1px solid rgba(124,140,248,0.4)`, background: 'rgba(124,140,248,0.10)', borderRadius: 3, padding: '1px 5px' }}>PRO</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: live ? TN.up : TN.down }}>{wsLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: TN.faint }}>
            {scannedCount.toLocaleString('en-IN')} stocks scanned · {dataAsOf ? <>{dataAsOf} · </> : null}NSE
            <span style={{ color: feedLive ? TN.up : TN.warn }}> · {feedLive ? 'LIVE' : 'CACHED'}</span>
            <span style={{ color: TN.faint }}> · Market: {marketStatus}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={onToggleFilters} style={btn(filtersOpen)}><Filter size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</button>
          <button type="button" onClick={onOpenSaveModal} style={btn()}><Save size={13} /> Save</button>
          <button type="button" onClick={onExportCsv} style={btn()}><Download size={13} /> Export</button>
          <button type="button" onClick={onCreateAlert} style={btn()}><Bell size={13} /> Alert</button>
          <button type="button" onClick={onOpenBacktestModal} style={btnGreen()}><FlaskConical size={13} /> Backtest</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={universe} onChange={(e) => onUniverseChange && onUniverseChange(e.target.value)} title="Exchange universe" style={input({ height: 28, padding: '0 8px' })}>
          {universes.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {/* No search box here — the results toolbar (next to "Rank by" and the
            match counter) owns the single search input; two inputs bound to the
            same state were confusing and could drift out of sync. */}
        <select value={refreshMode} onChange={(e) => onRefreshMode && onRefreshMode(e.target.value)} title="Auto refresh" style={input({ height: 28, padding: '0 8px' })}>
          {REFRESH_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button type="button" onClick={onRefresh} disabled={loading} style={btn(false, { opacity: loading ? 0.6 : 1 })}>{loading ? 'Scanning…' : 'Refresh'}</button>
      </div>
    </div>
  );
}
