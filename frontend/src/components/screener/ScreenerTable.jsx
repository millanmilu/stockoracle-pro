import React from 'react';
import SortHeader from './SortHeader';
import ScreenerTableRow from './ScreenerTableRow';

/**
 * Screener Data Table Component
 * @param {{
 *   rows: Array<Object>,
 *   loading: boolean,
 *   sortBy: string,
 *   sortDir: 'asc'|'desc',
 *   onSort: (field: string) => void,
 *   onSelect: (ticker: string) => void,
 * }} props
 */
export default function ScreenerTable({ rows, loading, sortBy, sortDir, onSort, onSelect }) {
  if (loading) {
    return (
      <div className="screener-table-container" style={{ padding: '60px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="screener-table-container">
      <table className="screener-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <SortHeader field="price" label="Price" sortBy={sortBy} sortDir={sortDir} onClick={onSort} />
            <SortHeader field="change" label="Change%" sortBy={sortBy} sortDir={sortDir} onClick={onSort} />
            <th>Trend</th>
            <SortHeader field="ai_score" label="AI Score" sortBy={sortBy} sortDir={sortDir} onClick={onSort} />
            <th>Signal</th>
            <SortHeader field="predicted_pct" label="7D Return" sortBy={sortBy} sortDir={sortDir} onClick={onSort} />
            <th>7D Target / Stop</th>
            <SortHeader field="rsi" label="RSI" sortBy={sortBy} sortDir={sortDir} onClick={onSort} />
            <SortHeader field="volume_ratio" label="Vol Ratio" sortBy={sortBy} sortDir={sortDir} onClick={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-text">No stocks match your active filter criteria</div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <ScreenerTableRow key={row.ticker} row={row} onSelect={onSelect} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
