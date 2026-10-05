// Pro Terminal V2 — Screener Table

import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Search, Star, ExternalLink } from 'lucide-react';
import { V2_COLORS, V2_SCREENER_COLUMNS } from '../utils/constants';
import { formatPrice, formatPercent } from '../utils/formatters';

export default function V2ScreenerTable({
  results,
  onOpenSymbol,
  watchlist,
  onToggleWatchlist,
}) {
  const [sortColumn, setSortColumn] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (colId) => {
    if (sortColumn === colId) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colId);
      setSortDir('desc');
    }
  };

  const filteredResults = useMemo(() => {
    let data = [...results];

    if (searchQuery) {
      data = data.filter((r) => r.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    data.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        const cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      }
      // Null/undefined sort to the bottom regardless of direction
      const an = aVal == null ? (sortDir === 'asc' ? Infinity : -Infinity) : aVal;
      const bn = bVal == null ? (sortDir === 'asc' ? Infinity : -Infinity) : bVal;
      return sortDir === 'asc' ? an - bn : bn - an;
    });

    return data;
  }, [results, sortColumn, sortDir, searchQuery]);

  const formatCell = (row, colId) => {
    switch (colId) {
      case 'ltp': return formatPrice(row.ltp);
      case 'change': return formatPercent(row.change);
      case 'marketCap': return row.marketCap == null ? '—' : `${(row.marketCap / 100).toFixed(2)} LCr`;
      case 'pe': return row.pe;
      case 'roe': return `${row.roe}%`;
      case 'roce': return `${row.roce}%`;
      case 'debtEquity': return row.debtEquity;
      case 'rsi': return row.rsi;
      case 'aboveEma200': return row.aboveEma200 ? '✓' : '✗';
      default: return row[colId] ?? '—';
    }
  };

  const isWatched = (symbol) => Boolean(watchlist && watchlist.has(symbol));

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Search */}
      <div style={{ padding: '6px 12px', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} aria-hidden="true" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: V2_COLORS.text.muted }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols..."
            aria-label="Search screener results"
            style={{
              width: '100%',
              padding: '5px 8px 5px 26px',
              fontSize: 11,
              color: V2_COLORS.text.primary,
              background: V2_COLORS.bg.tertiary,
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 4,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, background: V2_COLORS.bg.secondary, zIndex: 1 }}>
            {V2_SCREENER_COLUMNS.map((col) => (
              <th
                key={col.id}
                aria-sort={col.sortable
                  ? (sortColumn === col.id ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none')
                  : undefined}
                tabIndex={col.sortable ? 0 : undefined}
                onClick={() => col.sortable && handleSort(col.id)}
                onKeyDown={(e) => {
                  if (col.sortable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleSort(col.id);
                  }
                }}
                style={{
                  padding: '6px 8px',
                  textAlign: col.id === 'rank' || col.id === 'symbol' ? 'left' : 'right',
                  color: V2_COLORS.text.muted,
                  fontWeight: 600,
                  fontSize: 10,
                  borderBottom: `1px solid ${V2_COLORS.bg.border}`,
                  cursor: col.sortable ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: col.id === 'rank' || col.id === 'symbol' ? 'flex-start' : 'flex-end' }}>
                  {col.label}
                  {col.sortable && sortColumn === col.id && (
                    sortDir === 'asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />
                  )}
                </div>
              </th>
            ))}
            <th style={{ padding: '6px 8px', width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {filteredResults.length === 0 && (
            <tr>
              <td colSpan={V2_SCREENER_COLUMNS.length + 1} style={{
                padding: '16px 8px',
                textAlign: 'center',
                color: V2_COLORS.text.muted,
                fontSize: 11,
              }}>
                No stocks match the current filters. Remove a filter or press Scan.
              </td>
            </tr>
          )}
          {filteredResults.map((row) => (
            <tr
              key={row.symbol}
              onClick={() => onOpenSymbol?.(row.symbol)}
              title={`Open ${row.symbol} chart`}
              style={{ borderBottom: `1px solid ${V2_COLORS.bg.border}`, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = V2_COLORS.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {V2_SCREENER_COLUMNS.map((col) => (
                <td
                  key={col.id}
                  style={{
                    padding: '5px 8px',
                    textAlign: col.id === 'rank' || col.id === 'symbol' ? 'left' : 'right',
                    color: col.id === 'change'
                      ? row.change >= 0 ? V2_COLORS.positive : V2_COLORS.negative
                      : col.id === 'symbol' ? V2_COLORS.text.primary : V2_COLORS.text.secondary,
                    fontWeight: col.id === 'symbol' ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatCell(row, col.id)}
                </td>
              ))}
              <td style={{ padding: '5px 4px' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleWatchlist?.(row.symbol); }}
                    title={isWatched(row.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                    aria-label={isWatched(row.symbol) ? `Remove ${row.symbol} from watchlist` : `Add ${row.symbol} to watchlist`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isWatched(row.symbol) ? V2_COLORS.warning : V2_COLORS.text.muted, padding: 2, display: 'flex' }}
                  >
                    <Star size={11} fill={isWatched(row.symbol) ? V2_COLORS.warning : 'none'} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenSymbol?.(row.symbol); }}
                    title="Open chart"
                    aria-label={`Open ${row.symbol} chart`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: V2_COLORS.text.muted, padding: 2, display: 'flex' }}
                  >
                    <ExternalLink size={11} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
