import React from 'react';
import { TrendingUp, TrendingDown, Award, DollarSign } from 'lucide-react';
import MetricCard from './MetricCard';
import { fmtPct, fmtNum, fmtCurr as fmtCurrBase, posNegColor as color } from './formatters';

export default function BacktestKpiGrid({ data, currSymbol }) {
  const fmtCurr = (v) => fmtCurrBase(v, currSymbol);
  return (
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

  );
}
