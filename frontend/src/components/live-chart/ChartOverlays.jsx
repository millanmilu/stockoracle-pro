import React from 'react';

/**
 * ChartOverlays — status overlays painted over the main chart pane:
 * first-load spinner, error badge (retry/dismiss), proxy warning pill and
 * the left-pan backfill status pill (loading / end-of-history / retry).
 */
export default function ChartOverlays({
  tk,
  loading,
  hasCandles,
  symbol,
  error,
  onRetry,
  onDismissError,
  proxyWarning,
  backfillStatus,
  onRetryBackfill,
  onDismissBackfill,
}) {
  return (
    <>
      {loading && !hasCandles && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          backgroundColor: tk.chartBg,
          color: tk.toolbarMuted,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
          fontSize: '0.85rem',
          gap: 8,
        }}>
          <div className="spinner" style={{ width: 16, height: 16 }} />
          Loading {symbol}…
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          top: 36,
          right: 68,
          zIndex: 20,
          backgroundColor: tk.menuBg,
          border: `1px solid #EF5350`,
          borderRadius: 4,
          padding: '6px 10px',
          color: '#EF5350',
          fontSize: '0.75rem',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            style={{ background: '#2962FF', border: 0, borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px' }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onDismissError}
            style={{ background: 'transparent', border: 0, color: tk.toolbarMuted, cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
      {proxyWarning && !error && (
        <div style={{
          position: 'absolute',
          top: 36,
          right: 68,
          zIndex: 20,
          backgroundColor: tk.menuBg,
          border: `1px solid ${tk.toolbarBorder}`,
          borderRadius: 4,
          padding: '6px 10px',
          color: tk.toolbarText,
          fontSize: '0.72rem',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
          maxWidth: '60%',
        }}>
          ⚠ {proxyWarning}
        </div>
      )}
      {backfillStatus && (
        <div style={{
          position: 'absolute',
          bottom: 54,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          backgroundColor: tk.menuBg,
          border: `1px solid ${backfillStatus.kind === 'error' ? '#EF5350' : tk.toolbarBorder}`,
          borderRadius: 16,
          padding: '5px 12px',
          color: backfillStatus.kind === 'error' ? '#EF5350' : tk.toolbarMuted,
          fontSize: '0.72rem',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
          whiteSpace: 'nowrap',
        }}>
          {backfillStatus.kind === 'loading' && (
            <>
              <div className="spinner" style={{ width: 12, height: 12 }} />
              <span>Loading historical data…</span>
            </>
          )}
          {backfillStatus.kind === 'end' && (
            <span>No more historical data</span>
          )}
          {backfillStatus.kind === 'error' && (
            <>
              <span>History load failed</span>
              <button
                type="button"
                onClick={onRetryBackfill}
                style={{ background: '#2962FF', border: 0, borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: '2px 10px' }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onDismissBackfill}
                style={{ background: 'transparent', border: 0, color: tk.toolbarMuted, cursor: 'pointer', fontSize: '0.72rem', padding: '0 2px' }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
