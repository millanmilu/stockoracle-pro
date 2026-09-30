// Pro Terminal V2 — Screener Table

import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Star, ExternalLink } from 'lucide-react';
import { V2_COLORS, V2_SCREENER_COLUMNS } from '../utils/constants';
import { formatPrice, formatPercent } from '../utils/formatters';

export default function V2ScreenerTable({ results }) {
  const [sortColumn, setSortColumn] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState(new Set());

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
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return data;
  }, [results, sortColumn, sortDir, searchQuery]);

  const toggleWatchlist = (symbol) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const formatCell = (row, colId) => {
    switch (colId) {
      case 'ltp': return formatPrice(row.ltp);
      case 'change': return formatPercent(row.change);
      case 'market_cap': return row.marketCap;
      case 'pe': return row.pe;
      case 'roe': return `${row.roe}%`;
      case 'roce': return `${row.roce}%`;
      case 'debt_equity': return row.debtEquity;
      case 'rsi': return row.rsi;
      case 'above_ema200': return row.aboveEma200 ? '✓' : '✗';
      default: return row[colId] || '—';
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Search */}
      <div style={{ padding: '6px 12px', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: V2_COLORS.text.muted }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols..."
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
                onClick={() => col.sortable && handleSort(col.id)}
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
          {filteredResults.map((row) => (
            <tr
              key={row.symbol}
              style={{ borderBottom: `1px solid ${V2_COLORS.bg.border}`, cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = V2_COLORS.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                    onClick={(e) => { e.stopPropagation(); toggleWatchlist(row.symbol); }}
                    title="Add to watchlist"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: watchlist.has(row.symbol) ? V2_COLORS.warning : V2_COLORS.text.muted, padding: 2, display: 'flex' }}
                  >
                    <Star size={11} fill={watchlist.has(row.symbol) ? V2_COLORS.warning : 'none'} />
                  </button>
                  <button
                    title="Open chart"
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
