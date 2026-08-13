import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

// ── Macro Card ────────────────────────────────────────────────────────────────
function MacroCard({ data, isLarge }) {
  const { label, value, unit, trend, signal, description } = data;

  const signalColors = {
    positive: { bg: '#064e3b', border: '#10B98160', text: '#34D399', badge: 'Market Positive' },
    negative: { bg: '#450a0a', border: '#F43F5E60', text: '#F87171', badge: 'Market Risk' },
    neutral:  { bg: '#1a1530', border: '#6366F130', text: '#A78BFA', badge: 'Neutral' },
  };
  const sc = signalColors[signal] || signalColors.neutral;

  const trendIcon = { up: '↑', down: '↓', flat: '→' }[trend] || '→';
  const trendColor = { up: '#10B981', down: '#F43F5E', flat: '#F59E0B' }[trend] || '#F59E0B';

  // Format value display
  let displayValue = value;
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000) {
      displayValue = value >= 0
        ? `+${(value / 100).toFixed(1)}K`
        : `${(value / 100).toFixed(1)}K`;
    } else {
      displayValue = value.toFixed(2);
    }
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${sc.bg}, #0C1022)`,
      border: `1px solid ${sc.border}`,
      borderRadius: 16, padding: isLarge ? '24px' : '18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${sc.border}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Decorative glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        background: `radial-gradient(circle, ${sc.text}15, transparent)`,
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280',
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 600, color: sc.text,
          background: `${sc.text}18`, border: `1px solid ${sc.text}40`,
          borderRadius: 6, padding: '2px 7px'
        }}>{sc.badge}</span>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: isLarge ? '2.2rem' : '1.8rem', fontWeight: 900,
          color: sc.text, fontFamily: 'Space Grotesk, sans-serif',
          textShadow: `0 0 20px ${sc.text}40`,
        }}>
          {unit && unit !== '%' && unit !== '' && !unit.startsWith('₹') ? '' : ''}
          {unit === '₹' || unit === '₹Cr' ? unit : ''}{displayValue}{unit === '%' ? '%' : ''}
          {unit === '₹Cr' ? '' : ''}
        </span>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: trendColor }}>
          {trendIcon}
        </span>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4 }}>
        {description}
      </p>
    </div>
  );
}

// ── Overall Signal Bar ────────────────────────────────────────────────────────
function OverallMacroBar({ positive, negative, overall }) {
  const total = positive + negative + (6 - positive - negative);
  const posPct = (positive / 6) * 100;
  const negPct = (negative / 6) * 100;

  const overallColor = overall === 'Bullish' ? '#10B981' : overall === 'Bearish' ? '#F43F5E' : '#F59E0B';
  const overallIcon = overall === 'Bullish' ? '🐂' : overall === 'Bearish' ? '🐻' : '⚖️';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0C1022, #10142a)',
      border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Macro Environment
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: overallColor }}>
            {overallIcon} {overall} for Markets
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981' }}>{positive}</div>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Positive</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F43F5E' }}>{negative}</div>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Negative</div>
          </div>
        </div>
      </div>

      {/* Signal bar */}
      <div style={{ height: 8, background: '#F43F5E22', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        <div style={{
          width: `${posPct}%`, height: '100%',
          background: 'linear-gradient(90deg, #10B981, #34D399)',
          borderRadius: 4, transition: 'width 1s ease'
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: '0.7rem', color: '#10B981' }}>{positive} Market-Positive signals</span>
        <span style={{ fontSize: '0.7rem', color: '#F43F5E' }}>{negative} Risk signals</span>
      </div>
    </div>
  );
}

export default function MacroPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/macro')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load macro economic data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spinner" />
      <p style={{ color: '#6366F1', fontSize: '0.9rem' }}>Fetching live macro-economic data…</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#F43F5E', marginBottom: 12 }}>{error}</div>
      <button onClick={load} style={{
        background: '#6366F1', color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600
      }}>Retry</button>
    </div>
  );

  const summary = data?._summary || {};
  const indicators = data ? Object.entries(data).filter(([k]) => k !== '_summary') : [];

  // Order indicators in desired card layout
  const order = ['repo_rate', 'india_cpi', 'usd_inr', 'us10y', 'india_vix', 'fii_net', 'dii_net'];
  const ordered = order.map(k => data?.[k] ? [k, data[k]] : null).filter(Boolean);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #F59E0B, #F97316)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>
            Macro-Economic Data
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
            Live indicators from RBI, NSE, stooq · Refreshed every 3 hours
          </p>
        </div>
        <button onClick={load} style={{
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          color: '#F59E0B', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 600
        }}>↺ Refresh</button>
      </div>

      {/* Overall signal bar */}
      <OverallMacroBar
        positive={summary.positive_signals ?? 0}
        negative={summary.negative_signals ?? 0}
        overall={summary.overall ?? 'Neutral'}
      />

      {/* Indicator cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {ordered.map(([key, item]) => (
          <MacroCard key={key} data={item} isLarge={false} />
        ))}
      </div>

      {/* What it means panel */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1022, #10142a)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          What This Means for NSE Stocks
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: '🏦', title: 'RBI Repo Rate', text: 'Lower rates → cheaper credit → higher PE multiples. Cut in Feb 2025 is bullish for rate-sensitive sectors (Banking, Real Estate, NBFCs).' },
            { icon: '📈', title: 'CPI Inflation', text: 'Falling CPI (~3.6%) gives RBI room for further rate cuts. Bullish for consumption-driven stocks and bonds.' },
            { icon: '💱', title: 'USD/INR', text: 'INR depreciation hurts IT exporters\' revenue in USD but benefits them in INR. Watch for FII outflows at INR > 86.' },
            { icon: '🌐', title: 'US 10Y Yield', text: 'High US yields pull FII money from EMs like India. Rising yields → pressure on Indian equity valuations.' },
            { icon: '🏢', title: 'FII/DII Flows', text: 'Net FII buying is typically bullish for large-caps. DII support cushions market falls even during FII outflows.' },
            { icon: '😨', title: 'India VIX', text: 'VIX < 13 = low fear (complacency risk). VIX > 20 = high fear (potential buying opportunity). Currently in normal zone.' },
          ].map(item => (
            <div key={item.title} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10, padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                <span style={{ fontWeight: 700, color: '#9CA3AF', fontSize: '0.8rem' }}>{item.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5 }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '0.72rem', color: '#374151', textAlign: 'center' }}>
        ⚠️ Macro data is sourced from free public feeds and may have slight delays. Not financial advice.
      </div>
    </div>
  );
}
