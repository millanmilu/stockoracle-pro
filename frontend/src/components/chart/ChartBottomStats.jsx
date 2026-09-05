import React from 'react';

/**
 * ChartBottomStats — Bottom Session Summary Bar
 * Displays live NSE status, LTP, session O/H/L bounds, change %, and total traded volume.
 */
export default function ChartBottomStats({
  isLive = false,
  curPrice = null,
  dayChange = null,
  candles = [],
  activeCandleRef,
  interval = '1d',
  dataSource = 'angel_one',
}) {
  // Extract session stats from active candle or historical candles
  const stats = React.useMemo(() => {
    let open = null;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    if (Array.isArray(candles) && candles.length > 0) {
      if (interval === '1d') {
        // Daily: last candle holds today's or latest session bounds
        const last = candles[candles.length - 1];
        open = Number(last.open);
        high = Number(last.high);
        low = Number(last.low);
        volume = Number(last.volume || 0);
      } else {
        // Intraday: aggregate over today's intraday bars
        open = Number(candles[0].open);
        for (let i = 0; i < candles.length; i++) {
          const h = Number(candles[i].high);
          const l = Number(candles[i].low);
          const v = Number(candles[i].volume || 0);
          if (!isNaN(h) && h > high) high = h;
          if (!isNaN(l) && l < low && l > 0) low = l;
          if (!isNaN(v)) volume += v;
        }
      }
    }

    // Incorporate active ongoing candle wick if active
    const active = activeCandleRef?.current;
    if (active) {
      if (open == null) open = Number(active.open);
      if (active.high != null && Number(active.high) > high) high = Number(active.high);
      if (active.low != null && Number(active.low) < low && Number(active.low) > 0) low = Number(active.low);
      if (active.volume != null && interval === '1d') volume = Number(active.volume);
    }

    const validHigh = high !== -Infinity ? high : null;
    const validLow = low !== Infinity ? low : null;

    return { open, high: validHigh, low: validLow, volume };
  }, [candles, activeCandleRef, interval]);

  const numLtp = curPrice != null && !isNaN(Number(curPrice)) ? Number(curPrice) : null;
  const numChg = dayChange != null && !isNaN(Number(dayChange)) ? Number(dayChange) : null;
  const isUp = (numChg || 0) >= 0;

  const formatVol = (vol) => {
    if (vol == null || isNaN(vol) || vol <= 0) return '—';
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toLocaleString();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '3px 10px',
      backgroundColor: '#0B0F1C',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      borderRadius: 6,
      fontSize: '0.72rem',
      color: '#94A3B8',
      height: 26,
      flexShrink: 0,
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {/* Left: Live Status Badge + LTP + Change */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Status Indicator Badge */}
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: 4,
            background: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
            color: isLive ? '#10B981' : '#94A3B8',
            border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: isLive ? '#10B981' : '#64748B',
              boxShadow: isLive ? '0 0 6px #10B981' : 'none',
            }}
          />
          {isLive ? 'LIVE NSE' : (interval === '1d' ? 'DAILY' : 'INTRADAY')}
        </span>

        {/* Real-time LTP */}
        <span>
          LTP:{' '}
          <strong style={{ color: '#FFFFFF', fontSize: '0.76rem' }}>
            {numLtp != null ? `₹${numLtp.toFixed(2)}` : '—'}
          </strong>
        </span>

        {/* Change % */}
        {numChg != null && (
          <span>
            Chg:{' '}
            <strong style={{ color: isUp ? '#10B981' : '#EF5350' }}>
              {isUp ? '+' : ''}{numChg.toFixed(2)}%
            </strong>
          </span>
        )}

        {/* Open, High, Low */}
        {stats.open != null && (
          <span style={{ color: '#64748B' }}>
            O: <strong style={{ color: '#CBD5E1' }}>₹{stats.open.toFixed(2)}</strong>
          </span>
        )}
        {stats.high != null && (
          <span style={{ color: '#64748B' }}>
            H: <strong style={{ color: '#10B981' }}>₹{stats.high.toFixed(2)}</strong>
          </span>
        )}
        {stats.low != null && (
          <span style={{ color: '#64748B' }}>
            L: <strong style={{ color: '#EF5350' }}>₹{stats.low.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {/* Right: Traded Volume + Data Feed Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {stats.volume > 0 && (
          <span>
            Vol: <strong style={{ color: '#CBD5E1' }}>{formatVol(stats.volume)}</strong>
          </span>
        )}

        <span style={{
          fontSize: '0.62rem',
          padding: '1px 5px',
          borderRadius: 3,
          background: 'rgba(99, 102, 241, 0.12)',
          color: '#818CF8',
          fontWeight: 700,
        }}>
          {dataSource === 'angel_one' ? 'Angel One' : 'Verified DB'}
        </span>
      </div>
    </div>
  );
}
