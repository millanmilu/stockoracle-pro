import React, { useState, useCallback, useMemo, useEffect } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import { 
  Play, RefreshCw, Settings, TrendingUp, TrendingDown, 
  Shield, Award, AlertTriangle, BookOpen, BarChart2, Zap,
  Download, Copy, Check, Search, Info, HelpCircle, Layers,
  ChevronRight, Calendar, DollarSign
} from 'lucide-react';

const QUICK_TICKERS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'ZEEL', 'WIPRO', 'BTC', 'GOLD'];

const STRATEGIES = [
  { id: 'ai_ensemble', name: 'AI Walk-Forward ML', desc: 'XGBoost + ElasticNet ensemble on causal causal features', icon: '🤖', badge: 'AI' },
  { id: 'ema_crossover', name: 'EMA Golden Cross', desc: 'Fast vs Slow Exponential Moving Average trend crossover', icon: '📈', badge: 'TREND' },
  { id: 'rsi_mean_reversion', name: 'RSI + BB Mean Reversion', desc: 'Oversold lower band dip buyer with mean target', icon: '🎯', badge: 'REVERSION' },
  { id: 'momentum_breakout', name: '20D Momentum Breakout', desc: 'Donchian channel breakout with volume expansion', icon: '🚀', badge: 'MOMENTUM' },
  { id: 'macd_crossover', name: 'MACD Momentum Cross', desc: 'MACD line cross above signal with positive momentum', icon: '🌊', badge: 'MACD' },
  { id: 'supertrend', name: 'Supertrend Volatility', desc: 'Dynamic ATR-based trailing trend-following stop', icon: '🛡️', badge: 'VOLATILITY' },
];

const PRESETS = [
  {
    name: 'Conservative',
    icon: '🛡️',
    desc: 'Tight stop loss & disciplined mean reversion',
    strategy: 'rsi_mean_reversion',
    params: { stop_loss: 3.0, take_profit: 6.0, trailing_stop_pct: 2.0, max_holding_days: 15, position_size_pct: 80 }
  },
  {
    name: 'Momentum Trend',
    icon: '🚀',
    desc: 'Breakout run with wide profit targets',
    strategy: 'momentum_breakout',
    params: { stop_loss: 5.0, take_profit: 15.0, trailing_stop_pct: 4.0, max_holding_days: 35, position_size_pct: 100 }
  },
  {
    name: 'Quant AI',
    icon: '🤖',
    desc: 'Walk-forward ML predictive edge',
    strategy: 'ai_ensemble',
    params: { entry_threshold: 1.5, stop_loss: 4.0, take_profit: 8.0, trailing_stop_pct: 3.0, max_holding_days: 20, position_size_pct: 100 }
  },
  {
    name: 'Swing Cross',
    icon: '⚡',
    desc: 'Fast 9/21 EMA trend following',
    strategy: 'ema_crossover',
    params: { fast_period: 9, slow_period: 21, stop_loss: 3.5, take_profit: 7.5, trailing_stop_pct: 2.5, max_holding_days: 20, position_size_pct: 100 }
  }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BacktestPanel({ ticker: propTicker }) {
  const globalSymbol = useStore((s) => s.selectedSymbol);
  const setGlobalSymbol = useStore((s) => s.setSelectedSymbol);

  const [activeTicker, setActiveTicker] = useState((propTicker || globalSymbol || 'RELIANCE').toUpperCase());
  const [searchInput, setSearchInput] = useState('');
  const [strategy, setStrategy] = useState('ai_ensemble');

  const isCrypto = useMemo(() => {
    const t = activeTicker.toUpperCase();
    return t.includes('USD') || t.includes('USDT') || ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'].includes(t);
  }, [activeTicker]);

  const currSymbol = isCrypto ? '$' : '₹';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [showSettings, setShowSettings] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Trade journal filters
  const [journalFilter, setJournalFilter] = useState('ALL'); // 'ALL' | 'WIN' | 'LOSS'
  const [journalSearch, setJournalSearch] = useState('');

  // Configurable Parameters
  const [params, setParams] = useState({
    initial_capital: 100000,
    position_size_pct: 100,
    entry_threshold: 1.5,
    stop_loss: 4.0,
    take_profit: 8.0,
    trailing_stop_pct: 2.5,
    bearish_exit_threshold: 1.0,
    train_test_split: 70,
    max_holding_days: 20,
    fast_period: 9,
    slow_period: 21,
    rsi_oversold: 30,
    rsi_overbought: 70,
    atr_multiplier: 2.0,
    slippage_bps: 10,
    commission_bps: 5,
  });

  const runBacktest = useCallback(async (overrideTicker, overrideStrategy, overrideParams) => {
    const targetTicker = (overrideTicker || activeTicker).toUpperCase().trim();
    const targetStrategy = overrideStrategy || strategy;
    const currentParams = overrideParams || params;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/stock/${targetTicker}/backtest`, {
        params: {
          strategy: targetStrategy,
          initial_capital: currentParams.initial_capital,
          position_size_pct: currentParams.position_size_pct,
          entry_threshold: currentParams.entry_threshold / 100,
          stop_loss: currentParams.stop_loss / 100,
          take_profit: currentParams.take_profit / 100,
          trailing_stop_pct: currentParams.trailing_stop_pct,
          bearish_exit_threshold: -(currentParams.bearish_exit_threshold / 100),
          train_test_split: currentParams.train_test_split / 100,
          max_holding_days: currentParams.max_holding_days,
          fast_period: currentParams.fast_period,
          slow_period: currentParams.slow_period,
          rsi_oversold: currentParams.rsi_oversold,
          rsi_overbought: currentParams.rsi_overbought,
          atr_multiplier: currentParams.atr_multiplier,
          slippage_bps: currentParams.slippage_bps,
          commission_bps: currentParams.commission_bps,
        }
      });

      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Backtest execution failed. Please verify ticker and parameter ranges.');
    } finally {
      setLoading(false);
    }
  }, [activeTicker, strategy, params]);

  // Initial load & ticker synchronization
  useEffect(() => {
    if (propTicker && propTicker.toUpperCase() !== activeTicker) {
      setActiveTicker(propTicker.toUpperCase());
    }
  }, [propTicker]);

  // Execute backtest on ticker switch or strategy switch
  useEffect(() => {
    runBacktest();
  }, [activeTicker, strategy]);

  const handleTickerSelect = (t) => {
    const clean = t.toUpperCase();
    setActiveTicker(clean);
    if (setGlobalSymbol) setGlobalSymbol(clean);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handleTickerSelect(searchInput.trim());
      setSearchInput('');
    }
  };

  const applyPreset = (preset) => {
    setStrategy(preset.strategy);
    const merged = { ...params, ...preset.params };
    setParams(merged);
    runBacktest(activeTicker, preset.strategy, merged);
  };

  // Formatters
  const fmtPct = (v, d = 2) => `${Number(v) >= 0 ? '+' : ''}${(Number(v) * 100).toFixed(d)}%`;
  const fmtNum = (v, d = 2) => Number(v || 0).toFixed(d);
  const fmtCurr = (v) => `${currSymbol}${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const color = (v, thresh = 0) => Number(v) >= thresh ? '#10B981' : '#F43F5E';

  // Copy Markdown Quant Report
  const handleCopyReport = () => {
    if (!data) return;
    const report = [
      `# Quantitative Backtest Report — ${data.ticker}`,
      `**Strategy**: ${data.strategy_label} (${data.strategy})`,
      `**Initial Capital**: ${fmtCurr(data.initial_capital)} | **Final Portfolio**: ${fmtCurr(data.final_value)}`,
      `**Total Return**: ${fmtPct(data.cumulative_return)} | **Buy & Hold Benchmark**: ${fmtPct(data.benchmark_return)} | **Alpha**: ${fmtPct(data.alpha)}`,
      `**CAGR**: ${fmtPct(data.cagr)} | **Sharpe Ratio**: ${fmtNum(data.sharpe_ratio)} | **Sortino**: ${fmtNum(data.sortino_ratio)} | **Calmar**: ${fmtNum(data.calmar_ratio)}`,
      `**Max Drawdown**: ${fmtPct(data.max_drawdown)} | **Profit Factor**: ${fmtNum(data.profit_factor)}`,
      `**Win Rate**: ${(data.win_rate * 100).toFixed(1)}% (${data.winning_trades}W / ${data.losing_trades}L across ${data.total_trades} trades)`,
      `**Payoff Ratio**: ${fmtNum(data.payoff_ratio)} | **Avg Win**: +${fmtNum(data.avg_win_pct)}% | **Avg Loss**: ${fmtNum(data.avg_loss_pct)}%`,
      `**Total Frictions Paid**: ${fmtCurr(data.total_frictions_paid)} (Slippage: ${fmtCurr(data.total_slippage_paid)}, Brokerage: ${fmtCurr(data.total_commissions_paid)})`,
      `**Out-of-Sample Days**: ${data.backtest_days} trading days starting ${data.out_of_sample_start}`,
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2200);
  };

  // Export Trade Journal to CSV
  const handleExportCSV = () => {
    if (!data?.trade_journal || data.trade_journal.length === 0) return;
    const headers = ['Trade ID', 'Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'Hold Days', 'Invested', 'P&L', 'P&L %', 'Exit Reason', 'Result', 'Frictions'];
    const rows = data.trade_journal.map(t => [
      t.trade_id,
      t.entry_date,
      t.exit_date,
      t.entry_price,
      t.exit_price,
      t.holding_days,
      t.invested_capital,
      t.pnl,
      t.pnl_pct,
      t.exit_reason,
      t.result,
      t.frictions_paid
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `backtest_${data.ticker}_${data.strategy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered trades for journal tab
  const filteredTrades = useMemo(() => {
    if (!data?.trade_journal) return [];
    return data.trade_journal.filter(t => {
      if (journalFilter === 'WIN' && t.result !== 'WIN') return false;
      if (journalFilter === 'LOSS' && t.result !== 'LOSS') return false;
      if (journalSearch.trim()) {
        const q = journalSearch.toLowerCase();
        const matchesDate = t.entry_date?.toLowerCase().includes(q) || t.exit_date?.toLowerCase().includes(q);
        const matchesReason = t.exit_reason?.toLowerCase().includes(q);
        if (!matchesDate && !matchesReason) return false;
      }
      return true;
    });
  }, [data, journalFilter, journalSearch]);

  const MetricCard = ({ label, value, sub, col, icon: Icon }) => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 10, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: '0.64rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
        {Icon && <Icon size={12} style={{ color: '#475569' }} />}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: col || '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.63rem', color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1350, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Cockpit Header Strip ── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.9))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Title & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.15))',
              border: '1px solid rgba(99,102,241,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8'
            }}>
              <BarChart2 size={19} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Institutional Backtest Studio v3.0 — <span style={{ color: '#818CF8' }}>{activeTicker}</span>
                </h2>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)'
                }}>
                  OUT-OF-SAMPLE
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 1 }}>
                Multi-Strategy Walk-Forward Engine · Zero Look-Ahead Bias · Variable Frictions · Monthly Heatmap
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowGuideModal(true)}
              style={{
                background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: 8, padding: '6px 11px', color: '#38BDF8', fontSize: '0.72rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
              }}>
              <BookOpen size={13} />
              <span>Kaise Use Karein</span>
            </button>

            <button
              onClick={handleCopyReport}
              disabled={!data}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '6px 11px', color: '#94A3B8', fontSize: '0.72rem',
                fontWeight: 700, cursor: data ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 5
              }}>
              {copiedReport ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
              <span>{copiedReport ? 'Copied!' : 'Copy Report'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!data?.trade_journal?.length}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '6px 11px', color: '#94A3B8', fontSize: '0.72rem',
                fontWeight: 700, cursor: data?.trade_journal?.length ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 5
              }}>
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: showSettings ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${showSettings ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, padding: '6px 11px', color: showSettings ? '#818CF8' : '#94A3B8',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
              }}>
              <Settings size={13} />
              <span>Config & Risk</span>
            </button>

            <button
              onClick={() => runBacktest()}
              disabled={loading}
              style={{
                background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                border: 'none', borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: '0.76rem',
                fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(99,102,241,0.35)'
              }}>
              {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
              <span>{loading ? 'Simulating…' : 'Run Backtest'}</span>
            </button>
          </div>
        </div>

        {/* ── Sub-bar: Quick Switcher, Search & Strategy Select ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          {/* Quick Tickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginRight: 4 }}>
              Universe:
            </span>
            {QUICK_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => handleTickerSelect(t)}
                style={{
                  background: activeTicker === t ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeTicker === t ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  color: activeTicker === t ? '#818CF8' : '#94A3B8',
                  padding: '3px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}>
                {t}
              </button>
            ))}

            {/* Inline Search */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
              <div style={{
                position: 'relative', display: 'flex', alignItems: 'center',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '2px 6px'
              }}>
                <Search size={11} color="#64748B" style={{ marginRight: 4 }} />
                <input
                  type="text"
                  placeholder="Custom Ticker..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#F8FAFC', fontSize: '0.68rem', width: 90
                  }}
                />
              </div>
            </form>
          </div>

          {/* Strategy Dropdown & Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Strategy:
              </span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                style={{
                  background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.4)',
                  color: '#818CF8', borderRadius: 6, padding: '4px 8px', fontSize: '0.72rem',
                  fontWeight: 700, outline: 'none', cursor: 'pointer'
                }}>
                {STRATEGIES.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Presets Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  title={p.desc}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94A3B8', padding: '3px 7px', borderRadius: 5, fontSize: '0.64rem',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3
                  }}>
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Configurable Params Drawer ── */}
      {showSettings && (
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { key: 'initial_capital', label: `Initial Capital (${currSymbol})`, min: 10000, max: 5000000, step: 10000 },
              { key: 'position_size_pct', label: 'Position Sizing (% Equity)', min: 10, max: 100, step: 5 },
              { key: 'stop_loss', label: 'Stop Loss (%)', min: 1.0, max: 15.0, step: 0.5 },
              { key: 'take_profit', label: 'Take Profit (%)', min: 2.0, max: 25.0, step: 0.5 },
              { key: 'trailing_stop_pct', label: 'Trailing Stop (%)', min: 0.0, max: 10.0, step: 0.5 },
              { key: 'max_holding_days', label: 'Max Holding Period (Days)', min: 3, max: 60, step: 1 },
              { key: 'train_test_split', label: 'Train/Test Split (Train %)', min: 50, max: 85, step: 5 },
              { key: 'slippage_bps', label: 'Slippage (Basis Points)', min: 0, max: 50, step: 5 },
              { key: 'commission_bps', label: 'Commission / STT (Bps)', min: 0, max: 30, step: 1 },
              { key: 'fast_period', label: 'Fast Period (EMA / Donchian)', min: 3, max: 30, step: 1 },
              { key: 'slow_period', label: 'Slow Period (EMA / Donchian)', min: 10, max: 100, step: 2 },
              { key: 'rsi_oversold', label: 'RSI Oversold Level', min: 20, max: 40, step: 1 },
            ].map(({ key, label, min, max, step }) => (
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
      )}

      {/* ── Error Notification ── */}
      {error && (
        <div style={{
          padding: '12px 16px', background: 'rgba(244,63,94,0.08)',
          border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10,
          color: '#F43F5E', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div style={{ padding: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <RefreshCw size={32} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#818CF8', fontWeight: 700, fontSize: '0.9rem' }}>
            Simulating {activeTicker} with {data?.strategy_label || strategy}… Computing Monte Carlo 500 permutations…
          </div>
        </div>
      )}

      {/* ── Results Container ── */}
      {data && !loading && (
        <>
          {/* Out of Sample Banner */}
          <div style={{
            background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 8, padding: '8px 14px', fontSize: '0.72rem', color: '#38BDF8',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={14} />
              <span>
                <strong>Pure Out-of-Sample Results</strong> — In-sample training up to <strong>{data.out_of_sample_start}</strong> ({data.train_test_split_pct}%).
                Testing on remaining {data.backtest_days} trading sessions.
              </span>
            </div>
            <span style={{ color: '#94A3B8', fontSize: '0.66rem' }}>
              Active Strategy: <strong style={{ color: '#F8FAFC' }}>{data.strategy_label}</strong>
            </span>
          </div>

          {/* KPI Matrix Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
            <MetricCard
              label="Final Portfolio"
              value={fmtCurr(data.final_value)}
              sub={`Started: ${fmtCurr(data.initial_capital)}`}
              col={color(data.cumulative_return)}
              icon={DollarSign}
            />
            <MetricCard
              label="Strategy Return"
              value={fmtPct(data.cumulative_return)}
              sub={`B&H Benchmark: ${fmtPct(data.benchmark_return)}`}
              col={color(data.cumulative_return)}
              icon={TrendingUp}
            />
            <MetricCard
              label="Alpha vs B&H"
              value={fmtPct(data.alpha)}
              sub={`Beta: ${fmtNum(data.beta)}`}
              col={color(data.alpha)}
              icon={Award}
            />
            <MetricCard
              label="CAGR"
              value={fmtPct(data.cagr)}
              sub="Annualised growth"
              col={color(data.cagr)}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={fmtNum(data.sharpe_ratio)}
              sub="(rf=6.5%)"
              col={data.sharpe_ratio >= 1.0 ? '#10B981' : data.sharpe_ratio >= 0.5 ? '#F59E0B' : '#F43F5E'}
            />
            <MetricCard
              label="Sortino Ratio"
              value={fmtNum(data.sortino_ratio)}
              sub="Downside risk"
              col={data.sortino_ratio >= 1.0 ? '#10B981' : '#F59E0B'}
            />
            <MetricCard
              label="Calmar Ratio"
              value={fmtNum(data.calmar_ratio)}
              sub="CAGR / Max DD"
              col={data.calmar_ratio >= 0.5 ? '#10B981' : '#F59E0B'}
            />
            <MetricCard
              label="Max Drawdown"
              value={fmtPct(data.max_drawdown)}
              sub={`Recovery: ${fmtNum(data.recovery_factor)}x`}
              col={data.max_drawdown > -0.1 ? '#10B981' : data.max_drawdown > -0.2 ? '#F59E0B' : '#F43F5E'}
              icon={TrendingDown}
            />
            <MetricCard
              label="Win Rate"
              value={`${(data.win_rate * 100).toFixed(1)}%`}
              sub={`${data.winning_trades}W / ${data.losing_trades}L`}
              col={data.win_rate >= 0.5 ? '#10B981' : '#F43F5E'}
            />
            <MetricCard
              label="Profit Factor"
              value={fmtNum(data.profit_factor)}
              sub={`Payoff: ${fmtNum(data.payoff_ratio)}x`}
              col={data.profit_factor >= 1.5 ? '#10B981' : data.profit_factor >= 1.0 ? '#F59E0B' : '#F43F5E'}
            />
            <MetricCard
              label="Trade Expectancy"
              value={`${fmtNum(data.expectancy_pct)}%`}
              sub={`Avg: ${fmtCurr(data.expectancy_val)}`}
              col={color(data.expectancy_pct)}
            />
            <MetricCard
              label="Total Frictions"
              value={fmtCurr(data.total_frictions_paid)}
              sub={`Slip: ${fmtCurr(data.total_slippage_paid)}`}
              col="#94A3B8"
            />
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 8, flexWrap: 'wrap'
          }}>
            {[
              { id: 'summary', label: 'Equity & Benchmark Chart' },
              { id: 'drawdown', label: 'Underwater Drawdown' },
              { id: 'monthly', label: `Monthly Heatmap (${data.monthly_returns?.length || 0})` },
              { id: 'journal', label: `Trade Journal (${data.total_trades})` },
              { id: 'distribution', label: 'P&L Distribution' },
              { id: 'montecarlo', label: 'Monte Carlo Robustness' },
              { id: 'guide', label: 'Kaise Use Karein' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '5px 12px', borderRadius: 8,
                  border: `1px solid ${activeTab === t.id ? 'rgba(99,102,241,0.5)' : 'transparent'}`,
                  background: activeTab === t.id ? 'rgba(99,102,241,0.18)' : 'transparent',
                  color: activeTab === t.id ? '#818CF8' : '#94A3B8',
                  fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease'
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab 1: Equity Curve & Trade Execution Points ── */}
          {activeTab === 'summary' && (
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
                  Total Sessions: {data.equity_curve?.length || 0} days
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
          )}

          {/* ── Tab 2: Underwater Drawdown Curve ── */}
          {activeTab === 'drawdown' && (
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
          )}

          {/* ── Tab 3: Monthly & Annual Heatmap Matrix ── */}
          {activeTab === 'monthly' && (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px', overflowX: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 700 }}>
                  Hedge-Fund Style Monthly Returns Heatmap (%)
                </span>
                <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
                  Green = Profit · Red = Loss
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', minWidth: 650 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left' }}>Year</th>
                    {MONTHS.map(m => (
                      <th key={m} style={{ padding: '8px 4px', textAlign: 'center' }}>{m}</th>
                    ))}
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800 }}>Full Year</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.monthly_matrix || {}).sort((a, b) => b[0] - a[0]).map(([yr, monthData]) => {
                    const yrTotal = monthData['Year'];
                    return (
                      <tr key={yr} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 800, color: '#F8FAFC' }}>{yr}</td>
                        {MONTHS.map(m => {
                          const val = monthData[m];
                          const hasVal = val !== undefined && val !== null;
                          const isPos = val > 0;
                          const isZero = val === 0;
                          const bg = !hasVal ? 'transparent' : isZero ? 'rgba(255,255,255,0.03)' : isPos ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)';
                          const fg = !hasVal ? '#475569' : isZero ? '#94A3B8' : isPos ? '#34D399' : '#F87171';
                          return (
                            <td key={m} style={{
                              padding: '8px 4px', textAlign: 'center', background: bg, color: fg,
                              fontWeight: hasVal ? 700 : 400, fontFamily: 'JetBrains Mono, monospace'
                            }}>
                              {hasVal ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : '—'}
                            </td>
                          );
                        })}
                        <td style={{
                          padding: '8px 6px', textAlign: 'right', fontWeight: 800,
                          color: yrTotal >= 0 ? '#34D399' : '#F87171',
                          background: yrTotal >= 0 ? 'rgba(16,185,129,0.22)' : 'rgba(244,63,94,0.22)',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}>
                          {yrTotal !== undefined ? `${yrTotal >= 0 ? '+' : ''}${yrTotal.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Tab 4: Trade Journal ── */}
          {activeTab === 'journal' && (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12
            }}>
              {/* Journal Filter Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['ALL', 'WIN', 'LOSS'].map(f => (
                      <button
                        key={f}
                        onClick={() => setJournalFilter(f)}
                        style={{
                          padding: '3px 9px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700,
                          border: `1px solid ${journalFilter === f ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          background: journalFilter === f ? 'rgba(99,102,241,0.2)' : 'transparent',
                          color: journalFilter === f ? '#818CF8' : '#94A3B8', cursor: 'pointer'
                        }}>
                        {f === 'ALL' ? `All (${data.total_trades})` : f === 'WIN' ? `Wins (${data.winning_trades})` : `Losses (${data.losing_trades})`}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search date / exit reason..."
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, padding: '4px 8px', fontSize: '0.7rem', color: '#F8FAFC', width: 170
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    Showing: <strong style={{ color: '#F8FAFC' }}>{filteredTrades.length}</strong> trades
                  </span>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
                      borderRadius: 6, padding: '4px 10px', fontSize: '0.68rem', color: '#818CF8',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}>
                    <Download size={12} />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Journal Table */}
              <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                      {['#', 'Entry Date', 'Exit Date', 'Entry Px', 'Exit Px', 'Hold Days', 'P&L', 'P&L %', 'Exit Reason', 'Result'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((t, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '7px 8px', color: '#64748B' }}>{t.trade_id || idx + 1}</td>
                        <td style={{ padding: '7px 8px' }}>{t.entry_date}</td>
                        <td style={{ padding: '7px 8px' }}>{t.exit_date}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'JetBrains Mono, monospace' }}>{currSymbol}{t.entry_price}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'JetBrains Mono, monospace' }}>{currSymbol}{t.exit_price}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center' }}>{t.holding_days}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: t.pnl >= 0 ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                          {t.pnl >= 0 ? '+' : ''}{currSymbol}{t.pnl.toFixed(0)}
                        </td>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: t.pnl_pct >= 0 ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                          {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                        </td>
                        <td style={{ padding: '7px 8px', color: '#94A3B8', fontSize: '0.66rem' }}>{t.exit_reason}</td>
                        <td style={{ padding: '7px 8px' }}>
                          <span style={{
                            fontSize: '0.64rem', fontWeight: 800,
                            color: t.result === 'WIN' ? '#34D399' : '#F87171',
                            background: t.result === 'WIN' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                            padding: '2px 6px', borderRadius: 4
                          }}>
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

          {/* ── Tab 5: P&L Distribution ── */}
          {activeTab === 'distribution' && (
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
          )}

          {/* ── Tab 6: Monte Carlo Robustness ── */}
          {activeTab === 'montecarlo' && data.monte_carlo && (
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
                This test shuffles your strategy's daily return sequence 500 times with random permutation. 
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
          )}

          {/* ── Tab 7: "Kaise Use Karein" Complete Guide ── */}
          {activeTab === 'guide' && (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} color="#818CF8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Backtest Studio — Step-by-Step User Guide (गाइड)
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#818CF8', fontSize: '0.82rem', marginBottom: 6 }}>
                    1. Ticker & Strategy Chunna (Selection)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    Top bar me instant chips (`RELIANCE`, `TCS`, `INFY`, `ICICIBANK`, `BTC`) ya search box se koi bhi stock chunein. Fir Strategy dropdown se apni strategy select karein (jaise EMA Golden Cross ya Supertrend).
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#38BDF8', fontSize: '0.82rem', marginBottom: 6 }}>
                    2. One-Click Presets Use Karein
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    Bina manually settings badle, <strong>Conservative</strong>, <strong>Momentum Trend</strong>, <strong>Quant AI</strong>, ya <strong>Swing Cross</strong> presets par click karein. Ye automatically optimal Stop Loss, Take Profit aur periods set kar dete hain.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.82rem', marginBottom: 6 }}>
                    3. Key Metrics Kaise Samjhein?
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    • <strong>Alpha</strong>: Buy & Hold benchmark se kitna zyada return diya.<br />
                    • <strong>Sharpe & Sortino</strong>: &gt; 1.0 matlab excellent risk-adjusted performance.<br />
                    • <strong>Profit Factor</strong>: &gt; 1.5 matlab strategy profitable aur consistent hai.<br />
                    • <strong>Expectancy</strong>: Har trade par mathematically average expected gain.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#C084FC', fontSize: '0.82rem', marginBottom: 6 }}>
                    4. Heatmap & Journal Export
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    <strong>Monthly Heatmap</strong> tab me saal-dar-saal mahine ka return grid dekhein. <strong>Trade Journal</strong> se individual buy/sell price, holding period aur exit reason filter karke CSV download karein.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal: Comprehensive Kaise Use Karein ── */}
      {showGuideModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#0F172A', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '85vh',
            overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} color="#818CF8" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Backtest Studio — Complete Practical Guide
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6,
                  color: '#94A3B8', padding: '4px 10px', cursor: 'pointer', fontWeight: 800
                }}>
                ✕ Close
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#CBD5E1', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0 }}>
                <strong>Backtest Studio</strong> StockOracle Pro ka institutional-grade walk-forward simulation engine hai. Iska use karke aap kisi bhi strategy ko historical data par test kar sakte hain bina kisi curve-fitting ya look-ahead bias ke.
              </p>

              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: 12, borderRadius: 8 }}>
                <strong style={{ color: '#818CF8' }}>6 Quantitative Strategies Ke Rules:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.74rem' }}>
                  <li><strong>AI Walk-Forward ML</strong>: Machine learning model jo price predict karke statistical edge nikalta hai.</li>
                  <li><strong>EMA Golden Cross</strong>: Fast moving average jab slow moving average ko upar cross karta hai toh buy, niche cross karne par exit.</li>
                  <li><strong>RSI + Bollinger Mean Reversion</strong>: Jab stock oversold (RSI &lt; 30) aur lower band ke paas ho tab buy karta hai, upper band par profit book.</li>
                  <li><strong>20D Momentum Breakout</strong>: 20-day high breakout with heavy volume par buy karta hai (Classic Turtle trading).</li>
                  <li><strong>MACD Signal Cross</strong>: MACD line signal line ke upar aane par bullish entry.</li>
                  <li><strong>Supertrend Volatility Trail</strong>: Dynamic ATR trailing stop jo trend ke sath ride karta hai aur reversal par exit karta hai.</li>
                </ul>
              </div>

              <div>
                <strong style={{ color: '#F8FAFC' }}>Strategy Run Karne Ka Tarika (Step-by-Step):</strong>
                <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.74rem' }}>
                  <li>Upar chips se stock chunein (jaise `RELIANCE` ya `ICICIBANK`).</li>
                  <li>Apni manpasand strategy select karein ya Quick Preset (jaise *Conservative* ya *Momentum*) par click karein.</li>
                  <li>Agar chahein toh <strong>"Config & Risk"</strong> button dabaakar Stop Loss, Take Profit, Trailing Stop ya Slippage adjust karein.</li>
                  <li><strong>Run Backtest</strong> button par click karein.</li>
                  <li>Results me **Equity Curve**, **Drawdown**, **Monthly Heatmap**, aur **Trade Journal** dekhein.</li>
                  <li>Trades ko Excel/CSV me download karne ke liye <strong>"Export CSV"</strong> use karein.</li>
                </ol>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none',
                  borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: '0.78rem',
                  fontWeight: 800, cursor: 'pointer'
                }}>
                Got it (Samajh Aa Gaya)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
