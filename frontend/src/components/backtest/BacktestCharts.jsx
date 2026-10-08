import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import { Zap } from 'lucide-react';
import MetricCard from './MetricCard';
import { fmtNum, fmtCurr as fmtCurrBase } from './formatters';

export function EquityCurveTab({ data }) {
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', gap: 16 }}>
                  <span><span style={{ color: '#6366F1', fontWeight: 800 }}>■</span> Strategy Equity (%)</span>
                  <span><span style={{ color: '#F59E0B' }}>---</span> Buy & Hold Benchmark (%)</span>
                  <span><span style={{ color: '#10B981' }}>|</span> Buy Marker</span>
                  <span><span style={{ color: '#F43F5E' }}>|</span> Sell Marker</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                  Total Sessions: {data.equity_curve?.length || 0} {data.interval ? `${data.interval} bars` : 'days'}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart
                  data={data.equity_curve.map((e, i) => ({
                    ...e,
                    benchmark: data.benchmark_curve[i]?.pct_change ?? 0,
                  }))}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />
                  <Tooltip
                    contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.74rem' }}
                    formatter={(v, name) => [`${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`, name]}
                  />
                  {/* Buy / Sell Execution markers */}
                  {data.equity_curve.filter(e => e.action === 'BUY').map((e, i) => (
                    <ReferenceLine key={`b_${i}`} x={e.date} stroke="rgba(16,185,129,0.35)" strokeDasharray="2 3" />
                  ))}
                  {data.equity_curve.filter(e => e.action === 'SELL').map((e, i) => (
                    <ReferenceLine key={`s_${i}`} x={e.date} stroke="rgba(244,63,94,0.35)" strokeDasharray="2 3" />
                  ))}
                  <Area type="monotone" dataKey="pct_change" stroke="#6366F1" strokeWidth={2} fill="rgba(99,102,241,0.12)" name="Strategy %" dot={false} connectNulls />
                  <Line type="monotone" dataKey="benchmark" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 4" name="B&H %" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

  );
}

export function DrawdownTab({ data }) {
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                  Underwater Equity Curve (Peak-to-Trough Decline). Max Drawdown: <strong style={{ color: '#F43F5E' }}>{(data.max_drawdown * 100).toFixed(2)}%</strong>
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                  Recovery Factor: {fmtNum(data.recovery_factor)}x
                </span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.drawdown_curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <Tooltip
                    contentStyle={{ background: '#0F172A', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, fontSize: '0.74rem' }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Drawdown']}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <ReferenceLine y={-10} stroke="rgba(244,63,94,0.3)" strokeDasharray="3 3" label={{ value: '-10%', fill: '#64748B', fontSize: 10 }} />
                  <ReferenceLine y={-20} stroke="rgba(244,63,94,0.3)" strokeDasharray="3 3" label={{ value: '-20%', fill: '#64748B', fontSize: 10 }} />
                  <Area type="monotone" dataKey="drawdown_pct" stroke="#F43F5E" strokeWidth={1.5} fill="rgba(244,63,94,0.15)" name="Drawdown %" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

  );
}

export function PnlDistributionTab({ data }) {
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 700 }}>
                    Trade Return P&L Distribution Histogram
                  </span>
                  <div style={{ fontSize: '0.66rem', color: '#64748B', marginTop: 2 }}>
                    Frequency distribution of individual trade percentage returns
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.7rem' }}>
                  <span>Best: <strong style={{ color: '#10B981' }}>+{fmtNum(data.best_trade_pct)}%</strong></span>
                  <span>Worst: <strong style={{ color: '#F43F5E' }}>{fmtNum(data.worst_trade_pct)}%</strong></span>
                  <span>Avg Win: <strong style={{ color: '#10B981' }}>+{fmtNum(data.avg_win_pct)}%</strong></span>
                  <span>Avg Loss: <strong style={{ color: '#F43F5E' }}>{fmtNum(data.avg_loss_pct)}%</strong></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.trade_pnl_distribution} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: '0.74rem' }}
                    formatter={(v) => [`${v} Trades`, 'Frequency']}
                  />
                  <Bar dataKey="count" name="Trade Count">
                    {data.trade_pnl_distribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

  );
}

export function MonteCarloTab({ data, currSymbol }) {
  const fmtCurr = (v) => fmtCurrBase(v, currSymbol);
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color="#C084FC" />
                <strong style={{ fontSize: '0.92rem' }}>
                  Monte Carlo Permutation Robustness Test (500 Random Runs)
                </strong>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                This test shuffles your strategy's {data.interval ? 'per-bar' : 'daily'} return sequence 500 times with random permutation.
                If your real observed Sharpe (<strong style={{ color: '#818CF8' }}>{fmtNum(data.sharpe_ratio)}</strong>) is above the 
                median (<strong style={{ color: '#F59E0B' }}>{fmtNum(data.monte_carlo.sharpe_p50)}</strong>) and approaches the 95th percentile 
                (<strong style={{ color: '#10B981' }}>{fmtNum(data.monte_carlo.sharpe_p95)}</strong>), the observed performance represents a genuine quantitative edge rather than luck.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <MetricCard label="Sharpe 5th %ile (Worst)" value={fmtNum(data.monte_carlo.sharpe_p5)} col="#F43F5E" />
                <MetricCard label="Sharpe Median (50th)" value={fmtNum(data.monte_carlo.sharpe_p50)} col="#F59E0B" />
                <MetricCard label="Sharpe 95th %ile (Top)" value={fmtNum(data.monte_carlo.sharpe_p95)} col="#10B981" />
                <MetricCard label="Your Observed Sharpe" value={fmtNum(data.sharpe_ratio)} col="#818CF8" />
                <MetricCard label="% Profitable Simulations" value={`${data.monte_carlo.pct_profitable}%`} col={data.monte_carlo.pct_profitable >= 60 ? '#10B981' : '#F59E0B'} />
                <MetricCard label="Final Capital 5th %ile" value={fmtCurr(data.monte_carlo.final_p5)} col="#F43F5E" />
                <MetricCard label="Final Capital 95th %ile" value={fmtCurr(data.monte_carlo.final_p95)} col="#10B981" />
                <MetricCard label="Worst Drawdown (95% CI)" value={`${fmtNum(data.monte_carlo.max_dd_p95)}%`} col="#F43F5E" />
              </div>
            </div>

  );
}
