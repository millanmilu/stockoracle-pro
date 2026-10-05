import { Search } from 'lucide-react';
import { COLUMN_GROUPS } from './screenerColumns';
import ScreenerColumnMenu from './ScreenerColumnMenu';
import { TN, panel, btn, input } from './terminalTheme';

// Category navigation + rank + search — tabs own full-width row, controls second row
export function ScreenerToolbar({
  columnGroup, setColumnGroup, showColumnMenu, setShowColumnMenu, groupHidden, groupOrderedCols,
  toggleColumn, moveColumn, resetWidths, sortColumn, rankByChange, rankOptions, multiSort, setMultiSort,
  searchFilter, setSearchFilter, queryMeta, processedResults,
}) {
  return (
      <div style={panel({ padding: '2px 12px 6px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 0, width: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'visible' })}>
        <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', minWidth: 0 }}>
          <nav className="tn-tabs" aria-label="Column groups" style={{ display: 'flex', flex: '1 1 auto', minWidth: 0, overflow: 'visible', flexWrap: 'nowrap' }}>
            {[{ id: 'overview', label: 'Overview' }, ...COLUMN_GROUPS.filter((g) => g.id !== 'overview')].map(t => (
              <button key={t.id} onClick={() => setColumnGroup(t.id)} aria-pressed={columnGroup === t.id} className={`tn-tab${columnGroup === t.id ? ' active' : ''}`}>{t.label}</button>
            ))}
          </nav>
          <div style={{ position: 'relative', flexShrink: 0, paddingBottom: 4, paddingLeft: 8 }}>
            <button type="button" onClick={() => setShowColumnMenu((v) => !v)} aria-expanded={showColumnMenu} title="Show, hide and reorder columns" style={btn(showColumnMenu, { height: 26, whiteSpace: 'nowrap' })}>Columns{groupHidden.length ? ` (${groupOrderedCols.length - groupHidden.length}/${groupOrderedCols.length})` : ''} ▾</button>
            {showColumnMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 110, cursor: 'default' }}
                  onClick={() => setShowColumnMenu(false)}
                  aria-hidden="true"
                />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 120 }}>
                  <ScreenerColumnMenu
                    columns={groupOrderedCols}
                    isVisible={(k) => !groupHidden.includes(k)}
                    onToggle={toggleColumn}
                    onMove={moveColumn}
                    onResetWidths={resetWidths}
                    onClose={() => setShowColumnMenu(false)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, flexWrap: 'wrap', borderTop: `1px solid ${TN.border}`, marginTop: 2, width: '100%', minWidth: 0 }}>
          <label style={{ fontSize: 11, color: TN.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>Rank by:</label>
          <select value={sortColumn} onChange={(e) => rankByChange(e.target.value)} style={input({ height: 26, padding: '0 6px', fontSize: 12 })}>
            {rankOptions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {multiSort.length > 0 && (
            <button onClick={() => setMultiSort([])} style={{ fontSize: 11, color: TN.warn, background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear multi-sort ({multiSort.length})</button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: TN.inset, borderRadius: TN.radius, padding: '3px 8px', border: `1px solid ${TN.border}`, flex: '1 1 160px', minWidth: 140, maxWidth: 300 }}>
            <Search size={12} color={TN.faint} />
            <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Search ticker, name…" aria-label="Filter results by ticker or name" style={{ background: 'transparent', border: 'none', color: TN.text, fontSize: 12, outline: 'none', width: '100%', minWidth: 0 }} />
          </div>
          <div style={{ fontSize: 12, color: TN.muted, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 'auto' }} title={queryMeta.universeTotal ? `${processedResults.length} after client filters · ${queryMeta.total} matched on server${queryMeta.universe ? ` · universe ${queryMeta.universe} (${queryMeta.universeScoped ?? '?'})` : ''} · ${queryMeta.universeTotal} stocks tracked` : undefined}><strong style={{ color: TN.up, fontFamily: TN.mono }}>{processedResults.length}</strong> matches{queryMeta.universe && queryMeta.universeScoped != null ? <span style={{ color: TN.faint }}> in {queryMeta.universe} ({queryMeta.universeScoped})</span> : queryMeta.universeTotal > 0 ? <span style={{ color: TN.faint }}> of {queryMeta.universeTotal} stocks</span> : null}</div>
        </div>
      </div>
  );
}
