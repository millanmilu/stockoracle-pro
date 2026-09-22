import React, { useEffect, useState } from 'react';
import { TN, num } from './terminalTheme';

/**
 * Slim (~24px) bottom status bar: feed state, matches, universe,
 * live IST clock. Presentational only.
 */
export default function ScreenerStatusBar({
  wsState = 'idle',
  feedLive = false,
  matchCount = 0,
  universe = 'ALL NSE',
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const live = wsState === 'live' || feedLive;
  const dot = wsState === 'connecting' || wsState === 'reconnecting' ? TN.warn : live ? TN.up : TN.down;
  const label = wsState === 'connecting' || wsState === 'reconnecting' ? 'RECONNECTING' : live ? 'LIVE' : 'OFFLINE';
  const ist = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return (
    <div className="tn-no-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: 14, height: 24, minHeight: 24, padding: '0 10px', background: TN.panel, border: `1px solid ${TN.border}`, borderRadius: TN.radius, fontSize: 11, color: TN.faint, flexShrink: 0, overflowX: 'auto', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ color: TN.muted, fontWeight: 700, fontSize: 10 }}>{label}</span>
      </span>
      <span style={{ flexShrink: 0 }}><span style={num(11, { color: TN.text, fontWeight: 700 })}>{matchCount}</span> MATCHES</span>
      <span className="tn-status-extra" style={{ flexShrink: 0 }}>{universe}</span>
      <span style={{ marginLeft: 'auto', paddingLeft: 14, flexShrink: 0, fontFamily: TN.mono, color: TN.muted }}>NSE IST {ist}</span>
    </div>
  );
}
