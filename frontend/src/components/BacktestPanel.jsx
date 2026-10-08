import React, { useState, useCallback, useMemo, useEffect } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import { RefreshCw, AlertTriangle, Shield } from 'lucide-react';
import { STRATEGIES } from './backtest/backtestConstants';
import { fmtPct, fmtNum, fmtCurr as fmtCurrBase } from './backtest/formatters';
import BacktestHeader from './backtest/BacktestHeader';
import BacktestParamsDrawer from './backtest/BacktestParamsDrawer';
import BacktestKpiGrid from './backtest/BacktestKpiGrid';
import { EquityCurveTab, DrawdownTab, PnlDistributionTab, MonteCarloTab } from './backtest/BacktestCharts';
import { MonthlyHeatmapTab, TradeJournalTab } from './backtest/BacktestTables';
import { GuideTab, GuideModal } from './backtest/BacktestGuide';

export default function BacktestPanel({ ticker: propTicker }) {
  const globalSymbol = useStore((s) => s.selectedSymbol);
  const setGlobalSymbol = useStore((s) => s.setSelectedSymbol);

  const [activeTicker, setActiveTicker] = useState((propTicker || globalSymbol || 'RELIANCE').toUpperCase());
  const [searchInput, setSearchInput] = useState('');
  const [strategy, setStrategy] = useState('ai_ensemble');
  const [interval, setInterval] = useState('15m');
  const [period, setPeriod] = useState('120D');

  const isCrypto = useMemo(() => {
    const t = activeTicker.toUpperCase();
    return t.includes('USD') || t.includes('USDT') || ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'].includes(t);
  }, [activeTicker]);

  const currSymbol = isCrypto ? '$' : '₹';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [strategyOptions, setStrategyOptions] = useState(STRATEGIES);
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
    risk_per_trade_pct: 1.0,
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
          ...(targetStrategy === 'smc_pro' ? { interval, period } : {}),
          initial_capital: currentParams.initial_capital,
          position_size_pct: currentParams.position_size_pct,
          ...(targetStrategy === 'smc_pro' ? { risk_per_trade_pct: currentParams.risk_per_trade_pct } : {}),
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
  }, [activeTicker, strategy, params, interval, period]);

  // Initial load & ticker synchronization
  useEffect(() => {
    if (propTicker && propTicker.toUpperCase() !== activeTicker) {
      setActiveTicker(propTicker.toUpperCase());
    }
  }, [propTicker]);

  // Execute backtest on ticker switch or strategy switch
  useEffect(() => {
    runBacktest();
  }, [activeTicker, strategy, interval, period]);

  // Custom strategies (backend registry) — builtin list par merge, bina tode
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/api/backtest/strategies');
        const list = res.data?.strategies;
        if (!alive || !Array.isArray(list) || list.length === 0) return;
        const byId = new Map(STRATEGIES.map((s) => [s.id, s]));
        list.forEach((s) => {
          if (!s?.id || byId.has(s.id)) return;
          byId.set(s.id, {
            id: s.id,
            name: s.label || s.id.toUpperCase(),
            desc: s.description || 'Custom user strategy (custom_strategies.py)',
            icon: '🧪',
            badge: 'CUSTOM',
          });
        });
        setStrategyOptions(Array.from(byId.values()));
      } catch (_) {
        // Backend purana ho ya offline — builtin 6 par hi chalo
      }
    })();
    return () => { alive = false; };
  }, []);

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
  const fmtCurr = (v) => fmtCurrBase(v, currSymbol);

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


  return (
    <div style={{ maxWidth: 1350, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Cockpit Header Strip ── */}
      <BacktestHeader
        activeTicker={activeTicker}
        handleTickerSelect={handleTickerSelect}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        handleSearchSubmit={handleSearchSubmit}
        strategy={strategy}
        setStrategy={setStrategy}
        strategyOptions={strategyOptions}
        interval={interval}
        setInterval={setInterval}
        period={period}
        setPeriod={setPeriod}
        applyPreset={applyPreset}
        data={data}
        loading={loading}
        copiedReport={copiedReport}
        handleCopyReport={handleCopyReport}
        handleExportCSV={handleExportCSV}
        setShowGuideModal={setShowGuideModal}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        runBacktest={runBacktest}
      />

      {/* ── Configurable Params Drawer ── */}
      {showSettings && (
      <BacktestParamsDrawer params={params} setParams={setParams} currSymbol={currSymbol} isSmc={strategy === 'smc_pro'} />
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
                Testing on remaining {data.backtest_days} {data.interval ? `${data.interval} candles` : 'trading sessions'}.
              </span>
            </div>
            <span style={{ color: '#94A3B8', fontSize: '0.66rem' }}>
              Active Strategy: <strong style={{ color: '#F8FAFC' }}>{data.strategy_label}</strong>
            </span>
          </div>

          {/* KPI Matrix Grid */}
          <BacktestKpiGrid data={data} currSymbol={currSymbol} />

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
            <EquityCurveTab data={data} />
          )}

          {/* ── Tab 2: Underwater Drawdown Curve ── */}
          {activeTab === 'drawdown' && (
            <DrawdownTab data={data} />
          )}

          {/* ── Tab 3: Monthly & Annual Heatmap Matrix ── */}
          {activeTab === 'monthly' && (
            <MonthlyHeatmapTab data={data} />
          )}

          {/* ── Tab 4: Trade Journal ── */}
          {activeTab === 'journal' && (
            <TradeJournalTab
              data={data}
              isSmc={data.strategy === 'smc_pro'}
              currSymbol={currSymbol}
              filteredTrades={filteredTrades}
              journalFilter={journalFilter}
              setJournalFilter={setJournalFilter}
              journalSearch={journalSearch}
              setJournalSearch={setJournalSearch}
              handleExportCSV={handleExportCSV}
            />
          )}

          {/* ── Tab 5: P&L Distribution ── */}
          {activeTab === 'distribution' && (
            <PnlDistributionTab data={data} />
          )}

          {/* ── Tab 6: Monte Carlo Robustness ── */}
          {activeTab === 'montecarlo' && data.monte_carlo && (
            <MonteCarloTab data={data} currSymbol={currSymbol} />
          )}

          {/* ── Tab 7: "Kaise Use Karein" Complete Guide ── */}
          {activeTab === 'guide' && (
            <GuideTab />
          )}
        </>
      )}

      {/* ── Modal: Comprehensive Kaise Use Karein ── */}
      {showGuideModal && (
        <GuideModal setShowGuideModal={setShowGuideModal} />
      )}

    </div>
  );
}
