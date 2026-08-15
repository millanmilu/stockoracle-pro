import React from 'react';
import { PAGE_SIZE_OPTIONS } from '../../constants/screenerConfig';

/**
 * Enhanced Screener Pagination Bar
 * @param {{
 *   totalItems: number,
 *   page: number,
 *   setPage: React.Dispatch<React.SetStateAction<number>>,
 *   pageSize: number,
 *   setPageSize: (size: number) => void,
 * }} props
 */
export default function ScreenerPagination({ totalItems, page, setPage, pageSize, setPageSize }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);

  return (
    <div className="screener-pagination-bar">
      <div className="screener-pagination-info">
        Showing <strong style={{ color: '#E2E8F0' }}>{startItem}–{endItem}</strong> of{' '}
        <strong style={{ color: '#818CF8' }}>{totalItems}</strong> matching stocks
      </div>

      <div className="screener-pagination-controls">
        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(+e.target.value);
              setPage(1);
            }}
            className="screener-page-select"
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Pagination Buttons */}
        <button
          type="button"
          onClick={() => setPage(1)}
          disabled={page === 1}
          className="screener-page-btn"
          title="First page"
        >
          «
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="screener-page-btn"
          title="Previous page"
        >
          ‹ Prev
        </button>

        <span style={{ color: '#818CF8', fontSize: '0.8rem', fontWeight: 700, padding: '0 6px' }}>
          {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="screener-page-btn"
          title="Next page"
        >
          Next ›
        </button>
        <button
          type="button"
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          className="screener-page-btn"
          title="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
