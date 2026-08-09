import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';

/* ─── Timeframe config ───────────────────────────────────────────────────────
   label   → shown on the button
   period  → sent to backend as `timeframe`
   interval→ sent to backend as `interval`
   ─────────────────────────────────────────────────────────────────────────── */
export const TIMEFRAMES = [
  { label: '1m',     period: '1D',  interval: '1m'  },
  { label: '5m',     period: '5D',  interval: '5m'  },
  { label: '15m',    period: '5D',  interval: '15m' },
  { label: '30m',    period: '1M',  interval: '15m' },
  { label: '1hr',    period: '1M',  interval: '1h'  },
  { label: '2hr',    period: '3M',  interval: '1h'  },
  { label: '4hr',    period: '6M',  interval: '1h'  },
  { label: '1day',   period: '1Y',  interval: '1d'  },
  { label: '3month', period: '3M',  interval: '1d'  },
  { label: '1y',     period: '1Y',  interval: '1d'  },
  { label: '2y',     period: '2Y',  interval: '1d'  },
  { label: '5y',     period: '5Y',  interval: '1d'  },
];

/* Custom tooltip */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const close = payload[0]?.value;
  const sma20 = payload[1]?.value;
  const sma50 = payload[2]?.value;
  return (
    <div style={{
      background: '#0C1022',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: '0.78rem',
      color: '#9CA3AF',
      minWidth: 160,
    }}>
      <div style={{ color: '#F0F0FF', fontWeight: 600, marginBottom: 6, fontFamily: 'JetBrains Mono' }}>{label}</div>
      {close != null && <div>Close&nbsp;&nbsp;<span style={{ color: '#6366F1', fontFamily: 'JetBrains Mono' }}>₹{Number(close).toFixed(2)}</span></div>}
      {sma20 != null && <div>SMA20&nbsp;&nbsp;<span style={{ color: '#06B6D4', fontFamily: 'JetBrains Mono' }}>₹{Number(sma20).toFixed(2)}</span></div>}
      {sma50 != null && <div>SMA50&nbsp;&nbsp;<span style={{ color: '#F59E0B', fontFamily: 'JetBrains Mono' }}>₹{Number(sma50).toFixed(2)}</span></div>}
    </div>
  );
}

export default function StockChart({ history, prediction, timeframe, onTimeframeChange }) {
  if (!history || history.length === 0) return <div className="spinner" />;

  const isUp = history.length > 1
    ? history[history.length - 1].close >= history[0].close
    : true;

  const strokeColor  = isUp ? '#10B981' : '#F43F5E';
  const fillColorTop = isUp ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)';
  const fillColorBot = isUp ? 'rgba(16,185,129,0.0)'  : 'rgba(244,63,94,0.0)';

  // Thin the x-axis labels based on dataset size
  const tickCount = history.length > 200 ? 6 : history.length > 60 ? 8 : 10;

  // Format x label based on granularity
  const tfObj = TIMEFRAMES.find(t => t.label === timeframe) || TIMEFRAMES[7];
  const isIntraday = ['1m','5m','15m','30m'].includes(tfObj.label);
  const formatX = (v) => {
    if (!v) return '';
    try {
      if (isIntraday && v.includes('T')) {
        return v.split('T')[1]?.slice(0, 5) || v.slice(-5);
      }
      const d = new Date(v);
      if (isNaN(d)) return v;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch { return v; }
  };

  const predPoint = prediction?.predicted_price_7d
    ? { date: '→ 7D', close: prediction.predicted_price_7d, isPred: true }
    : null;

  const chartData = predPoint ? [...history, predPoint] : history;

  return (
    <div>
      {/* ── Timeframe row ── single scrollable line ── */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 14,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        {TIMEFRAMES.map(t => (
          <button
            key={t.label}
            onClick={() => onTimeframeChange(t.label)}
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              borderRadius: 6,
              border: timeframe === t.label
                ? '1px solid rgba(99,102,241,0.7)'
                : '1px solid rgba(255,255,255,0.08)',
              background: timeframe === t.label
                ? 'rgba(99,102,241,0.18)'
                : 'rgba(255,255,255,0.04)',
              color: timeframe === t.label ? '#a5b4fc' : '#6B7280',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Chart ── */}
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradClose" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={fillColorTop.replace('0.18', '1')} stopOpacity={0.18} />
                <stop offset="95%" stopColor={fillColorBot.replace('0.0', '1')}  stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.07)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#4B5563', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatX}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#4B5563', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            {prediction?.predicted_price_7d && (
              <ReferenceLine
                x="→ 7D"
                stroke="#F43F5E"
                strokeDasharray="4 3"
                label={{ value: '7D pred', fill: '#F43F5E', fontSize: 10 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={1.8}
              dot={false}
              fill="url(#gradClose)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="sma_20"
              stroke="#06B6D4"
              strokeWidth={1.2}
              strokeDasharray="5 4"
              dot={false}
              fill="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="sma_50"
              stroke="#F59E0B"
              strokeWidth={1.2}
              strokeDasharray="5 4"
              dot={false}
              fill="none"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
