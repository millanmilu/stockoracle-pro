import React from 'react';
import SortHeader from './SortHeader';
import ScreenerTableRow from './ScreenerTableRow';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

export default function ScreenerTable({ 
  rows = [], 
  loading = false, 
  sortBy = 'market_cap_cr', 
  sortDir = 'desc', 
  onSort, 
  activeTab = 'all',
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

  const getSortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown size={10} style={{ opacity: 0.35 }} />;
    return sortDir === 'asc' 
      ? <ChevronUp size={12} color="#10B981" /> 
      : <ChevronDown size={12} color="#10B981" />;
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
            {/* Select All Checkbox */}
            <th style={{ textAlign: 'center', padding: '8px', width: 30 }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                onChange={onToggleSelectAll}
                style={{ cursor: 'pointer', accentColor: '#6366F1' }}
              />
            </th>

            <th style={{ textAlign: 'left', padding: '8px', width: 35 }}>#</th>

            <th onClick={() => onSort('ticker')} style={{ textAlign: 'left', padding: '8px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Ticker {getSortIcon('ticker')}</div>
            </th>

            <th onClick={() => onSort('sector')} style={{ textAlign: 'left', padding: '8px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Sector {getSortIcon('sector')}</div>
            </th>

            <th onClick={() => onSort('close_price')} style={{ padding: '8px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>Price ₹ {getSortIcon('close_price')}</div>
            </th>

            <th onClick={() => onSort('change_1d_pct')} style={{ padding: '8px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>1D % {getSortIcon('change_1d_pct')}</div>
            </th>

            {(activeTab === 'all' || activeTab === 'valuation') && (
              <>
                <th onClick={() => onSort('pe_ratio')} style={{ padding: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>P/E {getSortIcon('pe_ratio')}</div>
                </th>
                <th onClick={() => onSort('roce_pct')} style={{ padding: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>ROCE % {getSortIcon('roce_pct')}</div>
                </th>
                <th onClick={() => onSort('debt_to_equity')} style={{ padding: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>D/E {getSortIcon('debt_to_equity')}</div>
                </th>
              </>
            )}

            {(activeTab === 'all' || activeTab === 'technical') && (
              <>
                <th onClick={() => onSort('rsi_14')} style={{ padding: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>RSI (14) {getSortIcon('rsi_14')}</div>
                </th>
                <th onClick={() => onSort('volume_ratio_20d')} style={{ padding: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>Vol Surge {getSortIcon('volume_ratio_20d')}</div>
                </th>
              </>
            )}

            {(activeTab === 'all' || activeTab === 'ai') && (
              <th onClick={() => onSort('ai_consensus_score')} style={{ padding: '8px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>AI Score {getSortIcon('ai_consensus_score')}</div>
              </th>
            )}

            {activeTab === 'all' && (
              <th style={{ padding: '8px', textAlign: 'center', width: 90 }}>52W Range</th>
            )}

            <th style={{ padding: '8px', textAlign: 'center', width: 90 }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12} style={{ textAlign: 'center', padding: '50px 0', color: '#64748B' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📭</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>No stocks matched active criteria</div>
                <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 4 }}>Try adjusting sliders or relaxing your formula query</div>
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <ScreenerTableRow
                key={row.ticker || idx}
                row={row}
                index={idx}
                activeTab={activeTab}
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
