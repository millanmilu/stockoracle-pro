import {
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { cardStyle, labelStyle, valueStyle } from './styles';

function GrowthPill({ value, suffix = "%" }) {
  if (value == null || isNaN(value)) return <span style={{ color: "#64748B" }}>—</span>;
  const isPos = value >= 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: "2px 7px",
      borderRadius: 4,
      fontSize: "0.68rem",
      fontWeight: 700,
      fontFamily: "JetBrains Mono, monospace",
      background: isPos ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 83, 80, 0.12)",
      color: isPos ? "#10B981" : "#EF5350",
      border: `1px solid ${isPos ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 83, 80, 0.25)"}`
    }}>
      {isPos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {isPos ? "+" : ""}{Number(value).toFixed(1)}{suffix}
    </span>
  );
}

// Reusable Empty State Box
function EmptyState({ icon: Icon = Info, title = 'Data Not Available', message, minHeight = 120 }) {
  return (
    <div style={{
      ...cardStyle,
      minHeight,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      border: '1px dashed rgba(255, 255, 255, 0.12)',
      background: 'rgba(15, 23, 42, 0.50)',
      padding: '18px 22px',
      gap: 6,
    }}>
      <Icon size={22} color="#64748B" style={{ opacity: 0.7 }} />
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#CBD5E1' }}>{title}</div>
      {message && <div style={{ fontSize: '0.64rem', color: '#94A3B8', maxWidth: 440, lineHeight: 1.4 }}>{message}</div>}
    </div>
  );
}

// Mini SVG Sparkline Component for Ratio Cards
function Sparkline({ data = [], color = '#10B981', width = 54, height = 20 }) {
  if (!data || data.length < 2) return null;
  const valid = data.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const points = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 6);
    return `${x},${y}`;
  }).join(' ');

  const isUp = valid[valid.length - 1] >= valid[0];
  const strokeColor = color || (isUp ? '#10B981' : '#EF5350');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={width - 2}
        cy={height - 2 - ((valid[valid.length - 1] - min) / range) * (height - 6)}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}

function RatioCard({ label, value, unit = '', colorFn, sub, sparkData, sparkColor }) {
  const color = colorFn ? colorFn(value) : '#F8FAFC';
  return (
    <div style={{ ...cardStyle, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={labelStyle}>{label}</div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div style={{ ...valueStyle, color, marginTop: 2 }}>
        {value != null && value !== '' ? `${typeof value === 'number' ? Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : value}${unit}` : '—'}
      </div>
      {sub && <div style={{ fontSize: '0.60rem', color: '#94A3B8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export { GrowthPill, EmptyState, Sparkline, RatioCard };
