import React from 'react';
import { FlaskConical } from 'lucide-react';

export default function BacktestOverlayPanel({ symbol, showBacktest, setShowBacktest, backtestData, backtestLoading }) {
  const cr = backtestData?.cumulative_return;
  const br = backtestData?.benchmark_return;

  const pct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
  const col = v => v >= 0 ? '#10B981' : '#EF5350';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toggle Button */}
      <button
        onClick={() => setShowBacktest(p => !p)}
        style={{
          width: '100%', padding: '8px 10px',
          borderRadius: 8, border: `1px solid ${showBacktest ? '#10B981' : 'rgba(99,102,241,0.3)'}`,
          background: showBacktest ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.08)',
          color: showBacktest ? '#10B981' : '#8B5CF6',
          fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <FlaskConical size={13} />
        {showBacktest ? '✓ Backtest ON — markers visible' : 'Enable Backtest Overlay'}
      </button>

      {/* Loading */}
      {showBacktest && backtestLoading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>Running backtest…</div>
        </div>
      )}

      {/* Legend */}
      {showBacktest && !backtestLoading && (
        <div style={{ display: 'flex', gap: 8, fontSize: '0.68rem' }}>
          <span style={{ color: '#10B981', fontWeight: 700 }}>▲ BUY</span>
          <span style={{ color: '#EF5350', fontWeight: 700 }}>▼ SELL</span>
          <span style={{ color: '#6B7280' }}>shown on chart</span>
        </div>
      )}

      {/* Metrics */}
      {backtestData && !backtestLoading && (() => {
        const { cumulative_return: cr, benchmark_return: br, sharpe_ratio, max_drawdown, win_rate, total_trades, cagr } = backtestData;
        const alpha = cr - br;
        const rows = [
          { label: 'Strategy Return', value: pct(cr), color: col(cr) },
          { label: 'Benchmark (B&H)', value: pct(br), color: col(br) },
          { label: 'Alpha', value: pct(alpha), color: col(alpha) },
          { label: 'CAGR', value: pct(cagr), color: col(cagr) },
          { label: 'Sharpe', value: sharpe_ratio.toFixed(2), color: sharpe_ratio >= 1 ? '#10B981' : sharpe_ratio >= 0 ? '#F59E0B' : '#EF5350' },
          { label: 'Max Drawdown', value: pct(max_drawdown), color: max_drawdown > -0.1 ? '#10B981' : '#EF5350' },
          { label: 'Win Rate', value: `${(win_rate * 100).toFixed(1)}%`, color: win_rate >= 0.55 ? '#10B981' : '#F59E0B' },
          { label: 'Trades', value: total_trades, color: '#9CA3AF' },
        ];
        return (
          <>
            <div style={{ borderTop: '1px solid rgba(99,102,241,0.1)', paddingTop: 8, fontSize: '0.68rem', color: '#6366F1', fontWeight: 700, letterSpacing: '0.06em' }}>
              PERFORMANCE METRICS
            </div>
            {rows.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: '#6B7280' }}>{r.label}</span>
                <span style={{ color: r.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, fontSize: '0.68rem', color: '#4B5563', lineHeight: 1.5 }}>
              📋 Buy when AI 7d return &gt; 1.5% · Stop-loss 4% · TP 8%
            </div>
          </>
        );
      })()}
    </div>
  );
}
