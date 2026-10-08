import React from 'react';

export default function BacktestParamsDrawer({ params, setParams, currSymbol, isSmc = false }) {
  const controls = [
    { key: 'initial_capital', label: `Initial Capital (${currSymbol})`, min: 10000, max: 5000000, step: 10000 },
    { key: 'position_size_pct', label: 'Position Sizing (% Equity)', min: 10, max: 100, step: 5 },
    { key: 'risk_per_trade_pct', label: 'SMC Risk / Trade (% Equity)', min: 0.1, max: 5, step: 0.1 },
    { key: 'stop_loss', label: 'Stop Loss (%)', min: 1.0, max: 15.0, step: 0.5 },
    { key: 'take_profit', label: 'Take Profit (%)', min: 2.0, max: 25.0, step: 0.5 },
    { key: 'trailing_stop_pct', label: 'Trailing Stop (%)', min: 0.0, max: 10.0, step: 0.5 },
    { key: 'max_holding_days', label: isSmc ? 'Max Holding (Bars)' : 'Max Holding Period (Days)', min: 3, max: 60, step: 1 },
    { key: 'train_test_split', label: 'Train/Test Split (Train %)', min: 50, max: 85, step: 5 },
    { key: 'slippage_bps', label: 'Slippage (Basis Points)', min: 0, max: 50, step: 5 },
    { key: 'commission_bps', label: 'Commission / STT (Bps)', min: 0, max: 30, step: 1 },
    { key: 'fast_period', label: 'Fast Period (EMA / Donchian)', min: 3, max: 30, step: 1 },
    { key: 'slow_period', label: 'Slow Period (EMA / Donchian)', min: 10, max: 100, step: 2 },
    { key: 'rsi_oversold', label: 'RSI Oversold Level', min: 20, max: 40, step: 1 },
  ].filter(({ key }) => (isSmc ? !['stop_loss', 'take_profit', 'trailing_stop_pct', 'fast_period', 'slow_period', 'rsi_oversold'].includes(key) : key !== 'risk_per_trade_pct'));
  return (
        <div style={{
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.35)',
          borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Execution & Risk Controls
            </span>
            <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
              Adjust sliders and click "Run Backtest" or presets above to apply
            </span>
          </div>
          {isSmc && (
            <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
              SMC Pro uses structure-based stops/targets, supports long and short trades, and measures holding limits in candles.
              {' '}Risk sizing includes estimated round-trip costs; gaps can exceed the risk budget.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {controls.map(({ key, label, min, max, step }) => (
              <div key={key} style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#94A3B8', marginBottom: 4 }}>
                  <span>{label}</span>
                  <strong style={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                    {params[key]}
                  </strong>
                </div>
                <input
                  type="range" min={min} max={max} step={step} value={params[key]}
                  onChange={(e) => setParams({ ...params, [key]: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#6366F1', cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>
        </div>

  );
}
