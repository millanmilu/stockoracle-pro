import React from 'react';
import { SlidersHorizontal, Filter, Download, Save, Dices, Bell } from 'lucide-react';
import { REFRESH_OPTIONS } from './screenerColumns';

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
  search = '',
  onSearch,
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(9,13,28,0.8) 100%)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #6366F1, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal size={18} color="#FFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#FFF' }}>Institutional Screener</span>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC', fontSize: '0.62rem', fontWeight: 800 }}>PRO</span>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: live ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)', border: `1px solid ${live ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.35)'}`, color: live ? '#10B981' : '#F87171', fontSize: '0.62rem', fontWeight: 800 }}>
                {wsState === 'connecting' ? 'RECONNECTING' : live ? '● LIVE' : '○ OFFLINE'}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontSize: '0.62rem', fontWeight: 700 }}>
                Market: {marketStatus}
              </span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#64748B', marginTop: 2 }}>
              {scannedCount.toLocaleString('en-IN')} stocks scanned
              {dataAsOf ? <> • Last update: <strong style={{ color: '#A5B4FC' }}>{dataAsOf}</strong></> : null}
              <span style={{ color: feedLive ? '#10B981' : '#F59E0B' }}> • Data: {feedLive ? 'LIVE' : 'CACHED'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <button type="button" onClick={onToggleFilters} style={btn(filtersOpen)}><Filter size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</button>
          <button type="button" onClick={onOpenSaveModal} style={btn(false)}><Save size={13} /> Save</button>
          <button type="button" onClick={onExportCsv} style={btn(false)}><Download size={13} /> Export</button>
          <button type="button" onClick={onCreateAlert} style={btn(false)}><Bell size={13} /> Alert</button>
          <button type="button" onClick={onOpenBacktestModal} style={greenBtn}><Dices size={13} /> Backtest</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={universe} onChange={(e) => onUniverseChange && onUniverseChange(e.target.value)} style={sel} title="Exchange universe">
          {universes.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value="Equity" disabled style={{ ...sel, opacity: 0.7 }} title="Asset class"><option>Equity</option></select>
        <input value={search} onChange={(e) => onSearch && onSearch(e.target.value)} placeholder="Search Symbol / Company" style={{ ...sel, minWidth: 190 }} />
        <select value={refreshMode} onChange={(e) => onRefreshMode && onRefreshMode(e.target.value)} style={sel} title="Auto refresh">
          {REFRESH_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button type="button" onClick={onRefresh} disabled={loading} style={btn(false)}>{loading ? 'Scanning…' : 'Refresh'}</button>
      </div>
    </div>
  );
}

const btn = (active) => ({ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)', color: active ? '#A5B4FC' : '#CBD5E1', border: active ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 });
const greenBtn = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 };
const sel = { background: '#060913', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '5px 9px', color: '#F1F5F9', fontSize: '0.7rem', outline: 'none' };
