import React from 'react';
import { SIG } from '../../utils/chartHelpers';

/**
 * ChartBottomStats - Displays a compact session summary bar (LTP, O, H, L, 7D Target, Signal, Confidence)
 * and an expandable grid of detailed statistical and price bound prediction cards.
 */
export default function ChartBottomStats({
  isDaily,
  wsLiveData,
  curPrice,
  prediction,
  predLoading,
  activeCandleRef,
  showBottomStats,
  setShowBottomStats,
}) {
  if (!isDaily) return null;

  const sig = prediction?.signal;
  const sigMeta = SIG[sig] ?? SIG.hold;
  const score = prediction?.ai_confidence_score ?? 0;
  const scoreColor = score >= 70 ? '#26A69A' : score >= 50 ? '#F59E0B' : '#EF5350';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 10px',
          backgroundColor: '#0B0F1C',
          border: '1px solid rgba(99,102,241,0.12)',
          borderRadius: 6,
          fontSize: '0.72rem',
          color: '#94A3B8',
          height: 26,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: 4,
              background: wsLiveData ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
              color: wsLiveData ? '#10B981' : '#94A3B8',
              border: `1px solid ${wsLiveData ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
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
                backgroundColor: wsLiveData ? '#10B981' : '#64748B',
                boxShadow: wsLiveData ? '0 0 6px #10B981' : 'none',
              }}
            />
            {wsLiveData ? 'LIVE NSE' : 'EOD SYNC'}
          </span>

          <span>
            LTP:{' '}
            <strong style={{ color: '#FFF', fontFamily: 'JetBrains Mono, monospace' }}>
              {curPrice ? `₹${curPrice.toFixed(2)}` : '—'}
            </strong>
          </span>
          <span>
            O:{' '}
            <strong style={{ color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace' }}>
              {activeCandleRef?.current?.open ? `₹${Number(activeCandleRef.current.open).toFixed(2)}` : '—'}
            </strong>
          </span>
          <span>
            H:{' '}
            <strong style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
              {activeCandleRef?.current?.high ? `₹${Number(activeCandleRef.current.high).toFixed(2)}` : '—'}
            </strong>
          </span>
          <span>
            L:{' '}
            <strong style={{ color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>
              {activeCandleRef?.current?.low ? `₹${Number(activeCandleRef.current.low).toFixed(2)}` : '—'}
            </strong>
          </span>
          <span>
            7D Target:{' '}
            <strong style={{ color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
              {prediction?.predicted_price_7d ? `₹${prediction.predicted_price_7d.toFixed(2)}` : '—'}
            </strong>
          </span>
          <span>
            Return:{' '}
            <strong style={{ color: (prediction?.predicted_return_7d || 0) >= 0 ? '#10B981' : '#EF5350' }}>
              {prediction?.predicted_return_7d != null
                ? `${prediction.predicted_return_7d >= 0 ? '+' : ''}${(prediction.predicted_return_7d * 100).toFixed(2)}%`
                : '—'}
            </strong>
          </span>
          <span>
            Signal: <strong style={{ color: sigMeta.color }}>{predLoading ? 'Loading…' : sigMeta.label}</strong>
          </span>
          <span>
            Confidence: <strong style={{ color: scoreColor }}>{score}/100</strong>
          </span>
        </div>

        <button
          onClick={() => setShowBottomStats(!showBottomStats)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4,
            padding: '2px 6px',
            color: '#818CF8',
            cursor: 'pointer',
            fontSize: '0.68rem',
            fontWeight: 600,
          }}
        >
          {showBottomStats ? '▴ Hide' : '▾ Stats'}
        </button>
      </div>

      {/* Expanded Cards (Shown only on demand) */}
      {showBottomStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
          {[
            {
              label: 'CURRENT PRICE',
              value: curPrice ? `₹${curPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
              color: '#F0F0FF',
            },
            {
              label: 'AI TARGET (7D)',
              value: prediction?.predicted_price_7d
                ? `₹${prediction.predicted_price_7d.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : predLoading
                ? 'Loading…'
                : '—',
              color: '#818CF8',
            },
            {
              label: 'EXPECTED RETURN',
              value:
                prediction?.predicted_return_7d != null
                  ? `${prediction.predicted_return_7d >= 0 ? '+' : ''}${(prediction.predicted_return_7d * 100).toFixed(2)}%`
                  : predLoading
                  ? 'Loading…'
                  : '—',
              color: (prediction?.predicted_return_7d || 0) >= 0 ? '#10B981' : '#EF5350',
            },
            {
              label: 'AI CONFIDENCE',
              value: prediction?.ai_confidence_score != null ? `${prediction.ai_confidence_score}/100` : predLoading ? 'Loading…' : '—',
              color: scoreColor,
            },
            {
              label: '95% UPPER',
              value:
                (prediction?.predicted_upper_price_7d ?? prediction?.high_bound)
                  ? `₹${(prediction.predicted_upper_price_7d ?? prediction.high_bound).toFixed(2)}`
                  : predLoading
                  ? 'Loading…'
                  : '—',
              color: '#10B981',
            },
            {
              label: '95% LOWER',
              value:
                (prediction?.predicted_lower_price_7d ?? prediction?.low_bound)
                  ? `₹${(prediction.predicted_lower_price_7d ?? prediction.low_bound).toFixed(2)}`
                  : predLoading
                  ? 'Loading…'
                  : '—',
              color: '#EF5350',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(99,102,241,0.12)',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              <div style={{ fontSize: '0.58rem', color: '#64748B', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
