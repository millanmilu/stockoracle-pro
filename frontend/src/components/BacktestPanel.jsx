import { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useStock } from '../hooks/useStock'
import { fmt } from '../utils/formatters'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 120, padding: '14px 16px',
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.14)',
      borderRadius: 12
    }}>
      <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        fontSize: '1.1rem',
        color: color || '#F0F0FF'
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.72rem', color: '#4B5563', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

export default function BacktestPanel({ ticker }) {
  const { fetchBacktest } = useStock()
  const [data, setData]   = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setError(null)
    fetchBacktest(ticker).then(res => {
      if (!res) setError('Backtest failed or no model trained yet. Train the LSTM model in AI Lab first.')
      else setData(res)
    })
  }, [ticker])

  if (error) {
    return (
      <div style={{
        padding: '14px 16px', marginTop: 8,
        background: 'rgba(244,63,94,0.07)',
        border: '1px solid rgba(244,63,94,0.2)',
        borderRadius: 12, color: '#F43F5E', fontSize: '0.85rem'
      }}>
        ❌ {error}
      </div>
    )
  }

  if (!data) return <div className="spinner" />

  const {
    initial_capital, final_value, total_trades, win_rate,
    cagr, sharpe_ratio, max_drawdown, cumulative_return,
    benchmark_return, equity_curve, benchmark_curve
  } = data

  const alpha = cumulative_return - benchmark_return

  // Chart data — sample every N points to keep chart readable
  const stride = Math.max(1, Math.floor(equity_curve.length / 80))
  const sampled = equity_curve.filter((_, i) => i % stride === 0)
  const sampledBench = benchmark_curve.filter((_, i) => i % stride === 0)

  const chartData = {
    labels: sampled.map(p => p.date),
    datasets: [
      {
        label: 'AI Strategy',
        data: sampled.map(p => p.pct_change),
        borderColor: '#6366F1',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
      {
        label: 'Buy & Hold (Benchmark)',
        data: sampledBench.map(p => p.pct_change),
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#0C1022',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        titleColor: '#F0F0FF',
        bodyColor: '#9CA3AF',
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${ctx.raw >= 0 ? '+' : ''}${Number(ctx.raw).toFixed(2)}%`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#4B5563', maxTicksLimit: 7, font: { size: 10, family: 'JetBrains Mono' } },
        grid: { color: 'rgba(99,102,241,0.06)' },
      },
      y: {
        ticks: {
          color: '#4B5563',
          font: { size: 10, family: 'JetBrains Mono' },
          callback: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
        },
        grid: { color: 'rgba(99,102,241,0.06)' },
      }
    }
  }

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: 16 }}>
        Simulated on last ~120 trading days · Initial capital: {fmt.price(initial_capital)}
      </p>

      {/* Metric Cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <MetricCard
          label="Final Portfolio"
          value={fmt.price(final_value)}
          sub={`Started at ${fmt.price(initial_capital)}`}
          color={final_value >= initial_capital ? '#10B981' : '#F43F5E'}
        />
        <MetricCard
          label="Strategy Return"
          value={`${cumulative_return >= 0 ? '+' : ''}${(cumulative_return * 100).toFixed(2)}%`}
          sub={`Benchmark: ${benchmark_return >= 0 ? '+' : ''}${(benchmark_return * 100).toFixed(2)}%`}
          color={cumulative_return >= 0 ? '#10B981' : '#F43F5E'}
        />
        <MetricCard
          label="Alpha (vs B&H)"
          value={`${alpha >= 0 ? '+' : ''}${(alpha * 100).toFixed(2)}%`}
          sub="vs buy-and-hold"
          color={alpha >= 0 ? '#10B981' : '#F43F5E'}
        />
        <MetricCard
          label="CAGR"
          value={`${cagr >= 0 ? '+' : ''}${(cagr * 100).toFixed(2)}%`}
          sub="Annualised"
          color={cagr >= 0 ? '#10B981' : '#F43F5E'}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={sharpe_ratio.toFixed(2)}
          sub="Risk-adjusted return"
          color={sharpe_ratio >= 1 ? '#10B981' : sharpe_ratio >= 0 ? '#F59E0B' : '#F43F5E'}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${(max_drawdown * 100).toFixed(2)}%`}
          sub="Peak-to-trough"
          color={max_drawdown > -0.1 ? '#10B981' : max_drawdown > -0.2 ? '#F59E0B' : '#F43F5E'}
        />
        <MetricCard
          label="Win Rate"
          value={`${(win_rate * 100).toFixed(1)}%`}
          sub={`${total_trades} total trades`}
          color={win_rate >= 0.55 ? '#10B981' : win_rate >= 0.45 ? '#F59E0B' : '#F43F5E'}
        />
      </div>

      {/* Equity Curve Chart */}
      <div style={{
        background: 'rgba(6,9,24,0.6)', border: '1px solid rgba(99,102,241,0.1)',
        borderRadius: 14, padding: '16px 16px 12px'
      }}>
        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 12, fontFamily: 'JetBrains Mono, monospace' }}>
          CUMULATIVE RETURN (%) — AI Strategy vs Buy & Hold
        </div>
        <div style={{ height: 260 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Methodology note */}
      <div style={{
        marginTop: 14, padding: '10px 14px',
        background: 'rgba(99,102,241,0.05)',
        border: '1px solid rgba(99,102,241,0.12)',
        borderRadius: 10, fontSize: '0.75rem', color: '#4B5563', lineHeight: 1.6
      }}>
        📋 <strong style={{ color: '#6B7280' }}>Methodology:</strong> Buy when predicted 7-day return &gt; 1.5%.
        Exit on 4% stop-loss, 8% take-profit, or bearish signal. Simulated without commission or slippage.
      </div>
    </div>
  )
}
