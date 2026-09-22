import React, { useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ScreenerTableRow from './ScreenerTableRow';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { groupColumnsWithTicker } from './screenerColumns';
import { TN } from './terminalTheme';

// Fixed body-row pitch (tr height 32 + 1px collapsed border). Rows are rigid
// single-line cells, so a constant estimate keeps the virtualizer exact with
// zero measurement overhead.
const ROW_PITCH = 33;

const defaultWidth = (col) => {
  if (col.key === 'ticker') return 104;
  if (col.key === 'name') return 190;
  if (col.key === 'sector') return 140;
  if (col.key === 'close_price') return 104;
  if (col.key === 'change_1d_pct') return 82;
  if (col.key === 'market_cap_cr') return 104;
  if (col.key === 'ai_signal') return 108;
  if (col.key === 'trend_hint') return 92;
  if (col.key === 'rsi_14' || col.key === 'ai_consensus_score') return 74;
  if (col.key === 'volume_ratio_20d') return 76;
  return col.numeric ? 88 : 108;
};

export default function ScreenerTable({
  rows = [],
  loading = false,
  sortBy = 'market_cap_cr',
  sortDir = 'desc',
  multiSort = [],
  onSort,
  columnGroup = 'overview',
  visibleColumns = null,
  columnOrder = null,
  columnWidths = {},
  onResizeColumn,
  onResizeCommit,
  selectedTickers = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  onInspect,
  onNavigateChart,
  onNavigateFundamentals,
  onAddWatchlist,
  onAlertFor,
  liveTicks = {},
  // Ref of the outer vertical scroll container (owned by AdvancedScreener).
  // The virtualizer renders only visible rows, so 500+ matches scroll
  // smoothly with ~30 rows in the DOM instead of paged slices.
  scrollRef = null,
}) {
  const isAllSelected = rows.length > 0 && rows.every(r => selectedTickers.has(r.ticker));
  const isSomeSelected = rows.some(r => selectedTickers.has(r.ticker)) && !isAllSelected;

  // Single column-group model: the tab strip sets `columnGroup` directly, so
  // there is no separate "active tab" that could disagree with it.
  const groupId = columnGroup;
  const allCols = groupColumnsWithTicker(groupId === 'all' ? 'all' : groupId);
  // User order first, then visibility filter. Both optional and backwards compatible.
  const ordered = columnOrder && columnOrder.length
    ? [...allCols].sort((a, b) => {
        const ia = columnOrder.indexOf(a.key);
        const ib = columnOrder.indexOf(b.key);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
    : allCols;
  const cols = visibleColumns && visibleColumns.length
    ? ordered.filter((c) => visibleColumns.includes(c.key))
    : ordered;

  const getSortIcon = (field) => {
    const multi = (multiSort || []).find((m) => m.key === field);
    const dir = multi ? multi.dir : (sortBy === field ? sortDir : null);
    if (!dir) return <ArrowUpDown size={10} style={{ opacity: 0.35 }} />;
    return dir === 'asc' ? <ChevronUp size={12} color="#22C55E" /> : <ChevronDown size={12} color="#22C55E" />;
  };

  const beginResize = useCallback((e, key, startWidth) => {
    if (!onResizeColumn) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const handle = e.currentTarget;
    handle.classList.add('active');
    let last = startWidth;
    const onMove = (mv) => {
      const next = Math.max(56, Math.min(340, startWidth + (mv.clientX - startX)));
      last = Math.round(next);
      onResizeColumn(key, last);
    };
    const onUp = () => {
      handle.classList.remove('active');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // Persist once, at the end of the drag (not on every mousemove).
      if (onResizeCommit) onResizeCommit(key, last);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onResizeColumn, onResizeCommit]);

  // Virtualized body: spacer rows above/below preserve the full scroll height
  // inside the single shared <table>, so sticky header, colgroup widths and
  // horizontal scroll keep working untouched. Hooks stay above the loading
  // early-return so hook order never changes between renders.
  // Stable getter so the virtualizer doesn't re-subscribe observers on every
  // render (live ticks re-render rows frequently).
  const getScrollElement = useCallback(() => scrollRef?.current ?? null, [scrollRef]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: () => ROW_PITCH,
    overscan: 12,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const topPad = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const bottomPad = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  // New result set (new search / sort / filter) starts at the top. Row-array
  // identity only changes when the result set itself changes — live ticks and
  // selection flow through separate props, so scrolling is never disturbed.
  useEffect(() => {
    const el = scrollRef?.current;
    if (el) el.scrollTop = 0;
  }, [rows, scrollRef]);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <div className="tn-spin" style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(124,140,248,0.25)', borderTopColor: '#7C8CF8' }} />
        <div style={{ color: '#7C8CF8', fontSize: 12, fontWeight: 600 }}>Executing quantitative screen query…</div>
      </div>
    );
  }

  return (
    <div className="tn-table-shell">
      <table style={{ fontSize: 12, fontFamily: TN.mono, width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <colgroup>
          <col style={{ width: 30 }} />
          <col style={{ width: 44 }} />
          {cols.map((c) => (
            <col key={c.key} style={{ width: columnWidths[c.key] || defaultWidth(c) }} />
          ))}
          <col style={{ width: 216, minWidth: 216 }} />
        </colgroup>
        <thead style={{ position: 'sticky', top: 0, background: '#0A0F1E', zIndex: 10, boxShadow: '0 1px 0 rgba(148,163,184,0.14)' }}>
          <tr style={{ borderBottom: `1px solid ${TN.borderStrong}`, color: TN.muted, textAlign: 'right' }}>
            <th style={{ textAlign: 'center', padding: 8, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={isAllSelected} ref={el => { if (el) el.indeterminate = isSomeSelected; }} onChange={onToggleSelectAll} style={{ cursor: 'pointer', accentColor: '#7C8CF8' }} />
            </th>
            <th style={{ textAlign: 'left', padding: 8, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>Rank</th>
            {cols.map((c) => {
              const left = c.key === 'ticker' || c.key === 'name' || c.key === 'sector';
              return (
                <th
                  key={c.key}
                  onClick={(e) => onSort && onSort(c.key, e)}
                  title="Click to sort (Shift-click for multi-sort). Drag right edge to resize."
                  style={{ padding: 8, cursor: 'pointer', textAlign: left ? 'left' : 'right', whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', fontSize: 11, fontWeight: 700, color: sortBy === c.key ? TN.accent : TN.muted }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: left ? 'flex-start' : 'flex-end', overflow: 'hidden' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span> {getSortIcon(c.key)}
                  </div>
                  {onResizeColumn && (
                    <span className="tn-resizer" onMouseDown={(e) => beginResize(e, c.key, columnWidths[c.key] || defaultWidth(c))} onClick={(e) => e.stopPropagation()} title="Drag to resize column" />
                  )}
                </th>
              );
            })}
            <th style={{ padding: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length + 3} style={{ textAlign: 'center', padding: '48px 0', color: TN.faint }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: TN.muted }}>No stocks matched active criteria</div>
                <div style={{ fontSize: 11, color: TN.faint, marginTop: 4 }}>Try adjusting filters or relaxing your formula query</div>
              </td>
            </tr>
          ) : (
            <>
              {topPad > 0 && (
                <tr aria-hidden="true" style={{ height: topPad }}>
                  <td colSpan={cols.length + 3} style={{ padding: 0, border: 'none', height: topPad }} />
                </tr>
              )}
              {virtualItems.map((vi) => {
                const row = rows[vi.index];
                return (
                  <ScreenerTableRow
                    key={row.ticker || vi.index}
                    row={row}
                    index={vi.index}
                    columns={cols}
                    isSelected={selectedTickers.has(row.ticker)}
                    onToggleSelect={onToggleSelect}
                    onInspect={onInspect}
                    onNavigateChart={onNavigateChart}
                    onNavigateFundamentals={onNavigateFundamentals}
                    onAddWatchlist={onAddWatchlist}
                    onAlertFor={onAlertFor}
                    liveTick={liveTicks[row.ticker]}
                  />
                );
              })}
              {bottomPad > 0 && (
                <tr aria-hidden="true" style={{ height: bottomPad }}>
                  <td colSpan={cols.length + 3} style={{ padding: 0, border: 'none', height: bottomPad }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
