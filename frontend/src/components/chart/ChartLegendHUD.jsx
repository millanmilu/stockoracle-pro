import React from 'react';

const fmt = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n.toFixed(2);
};

export default function ChartLegendHUD({
  hudRef,
  indicatorValues = {},
  indicatorParams = {},
  showSMA,
  showEMA,
  showBB,
  showVWAP,
  showSupertrend,
  showALMA,
  showRSI,
  showMACD,
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 12,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {/* Ultra-Fast Live Hover OHLCV HUD (Direct 0ms DOM Ref) */}
      <div
        ref={hudRef}
        style={{
          display: 'none',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          background: 'rgba(7, 10, 20, 0.92)',
          padding: '3px 10px',
          borderRadius: 4,
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          fontFamily: 'JetBrains Mono, monospace',
          pointerEvents: 'none',
        }}
      />

      {/* ── On-Chart Active Indicator Value Readouts (TradingView Style) ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        alignItems: 'center',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {showSMA && fmt(indicatorValues?.sma) != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)', padding: '1px 6px', borderRadius: 3, color: '#00E5FF' }}>
            <span style={{ fontWeight: 800 }}>SMA {indicatorParams?.smaPeriod}:</span>
            <span style={{ color: '#FFF' }}>₹{fmt(indicatorValues.sma)}</span>
          </div>
        )}
        {showEMA && fmt(indicatorValues?.ema) != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,145,0,0.12)', border: '1px solid rgba(255,145,0,0.3)', padding: '1px 6px', borderRadius: 3, color: '#FF9100' }}>
            <span style={{ fontWeight: 800 }}>EMA {indicatorParams?.emaPeriod}:</span>
            <span style={{ color: '#FFF' }}>₹{fmt(indicatorValues.ema)}</span>
          </div>
        )}
        {showBB && indicatorValues?.bb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(224,64,251,0.12)', border: '1px solid rgba(224,64,251,0.3)', padding: '1px 6px', borderRadius: 3, color: '#E040FB' }}>
            <span style={{ fontWeight: 800 }}>BB ({indicatorParams?.bbPeriod}, {indicatorParams?.bbStdDev}):</span>
            {fmt(indicatorValues.bb.upper) && <span style={{ color: '#E040FB' }}>U ₹{fmt(indicatorValues.bb.upper)}</span>}
            {fmt(indicatorValues.bb.middle) && <span style={{ color: '#F59E0B' }}>M ₹{fmt(indicatorValues.bb.middle)}</span>}
            {fmt(indicatorValues.bb.lower) && <span style={{ color: '#E040FB' }}>L ₹{fmt(indicatorValues.bb.lower)}</span>}
          </div>
        )}
        {showVWAP && fmt(indicatorValues?.vwap) != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', padding: '1px 6px', borderRadius: 3, color: '#06B6D4' }}>
            <span style={{ fontWeight: 800 }}>VWAP:</span>
            <span style={{ color: '#FFF' }}>₹{fmt(indicatorValues.vwap)}</span>
          </div>
        )}
        {showSupertrend && fmt(indicatorValues?.supertrend) != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 6px', borderRadius: 3, color: '#10B981' }}>
            <span style={{ fontWeight: 800 }}>Supertrend:</span>
            <span style={{ color: '#FFF' }}>₹{fmt(indicatorValues.supertrend)}</span>
          </div>
        )}
        {showALMA && fmt(indicatorValues?.alma) != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', padding: '1px 6px', borderRadius: 3, color: '#FACC15' }}>
            <span style={{ fontWeight: 800 }}>ALMA:</span>
            <span style={{ color: '#FFF' }}>₹{fmt(indicatorValues.alma)}</span>
          </div>
        )}
        {showRSI && fmt(indicatorValues?.rsi) != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', padding: '1px 6px', borderRadius: 3, color: '#F43F5E' }}>
            <span style={{ fontWeight: 800 }}>RSI ({indicatorParams?.rsiPeriod}):</span>
            <span style={{ color: Number(indicatorValues.rsi) >= 70 ? '#EF5350' : Number(indicatorValues.rsi) <= 30 ? '#10B981' : '#FFF', fontWeight: 800 }}>
              {fmt(indicatorValues.rsi)}
            </span>
          </div>
        )}
        {showMACD && indicatorValues?.macd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', padding: '1px 6px', borderRadius: 3, color: '#38BDF8' }}>
            <span style={{ fontWeight: 800 }}>MACD ({indicatorParams?.macdFast},{indicatorParams?.macdSlow},{indicatorParams?.macdSignal}):</span>
            {fmt(indicatorValues.macd.macd) && <span>M: {fmt(indicatorValues.macd.macd)}</span>}
            {fmt(indicatorValues.macd.signal) && <span style={{ color: '#F97316' }}>S: {fmt(indicatorValues.macd.signal)}</span>}
            {fmt(indicatorValues.macd.hist) && (
              <span style={{ color: Number(indicatorValues.macd.hist || 0) >= 0 ? '#10B981' : '#EF5350', fontWeight: 800 }}>
                H: {Number(indicatorValues.macd.hist || 0) >= 0 ? '+' : ''}{fmt(indicatorValues.macd.hist)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
