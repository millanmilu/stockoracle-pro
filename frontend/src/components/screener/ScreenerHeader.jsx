import React from 'react';

/**
 * Screener Header with View Switcher, Live Auto-Scan Toggle, and Actions
 * @param {{
 *   onExportCsv: () => void,
 *   onRefresh: () => void,
 *   loading: boolean,
 *   viewMode: 'table' | 'cards' | 'sectors',
 *   setViewMode: (mode: 'table' | 'cards' | 'sectors') => void,
 *   autoRefresh: boolean,
 *   setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>,
 *   autoRefreshTimer: number
 * }} props
 */
export default function ScreenerHeader({
  onExportCsv,
  onRefresh,
  loading,
  viewMode,
  setViewMode,
  autoRefresh,
  setAutoRefresh,
  autoRefreshTimer
}) {
  return (
    <div className="screener-header">
      <div>
        <h2 className="screener-title">
          <span>⚡</span> Advanced AI Stock Screener
        </h2>
        <p className="screener-subtitle">
          Scanning 30+ large-cap stocks for RSI divergences, volume breakouts, 52W extremes & predictive AI targets
        </p>
      </div>

      <div className="screener-actions">
        {/* View Mode Toggle */}
        <div className="screener-view-toggle">
          <button
            type="button"
            className={`screener-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Table View"
          >
            📊 Table
          </button>
          <button
            type="button"
            className={`screener-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title="Card Grid View"
          >
            🎴 Cards
          </button>
          <button
            type="button"
            className={`screener-view-btn ${viewMode === 'sectors' ? 'active' : ''}`}
            onClick={() => setViewMode('sectors')}
            title="Sector Sentiment Map"
          >
            🌡️ Sectors
          </button>
        </div>

        {/* Live Auto-Refresh Switch */}
        <button
          type="button"
          className={`screener-btn ${autoRefresh ? 'screener-btn-auto-active' : 'screener-btn-refresh'}`}
          onClick={() => setAutoRefresh((prev) => !prev)}
          title="Toggle Auto-Scan (every 30s)"
        >
          <span>{autoRefresh ? '🟢' : '⚪'}</span>
          {autoRefresh ? `Auto-Scan (${autoRefreshTimer}s)` : 'Live Auto-Scan'}
        </button>

        {/* Manual Refresh */}
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

        {/* Export CSV */}
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
