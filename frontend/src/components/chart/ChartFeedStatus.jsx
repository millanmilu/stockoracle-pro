import React from 'react';

/**
 * ChartFeedStatus - Manages loading states, empty/error fallbacks,
 * live feed connection badge, and stale data banner overlays on the chart canvas.
 */
export default function ChartFeedStatus({
  loading = false,
  selectedSymbol = '',
  rawHistory = null,
  historyFetchError = null,
  setHistoryFetchError = () => {},
  setLoading = () => {},
  fetchHistory = () => Promise.resolve({ candles: [] }),
  setRawHistory = () => {},
  interval = '1d',
  timeframe = '1Y',
  historyReqSeqRef = { current: 0 },
  wsConnected = false,
  wsIsLive = false,
}) {
  // Compute client-side IST market hours for badge and stale banner
  const nowUt = Date.now();
  const istOff = 5.5 * 3600 * 1000;
  const istD = new Date(nowUt + istOff);
  const iDay = istD.getUTCDay();
  const iHr = istD.getUTCHours();
  const iMin = istD.getUTCMinutes();
  const clientOpen =
    iDay >= 1 &&
    iDay <= 5 &&
    (iHr > 9 || (iHr === 9 && iMin >= 15)) &&
    (iHr < 15 || (iHr === 15 && iMin <= 30));

  let label, dotColor, bgColor, borderColor, titleText;
  if (!wsConnected) {
    label = 'DISCONNECTED';
    dotColor = '#EF4444';
    bgColor = 'rgba(239,68,68,0.12)';
    borderColor = 'rgba(239,68,68,0.35)';
    titleText = 'WebSocket disconnected — attempting to reconnect';
  } else if (!clientOpen) {
    label = 'MARKET CLOSED';
    dotColor = '#64748B';
    bgColor = 'rgba(100,116,139,0.12)';
    borderColor = 'rgba(100,116,139,0.3)';
    titleText = 'NSE market is closed (9:15–15:30 IST weekdays). Showing last close price.';
  } else if (wsIsLive) {
    label = 'LIVE';
    dotColor = '#10B981';
    bgColor = 'rgba(16,185,129,0.12)';
    borderColor = 'rgba(16,185,129,0.3)';
    titleText = 'Live NSE price feed via Angel One — candles updating in real-time';
  } else {
    label = 'CACHED';
    dotColor = '#F59E0B';
    bgColor = 'rgba(245,158,11,0.12)';
    borderColor = 'rgba(245,158,11,0.3)';
    titleText = 'Angel One API unavailable — showing cached/delayed price data';
  }

  const handleRetry = () => {
    setHistoryFetchError(null);
    setLoading(true);
    const seq = ++historyReqSeqRef.current;
    fetchHistory(selectedSymbol, interval, timeframe)
      .then((result) => {
        if (seq !== historyReqSeqRef.current) return;
        setRawHistory(result?.candles ?? []);
        if (!result?.candles?.length) {
          setHistoryFetchError('Still no data. Check backend & Angel One session.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (seq !== historyReqSeqRef.current) return;
        setHistoryFetchError(`Retry failed: ${err?.message || 'Unknown error'}`);
        setRawHistory([]);
        setLoading(false);
      });
  };

  const handleTry1Y = () => {
    setHistoryFetchError(null);
    setLoading(true);
    const seq = ++historyReqSeqRef.current;
    fetchHistory(selectedSymbol, '1d', '1Y')
      .then((r) => {
        if (seq !== historyReqSeqRef.current) return;
        setRawHistory(r?.candles ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (seq !== historyReqSeqRef.current) return;
        setLoading(false);
      });
  };

  return (
    <>
      {/* ── Loading Spinner Overlay ── */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#070A14',
            zIndex: 25,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '3px solid rgba(168,85,247,0.2)',
              borderTopColor: '#A855F7',
              animation: 'spin 0.75s linear infinite',
            }}
          />
          <span
            style={{
              fontSize: '0.78rem',
              color: '#94A3B8',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
            }}
          >
            Loading {selectedSymbol} candles…
          </span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Empty / Error State Overlay ── */}
      {!loading && (!Array.isArray(rawHistory) || rawHistory.length === 0) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(7,10,20,0.97)',
            zIndex: 24,
            gap: 14,
            padding: 20,
          }}
        >
          <div style={{ fontSize: '2rem' }}>📉</div>
          <div
            style={{
              fontSize: '0.88rem',
              color: '#F0F0FF',
              fontWeight: 800,
              textAlign: 'center',
            }}
          >
            No Chart Data for {selectedSymbol}
          </div>
          {historyFetchError ? (
            <div
              style={{
                fontSize: '0.72rem',
                color: '#EF5350',
                textAlign: 'center',
                maxWidth: 380,
                lineHeight: 1.6,
                fontFamily: 'JetBrains Mono, monospace',
                padding: '8px 12px',
                background: 'rgba(239,83,80,0.08)',
                border: '1px solid rgba(239,83,80,0.25)',
                borderRadius: 6,
              }}
            >
              ⚠️ {historyFetchError}
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.72rem',
                color: '#94A3B8',
                textAlign: 'center',
                maxWidth: 360,
                lineHeight: 1.6,
              }}
            >
              No historical candles found. Backend may be offline or this symbol has no data in the database yet.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '7px 18px',
                borderRadius: 6,
                border: 'none',
                background: '#6366F1',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              🔄 Retry
            </button>
            <button
              onClick={handleTry1Y}
              style={{
                padding: '7px 18px',
                borderRadius: 6,
                border: '1px solid rgba(99,102,241,0.35)',
                background: 'rgba(99,102,241,0.1)',
                color: '#818CF8',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Try 1Y Data
            </button>
          </div>
        </div>
      )}

      {/* ── Feed Status Badge (top-right of chart) ── */}
      {!loading && (
        <div
          title={titleText}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 4,
            background: bgColor,
            border: `1px solid ${borderColor}`,
            fontSize: '0.68rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            color: dotColor,
            pointerEvents: 'auto',
            cursor: 'help',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: dotColor,
              boxShadow: wsConnected && wsIsLive ? `0 0 6px ${dotColor}` : 'none',
              animation: wsConnected && wsIsLive ? 'livePulse 1.5s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          {label}
        </div>
      )}

      {/* ── Stale Data Warning Banner ── */}
      {!loading && wsConnected && wsIsLive === false && clientOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: 0,
            right: 0,
            zIndex: 15,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 6,
              background: 'rgba(245,158,11,0.14)',
              border: '1px solid rgba(245,158,11,0.4)',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#F59E0B',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(6px)',
            }}
          >
            ⚠️ Angel One API unavailable — chart showing cached/delayed data. Candles will resume when connection restores.
          </div>
        </div>
      )}
    </>
  );
}
