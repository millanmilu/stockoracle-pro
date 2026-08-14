import { fmt } from '../utils/formatters'

export default function TechnicalPanel({ history }) {
  if (!history || history.length === 0) return <div className="spinner" />

  const last = history[history.length - 1]
  const { rsi, macd_hist, close, sma_20, sma_50, bb_pct_b, volatility } = last

  const indicators = [
    {
      name: 'RSI (14)',
      value: rsi != null ? rsi.toFixed(1) : '—',
      signal: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral',
      color: rsi > 70 ? '#F43F5E' : rsi < 30 ? '#10B981' : '#F59E0B',
    },
    {
      name: 'MACD Histogram',
      value: macd_hist != null ? macd_hist.toFixed(4) : '—',
      signal: macd_hist > 0 ? 'Bullish' : 'Bearish',
      color: macd_hist > 0 ? '#10B981' : '#F43F5E',
    },
    {
      name: 'SMA 20',
      value: fmt.price(sma_20),
      signal: close > sma_20 ? 'Price Above ↑' : 'Price Below ↓',
      color: close > sma_20 ? '#10B981' : '#F43F5E',
    },
    {
      name: 'SMA 50',
      value: fmt.price(sma_50),
      signal: close > sma_50 ? 'Price Above ↑' : 'Price Below ↓',
      color: close > sma_50 ? '#10B981' : '#F43F5E',
    },
    {
      name: 'Bollinger %B',
      value: bb_pct_b != null ? bb_pct_b.toFixed(3) : '—',
      signal: bb_pct_b > 0.8 ? 'Near Upper Band' : bb_pct_b < 0.2 ? 'Near Lower Band' : 'Mid Range',
      color: bb_pct_b > 0.8 ? '#F43F5E' : bb_pct_b < 0.2 ? '#10B981' : '#F59E0B',
    },
    {
      name: 'Volatility (20d)',
      value: volatility != null ? (volatility * 100).toFixed(3) + '%' : '—',
      signal: volatility * 100 > 3 ? 'High' : volatility * 100 < 1 ? 'Low' : 'Normal',
      color: volatility * 100 > 3 ? '#F43F5E' : volatility * 100 < 1 ? '#10B981' : '#F59E0B',
    },
  ]

  return (
    <div className="indicators-grid">
      {indicators.map(ind => (
        <div key={ind.name} className="indicator-card">
          <div className="indicator-name">{ind.name}</div>
          <div className="indicator-value" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {ind.value}
          </div>
          <div className="indicator-signal" style={{ color: ind.color }}>
            {ind.signal}
          </div>
        </div>
      ))}
    </div>
  )
}
