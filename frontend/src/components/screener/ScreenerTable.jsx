import React from 'react';
import SortHeader from './SortHeader';
import ScreenerTableRow from './ScreenerTableRow';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { columnsForGroup } from './screenerColumns';

export default function ScreenerTable({
  rows = [],
  loading = false,
  sortBy = 'market_cap_cr',
  sortDir = 'desc',
  multiSort = [],
  onSort,
  activeTab = 'all',
  columnGroup = 'overview',
  visibleColumns = null,
  selectedTickers = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  onInspect,
  onNavigateChart,
  onNavigateFundamentals,
  liveTicks = {}
}) {
  const isAllSelected = rows.length > 0 && rows.every(r => selectedTickers.has(r.ticker));
  const isSomeSelected = rows.some(r => selectedTickers.has(r.ticker)) && !isAllSelected;

  const groupId = activeTab && activeTab !== 'all' ? activeTab : columnGroup;
  const allCols = columnsForGroup(groupId === 'all' ? 'all' : groupId);
  const cols = visibleColumns && visibleColumns.length
    ? allCols.filter((c) => visibleColumns.includes(c.key))
    : allCols;

  const getSortIcon = (field) => {
    const multi = (multiSort || []).find((m) => m.key === field);
    const dir = multi ? multi.dir : (sortBy === field ? sortDir : null);
    if (!dir) return <ArrowUpDown size={10} style={{ opacity: 0.35 }} />;
    return dir === 'asc' ? <ChevronUp size={12} color="#10B981" /> : <ChevronDown size={12} color="#10B981" />;
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <div className="spinner" />
        <div style={{ color: '#818CF8', fontSize: '0.78rem', fontWeight: 600 }}>Executing quantitative screen query...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace' }}>
        <thead style={{ position: 'sticky', top: 0, background: '#0C1124', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right' }}>
            <th style={{ textAlign: 'center', padding: '8px', width: 30 }}>
              <input type="checkbox" checked={isAllSelected} ref={el => { if (el) el.indeterminate = isSomeSelected; }} onChange={onToggleSelectAll} style={{ cursor: 'pointer', accentColor: '#6366F1' }} />
            </th>
            <th style={{ textAlign: 'left', padding: '8px', width: 44 }}>Rank</th>
            {cols.map((c) => (
              <th key={c.key} onClick={(e) => onSort && onSort(c.key, e)} title="Click to sort (Shift-click for multi-sort)" style={{ padding: '8px', cursor: 'pointer', textAlign: c.key === 'ticker' || c.key === 'name' || c.key === 'sector' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: c.key === 'ticker' || c.key === 'name' || c.key === 'sector' ? 'flex-start' : 'flex-end' }}>
                  {c.label} {getSortIcon(c.key)}
                </div>
              </th>
            ))}
            <th style={{ padding: '8px', textAlign: 'center', width: 96 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length + 3} style={{ textAlign: 'center', padding: '50px 0', color: '#64748B' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📭</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>No stocks matched active criteria</div>
                <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 4 }}>Try adjusting filters or relaxing your formula query</div>
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <ScreenerTableRow
                key={row.ticker || idx}
                row={row}
                index={idx}
                columns={cols}
                isSelected={selectedTickers.has(row.ticker)}
                onToggleSelect={onToggleSelect}
                onInspect={onInspect}
                onNavigateChart={onNavigateChart}
                onNavigateFundamentals={onNavigateFundamentals}
                liveTick={liveTicks[row.ticker]}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
