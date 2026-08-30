import React, { useState, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import { 
  Play, RefreshCw, Settings, TrendingUp, TrendingDown, 
  Shield, Award, AlertTriangle, BookOpen, BarChart2, Zap 
} from 'lucide-react';

export default function BacktestPanel({ ticker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const currentTicker = (ticker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [showSettings, setShowSettings] = useState(false);

  // Configurable Strategy Parameters
  const [params, setParams] = useState({
    initial_capital: 100000,
    entry_threshold: 1.5,
    stop_loss: 4.0,
    take_profit: 8.0,
    bearish_exit_threshold: 1.0,
    train_test_split: 70,
    max_holding_days: 20,
  });

  const runBacktest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await api.get(`/api/stock/${currentTicker}/backtest`, {
        params: {
          initial_capital: params.initial_capital,
          entry_threshold: params.entry_threshold / 100,
          stop_loss: params.stop_loss / 100,
          take_profit: params.take_profit / 100,
          bearish_exit_threshold: -(params.bearish_exit_threshold / 100),
          train_test_split: params.train_test_split / 100,
          max_holding_days: params.max_holding_days,
        }
      });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setData(res.data);
        setActiveTab('summary');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Backtest failed. Train the AI model first in AI Lab.');
    } finally {
      setLoading(false);
    }
  }, [currentTicker, params]);

  const fmtPct = (v, decimals = 2) => `${Number(v) >= 0 ? '+' : ''}${(Number(v) * 100).toFixed(decimals)}%`;
  const fmtNum = (v, d = 2) => Number(v).toFixed(d);
  const fmtRs = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const color = (v, thresh = 0) => Number(v) >= thresh ? '#10B981' : '#F43F5E';

  const MetricCard = ({ label, value, sub, col }) => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: '0.65rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: col || '#F8FAFC', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.85))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
            <BarChart2 size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              Walk-Forward Backtest Engine — <span style={{ color: '#818CF8' }}>{currentTicker}</span>
            </h2>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
              True Out-of-Sample Testing · No Look-Ahead Bias · Causal Feature Engineering · Variable Slippage
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Settings size={13} />
            <span>Strategy Params</span>
          </button>
          <button onClick={runBacktest} disabled={loading}
            style={{ background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none', borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: '0.78rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
            <span>{loading ? 'Running…' : 'Run Backtest'}</span>
          </button>
        </div>
      </div>

      {/* ── Configurable Params Panel ── */}
      {showSettings && (
        <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { key: 'initial_capital', label: 'Initial Capital (₹)', min: 10000, max: 10000000, step: 10000 },
            { key: 'entry_threshold', label: 'Entry Threshold (%)', min: 0.5, max: 5.0, step: 0.1 },
            { key: 'stop_loss', label: 'Stop Loss (%)', min: 1.0, max: 15.0, step: 0.5 },
            { key: 'take_profit', label: 'Take Profit (%)', min: 2.0, max: 25.0, step: 0.5 },
            { key: 'bearish_exit_threshold', label: 'Bearish Exit Threshold (%)', min: 0.1, max: 5.0, step: 0.1 },
            { key: 'train_test_split', label: 'Train/Test Split (Train %)', min: 50, max: 85, step: 5 },
            { key: 'max_holding_days', label: 'Max Holding Period (Days)', min: 3, max: 60, step: 1 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <label style={{ fontSize: '0.65rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                {label}: <strong style={{ color: '#F8FAFC' }}>{params[key]}</strong>
              </label>
              <input type="range" min={min} max={max} step={step} value={params[key]}
                onChange={(e) => setParams({ ...params, [key]: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#6366F1' }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 10, color: '#F43F5E', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <RefreshCw size={32} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#818CF8', fontWeight: 700 }}>Running walk-forward out-of-sample backtest… Computing Monte Carlo simulations…</div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!data && !loading && !error && (
        <div style={{ padding: 40, textAlign: 'center', background: 'rgba(15,23,42,0.7)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🧪</div>
          <div style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Configure strategy parameters above and click <strong style={{ color: '#818CF8' }}>Run Backtest</strong> to start.</div>
          <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: 8 }}>The backtest trains on 70% of data and tests on the remaining 30% — pure out-of-sample results.</div>
        </div>
      )}

      {/* ── Results ── */}
      {data && !loading && (
        <>
          {/* OOS Warning Banner */}
          <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '8px 14px', fontSize: '0.74rem', color: '#38BDF8', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Shield size={14} />
            <span>
              ✅ <strong>Out-of-Sample Results</strong> — Model trained on first {data.train_test_split_pct}% of data. 
              Testing on last {100 - data.train_test_split_pct}% ({data.backtest_days} trading days) starting <strong>{data.out_of_sample_start}</strong> — data the model never saw.
            </span>
          </div>

          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <MetricCard label="Final Portfolio" value={fmtRs(data.final_value)} sub={`Started: ${fmtRs(data.initial_capital)}`} col={color(data.cumulative_return)} />
            <MetricCard label="Strategy Return (OOS)" value={fmtPct(data.cumulative_return)} sub={`Benchmark B&H: ${fmtPct(data.benchmark_return)}`} col={color(data.cumulative_return)} />
            <MetricCard label="Alpha vs B&H" value={fmtPct(data.alpha)} sub="Excess return" col={color(data.alpha)} />
            <MetricCard label="CAGR" value={fmtPct(data.cagr)} sub="Annualised" col={color(data.cagr)} />
            <MetricCard label="Sharpe Ratio" value={fmtNum(data.sharpe_ratio)} sub="(rf=6.5%)" col={data.sharpe_ratio >= 1 ? '#10B981' : data.sharpe_ratio >= 0.5 ? '#F59E0B' : '#F43F5E'} />
            <MetricCard label="Sortino Ratio" value={fmtNum(data.sortino_ratio)} sub="Downside-adjusted" col={data.sortino_ratio >= 1 ? '#10B981' : '#F59E0B'} />
            <MetricCard label="Calmar Ratio" value={fmtNum(data.calmar_ratio)} sub="CAGR / Max DD" col={data.calmar_ratio >= 0.5 ? '#10B981' : '#F59E0B'} />
            <MetricCard label="Max Drawdown" value={fmtPct(data.max_drawdown)} sub="Peak-to-trough" col={data.max_drawdown > -0.1 ? '#10B981' : data.max_drawdown > -0.2 ? '#F59E0B' : '#F43F5E'} />
            <MetricCard label="Profit Factor" value={fmtNum(data.profit_factor)} sub={`${data.total_trades} trades`} col={data.profit_factor >= 1.5 ? '#10B981' : '#F59E0B'} />
            <MetricCard label="Win Rate" value={`${(data.win_rate * 100).toFixed(1)}%`} sub={`${data.winning_trades}W / ${data.losing_trades}L`} col={data.win_rate >= 0.5 ? '#10B981' : '#F43F5E'} />
            <MetricCard label="Avg Win" value={`+${fmtNum(data.avg_win_pct)}%`} col="#10B981" />
            <MetricCard label="Avg Loss" value={`${fmtNum(data.avg_loss_pct)}%`} col="#F43F5E" />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'summary', label: 'Equity & Benchmark Chart' },
              { id: 'drawdown', label: 'Drawdown Curve' },
              { id: 'monthly', label: `Monthly Returns (${data.monthly_returns?.length || 0})` },
              { id: 'journal', label: `Trade Journal (${data.total_trades})` },
              { id: 'montecarlo', label: 'Monte Carlo Confidence' },
            ].map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${activeTab === t.id ? 'rgba(99,102,241,0.5)' : 'transparent'}`, background: activeTab === t.id ? 'rgba(99,102,241,0.18)' : 'transparent', color: activeTab === t.id ? '#818CF8' : '#94A3B8', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Equity Curve ── */}
          {activeTab === 'summary' && (
            <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginBottom: 10, display: 'flex', gap: 16 }}>
                <span><span style={{ color: '#6366F1' }}>■</span> AI Strategy (OOS)</span>
                <span><span style={{ color: '#F59E0B' }}>---</span> Buy & Hold Benchmark</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data.equity_curve.map((e, i) => ({
                  ...e,
                  benchmark: data.benchmark_curve[i]?.pct_change ?? 0,
                }))} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.75rem' }} formatter={(v, name) => [`${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`, name]} />
                  {data.equity_curve.filter(e => e.action === 'BUY').map((e, i) => (
                    <ReferenceLine key={`buy_${i}`} x={e.date} stroke="rgba(16,185,129,0.4)" strokeDasharray="2 4" />
                  ))}
                  {data.equity_curve.filter(e => e.action === 'SELL').map((e, i) => (
                    <ReferenceLine key={`sell_${i}`} x={e.date} stroke="rgba(244,63,94,0.4)" strokeDasharray="2 4" />
                  ))}
                  <Area type="monotone" dataKey="pct_change" stroke="#6366F1" strokeWidth={2} fill="rgba(99,102,241,0.12)" name="AI Strategy %" dot={false} connectNulls />
                  <Line type="monotone" dataKey="benchmark" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5 4" name="B&H %" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Tab: Drawdown Curve ── */}
          {activeTab === 'drawdown' && (
            <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginBottom: 10 }}>
                Underwater Equity Curve (Drawdown from Peak). Max: <strong style={{ color: '#F43F5E' }}>{(data.max_drawdown * 100).toFixed(2)}%</strong>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data.drawdown_curve} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, fontSize: '0.75rem' }} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Drawdown']} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <Area type="monotone" dataKey="drawdown_pct" stroke="#F43F5E" strokeWidth={1.5} fill="rgba(244,63,94,0.15)" name="Drawdown %" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Tab: Monthly Returns ── */}
          {activeTab === 'monthly' && (
            <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginBottom: 12 }}>Monthly P&L Breakdown (Out-of-Sample Period)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthly_returns} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.75rem' }} formatter={(v) => [`${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`, 'Monthly Return']} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" />
                  <Bar dataKey="return_pct" name="Monthly Return %">
                    {data.monthly_returns.map((m, i) => (
                      <Cell key={i} fill={m.is_positive ? '#10B981' : '#F43F5E'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Tab: Trade Journal ── */}
          {activeTab === 'journal' && (
            <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Full Trade Execution Journal — {data.total_trades} Trades</div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem' }}>
                  {Object.entries(data.exit_reason_breakdown || {}).map(([k, v]) => (
                    <span key={k} style={{ color: '#94A3B8' }}>{k}: <strong style={{ color: '#F8FAFC' }}>{v}</strong></span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.66rem', textTransform: 'uppercase' }}>
                      {['#', 'Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'Hold (Days)', 'P&L (₹)', 'P&L %', 'Exit Reason', 'Result'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.trade_journal.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px' }}>{t.entry_date}</td>
                        <td style={{ padding: '8px 10px' }}>{t.exit_date}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>₹{t.entry_price}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>₹{t.exit_price}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{t.holding_days}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: t.pnl >= 0 ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                          {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toFixed(0)}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: t.pnl_pct >= 0 ? '#10B981' : '#F43F5E' }}>
                          {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                        </td>
                        <td style={{ padding: '8px 10px', color: '#94A3B8', fontSize: '0.66rem' }}>{t.exit_reason}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, color: t.result === 'WIN' ? '#34D399' : '#F87171', background: t.result === 'WIN' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', padding: '2px 6px', borderRadius: 4 }}>
                            {t.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: Monte Carlo ── */}
          {activeTab === 'montecarlo' && data.monte_carlo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Zap size={16} color="#C084FC" />
                  <strong style={{ fontSize: '0.9rem' }}>Monte Carlo Robustness Test (500 Random Permutations)</strong>
                </div>
                <p style={{ fontSize: '0.76rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 14px' }}>
                  Randomly shuffles the strategy's daily return sequence 500 times to test if the observed edge is statistically robust or simply a product of lucky ordering.
                  If the real Sharpe ({fmtNum(data.sharpe_ratio)}) is above the 95th percentile ({fmtNum(data.monte_carlo.sharpe_p95)}) of the simulated distribution, the strategy has demonstrated genuine alpha.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Sharpe 5th %ile', value: fmtNum(data.monte_carlo.sharpe_p5), col: '#F43F5E' },
                    { label: 'Sharpe Median (50th)', value: fmtNum(data.monte_carlo.sharpe_p50), col: '#F59E0B' },
                    { label: 'Sharpe 95th %ile', value: fmtNum(data.monte_carlo.sharpe_p95), col: '#10B981' },
                    { label: 'Your Observed Sharpe', value: fmtNum(data.sharpe_ratio), col: '#818CF8' },
                    { label: '% Profitable Simulations', value: `${data.monte_carlo.pct_profitable}%`, col: data.monte_carlo.pct_profitable >= 60 ? '#10B981' : '#F59E0B' },
                    { label: 'Final Val 5th %ile', value: fmtRs(data.monte_carlo.final_p5), col: '#F43F5E' },
                    { label: 'Final Val 95th %ile', value: fmtRs(data.monte_carlo.final_p95), col: '#10B981' },
                  ].map((item, i) => (
                    <MetricCard key={i} label={item.label} value={item.value} col={item.col} />
                  ))}
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}
