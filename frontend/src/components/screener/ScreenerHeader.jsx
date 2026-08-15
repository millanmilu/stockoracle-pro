import React from 'react';

/**
 * Screener Header with Actions
 * @param {{ onExportCsv: () => void, onRefresh: () => void, loading: boolean }} props
 */
export default function ScreenerHeader({ onExportCsv, onRefresh, loading }) {
  return (
    <div className="screener-header">
      <div>
        <h2 className="screener-title">
          <span>⚡</span> Advanced AI Stock Screener
        </h2>
        <p className="screener-subtitle">
          Real-time scanning across 30+ large-cap stocks for RSI divergences, volume surges, breakout trends & AI targets
        </p>
      </div>
      <div className="screener-actions">
        <button
          type="button"
          className="screener-btn screener-btn-refresh"
          onClick={onRefresh}
          disabled={loading}
          title="Reload screener data"
        >
          <span style={{ display: 'inline-block', transform: loading ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }}>
            🔄
          </span>
          {loading ? 'Scanning...' : 'Refresh'}
        </button>
        <button
          type="button"
          className="screener-btn screener-btn-export"
          onClick={onExportCsv}
          title="Download current filtered results as CSV"
        >
          <span>⬇</span> Export CSV
        </button>
      </div>
    </div>
  );
}
