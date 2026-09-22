import React from 'react';
import { FlaskConical, RefreshCw, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TN, panel, sectionTitle, btn, btnPrimary, input, num } from './terminalTheme';

export default function ScreenerBacktestModal({
  isOpen,
  onClose,
  loading,
  results,
  holdingDays,
  setHoldingDays,
  sttRate,
  setSttRate,
  onRerun
}) {
  if (!isOpen) return null;

  // Extra metrics are shown ONLY when the backend actually returns them.
  const kpis = results ? [
    { label: 'Strategy CAGR', value: results.strategy_cagr_pct != null ? `${results.strategy_cagr_pct}%` : 'N/A', color: TN.up },
    { label: 'Nifty 50 CAGR', value: results.benchmark_cagr_pct != null ? `${results.benchmark_cagr_pct}%` : 'N/A', color: TN.muted },
    { label: 'Alpha', value: results.alpha_pct != null ? `+${results.alpha_pct}%` : 'N/A', color: TN.accent },
    { label: 'Win Rate', value: results.win_rate_pct != null ? `${results.win_rate_pct}%` : 'N/A', color: TN.info },
    { label: 'Max Drawdown', value: results.max_drawdown_pct != null ? `${results.max_drawdown_pct}%` : 'N/A', color: TN.down },
    { label: 'Bench Drawdown', value: results.benchmark_max_drawdown_pct != null ? `${results.benchmark_max_drawdown_pct}%` : 'N/A', color: TN.faint },
    { label: 'Sharpe', value: results.sharpe_ratio ?? 'N/A', color: TN.warn },
  ] : [];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2,4,10,0.82)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 250,
      padding: 20
    }}>
      <div className="tn-scroll" style={{
        background: TN.panel,
        border: `1px solid ${TN.borderStrong}`,
        borderRadius: TN.radius,
        width: '100%',
        maxWidth: 780,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${TN.border}`, paddingBottom: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={16} color={TN.up} />
            <div>
              <h2 style={{ margin: 0, fontSize: 16, color: TN.text, fontWeight: 700 }}>Strategy Backtest</h2>
              <div style={{ fontSize: 11, color: TN.faint }}>Current screen · equal-weighted basket · real historical OHLCV</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close backtest"
            style={{ background: 'transparent', border: `1px solid ${TN.border}`, borderRadius: TN.radius, color: TN.muted, cursor: 'pointer', padding: 5, display: 'flex' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Config Controls */}
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(148,163,184,0.04)',
          border: `1px solid ${TN.border}`,
          padding: '8px 12px',
          borderRadius: TN.radius,
          marginBottom: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: TN.muted, fontWeight: 600 }}>Rebalance:</span>
            <select
              value={holdingDays}
              onChange={(e) => setHoldingDays(Number(e.target.value))}
              style={input({ height: 28, padding: '0 8px' })}
            >
              <option value="5">Weekly (5d)</option>
              <option value="20">Monthly (20d)</option>
              <option value="60">Quarterly (60d)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: TN.muted, fontWeight: 600 }}>Friction:</span>
            <select
              value={sttRate}
              onChange={(e) => setSttRate(Number(e.target.value))}
              style={input({ height: 28, padding: '0 8px' })}
            >
              <option value="0.0005">0.05% low</option>
              <option value="0.001">0.10% NSE STT</option>
              <option value="0.002">0.20% conservative</option>
            </select>
          </div>

          <button
            onClick={onRerun}
            disabled={loading}
            style={btnPrimary({ marginLeft: 'auto' })}
          >
            {loading ? <RefreshCw size={12} className="tn-spin" /> : <RefreshCw size={12} />} {loading ? 'Running…' : results ? 'Re-simulate' : 'Run backtest'}
          </button>
        </div>

        {/* Results View */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '56px 0', color: TN.accent }}>
            <RefreshCw size={24} className="tn-spin" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>Fetching real historical OHLCV bars & computing equity curve…</div>
          </div>
        ) : results ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 6 }}>
              {kpis.map((k) => (
                <div key={k.label} style={panel({ padding: '8px 10px' })}>
                  <div style={{ fontSize: 10, color: TN.faint, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k.label}</div>
                  <div style={num(17, { fontWeight: 700, color: k.color, marginTop: 2 })}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Equity Curve */}
            <div style={{ height: 240, width: '100%', background: TN.inset, border: `1px solid ${TN.border}`, borderRadius: TN.radius, padding: '10px 12px' }}>
              <div style={sectionTitle({ marginBottom: 6 })}>
                Cumulative performance — strategy vs Nifty 50
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={results.equity_curve || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" />
                  <XAxis dataKey="date" stroke="#5B6B82" fontSize={9} />
                  <YAxis stroke="#5B6B82" fontSize={9} domain={['auto', 'auto']} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <Tooltip contentStyle={{ background: '#0A0F1E', borderColor: TN.borderStrong, color: TN.text, fontSize: 12, borderRadius: 4 }} />
                  <Line type="monotone" dataKey="strategy_value" stroke={TN.up} strokeWidth={2} dot={false} name="Strategy Basket" />
                  <Line type="monotone" dataKey="benchmark_value" stroke={TN.faint} strokeWidth={1.5} dot={false} name="NIFTY 50 Benchmark" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Basket constituents */}
            {results.matched_tickers?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={sectionTitle()}>Basket:</span>
                {results.matched_tickers.map(t => (
                  <span key={t} style={{ padding: '1px 7px', borderRadius: 3, background: 'rgba(124,140,248,0.10)', color: TN.accent, fontSize: 11, fontWeight: 700, fontFamily: TN.mono }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Opened but not run yet: the modal no longer auto-fires, so it must
          // say what to do instead of rendering an empty panel.
          <div style={{ textAlign: 'center', padding: '44px 0', color: TN.faint }}>
            <FlaskConical size={22} style={{ margin: '0 auto 10px', opacity: 0.45 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: TN.muted }}>Not simulated yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Choose the rebalance period and friction above, then press “Run backtest”.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
