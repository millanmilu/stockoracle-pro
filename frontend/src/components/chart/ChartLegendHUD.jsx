import React from 'react';

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
        {showSMA && indicatorValues.sma != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)', padding: '1px 6px', borderRadius: 3, color: '#00E5FF' }}>
            <span style={{ fontWeight: 800 }}>SMA {indicatorParams.smaPeriod}:</span>
            <span style={{ color: '#FFF' }}>₹{indicatorValues.sma.toFixed(2)}</span>
          </div>
        )}
        {showEMA && indicatorValues.ema != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,145,0,0.12)', border: '1px solid rgba(255,145,0,0.3)', padding: '1px 6px', borderRadius: 3, color: '#FF9100' }}>
            <span style={{ fontWeight: 800 }}>EMA {indicatorParams.emaPeriod}:</span>
            <span style={{ color: '#FFF' }}>₹{indicatorValues.ema.toFixed(2)}</span>
          </div>
        )}
        {showBB && indicatorValues.bb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(224,64,251,0.12)', border: '1px solid rgba(224,64,251,0.3)', padding: '1px 6px', borderRadius: 3, color: '#E040FB' }}>
            <span style={{ fontWeight: 800 }}>BB ({indicatorParams.bbPeriod}, {indicatorParams.bbStdDev}):</span>
            <span style={{ color: '#E040FB' }}>U ₹{indicatorValues.bb.upper?.toFixed(2)}</span>
            <span style={{ color: '#F59E0B' }}>M ₹{indicatorValues.bb.middle?.toFixed(2)}</span>
            <span style={{ color: '#E040FB' }}>L ₹{indicatorValues.bb.lower?.toFixed(2)}</span>
          </div>
        )}
        {showVWAP && indicatorValues.vwap != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', padding: '1px 6px', borderRadius: 3, color: '#06B6D4' }}>
            <span style={{ fontWeight: 800 }}>VWAP:</span>
            <span style={{ color: '#FFF' }}>₹{indicatorValues.vwap.toFixed(2)}</span>
          </div>
        )}
        {showSupertrend && indicatorValues.supertrend != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 6px', borderRadius: 3, color: '#10B981' }}>
            <span style={{ fontWeight: 800 }}>Supertrend:</span>
            <span style={{ color: '#FFF' }}>₹{indicatorValues.supertrend.toFixed(2)}</span>
          </div>
        )}
        {showALMA && indicatorValues.alma != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', padding: '1px 6px', borderRadius: 3, color: '#FACC15' }}>
            <span style={{ fontWeight: 800 }}>ALMA:</span>
            <span style={{ color: '#FFF' }}>₹{indicatorValues.alma.toFixed(2)}</span>
          </div>
        )}
        {showRSI && indicatorValues.rsi != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', padding: '1px 6px', borderRadius: 3, color: '#F43F5E' }}>
            <span style={{ fontWeight: 800 }}>RSI ({indicatorParams.rsiPeriod}):</span>
            <span style={{ color: indicatorValues.rsi >= 70 ? '#EF5350' : indicatorValues.rsi <= 30 ? '#10B981' : '#FFF', fontWeight: 800 }}>
              {indicatorValues.rsi.toFixed(2)}
            </span>
          </div>
        )}
        {showMACD && indicatorValues.macd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', padding: '1px 6px', borderRadius: 3, color: '#38BDF8' }}>
            <span style={{ fontWeight: 800 }}>MACD ({indicatorParams.macdFast},{indicatorParams.macdSlow},{indicatorParams.macdSignal}):</span>
            <span>M: {indicatorValues.macd.macd?.toFixed(2)}</span>
            <span style={{ color: '#F97316' }}>S: {indicatorValues.macd.signal?.toFixed(2)}</span>
            <span style={{ color: (indicatorValues.macd.hist || 0) >= 0 ? '#10B981' : '#EF5350', fontWeight: 800 }}>
              H: {(indicatorValues.macd.hist || 0) >= 0 ? '+' : ''}{indicatorValues.macd.hist?.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
