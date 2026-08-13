import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

// ── Fear & Greed Arc Gauge ───────────────────────────────────────────────────
function FearGreedGauge({ score, label, color }) {
  const radius = 80;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={200} height={120} viewBox="0 0 200 120">
        {/* Background arc */}
        <path
          d={`M ${200 - (200 - 2*radius)/2} 110 A ${radius} ${radius} 0 0 0 ${(200 - 2*radius)/2} 110`}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} strokeLinecap="round"
        />
        {/* Colored filled arc */}
        <path
          d={`M ${200 - (200 - 2*radius)/2} 110 A ${radius} ${radius} 0 0 0 ${(200 - 2*radius)/2} 110`}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Score text */}
        <text x="100" y="88" textAnchor="middle" fontSize="36" fontWeight="800"
          fill={color} fontFamily="'Space Grotesk', sans-serif">
          {score}
        </text>
        {/* Scale labels */}
        <text x="22" y="116" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="Inter">FEAR</text>
        <text x="160" y="116" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="Inter">GREED</text>
      </svg>
      <div style={{
        fontSize: '1.1rem', fontWeight: 700, color,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        textShadow: `0 0 20px ${color}60`
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Sentiment Bar for each ticker ────────────────────────────────────────────
function SentimentBar({ ticker, sentiment, label, color }) {
  const pct = Math.abs(sentiment) * 100;
  const isPos = sentiment >= 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{
        width: 90, fontSize: '0.8rem', fontWeight: 700, color: '#F0F0FF',
        fontFamily: 'JetBrains Mono, monospace'
      }}>{ticker}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Negative side */}
        <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
          {!isPos && (
            <div style={{
              width: `${pct}%`, height: '100%',
              background: 'linear-gradient(90deg, #F43F5E, #F97316)',
              borderRadius: 4, transition: 'width 0.8s ease'
            }} />
          )}
        </div>
        {/* Center line */}
        <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
        {/* Positive side */}
        <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }}>
          {isPos && (
            <div style={{
              width: `${pct}%`, height: '100%',
              background: 'linear-gradient(90deg, #10B981, #34D399)',
              borderRadius: 4, transition: 'width 0.8s ease'
            }} />
          )}
        </div>
      </div>
      <span style={{
        width: 68, fontSize: '0.75rem', fontWeight: 600, color,
        textAlign: 'right', fontFamily: 'JetBrains Mono, monospace'
      }}>
        {sentiment >= 0 ? '+' : ''}{(sentiment * 100).toFixed(1)}%
      </span>
      <span style={{
        width: 60, fontSize: '0.72rem', fontWeight: 600, color,
        background: `${color}18`, border: `1px solid ${color}40`,
        borderRadius: 6, padding: '2px 6px', textAlign: 'center'
      }}>{label}</span>
    </div>
  );
}

// ── Mood Badge ───────────────────────────────────────────────────────────────
function MoodBadge({ count, type }) {
  const cfg = {
    Bullish:  { color: '#10B981', bg: '#10B98118', icon: '▲' },
    Bearish:  { color: '#F43F5E', bg: '#F43F5E18', icon: '▼' },
    Neutral:  { color: '#F59E0B', bg: '#F59E0B18', icon: '◆' },
  }[type] || {};
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: cfg.bg, border: `1px solid ${cfg.color}40`,
      borderRadius: 10, padding: '8px 16px'
    }}>
      <span style={{ color: cfg.color, fontSize: '0.9rem' }}>{cfg.icon}</span>
      <span style={{ fontWeight: 700, fontSize: '1.2rem', color: cfg.color }}>{count}</span>
      <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>{type}</span>
    </div>
  );
}

export default function SentimentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/sentiment/market')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load market sentiment. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spinner" />
      <p style={{ color: '#6366F1', fontSize: '0.9rem' }}>
        Analyzing news sentiment across all tickers with FinBERT AI…
      </p>
      <p style={{ color: '#4B5563', fontSize: '0.8rem' }}>This may take 20–60 seconds on first load.</p>
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

  const { fear_greed_score, fear_greed_label, fear_greed_color, market_mood,
          bull_count, bear_count, neutral_count, tickers = [] } = data || {};

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#F0F0FF',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>
            Market Sentiment Analysis
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
            AI-powered news sentiment across NSE blue chips · Powered by FinBERT
          </p>
        </div>
        <button onClick={load} style={{
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
          color: '#6366F1', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s'
        }}>↺ Refresh</button>
      </div>

      {/* Top row: Gauge + Mood Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* Fear & Greed Gauge */}
        <div style={{
          background: 'linear-gradient(135deg, #0C1022, #10142a)',
          border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16,
          padding: '28px 20px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Fear & Greed Index
          </div>
          <FearGreedGauge
            score={fear_greed_score ?? 50}
            label={fear_greed_label ?? 'Neutral'}
            color={fear_greed_color ?? '#F59E0B'}
          />
          <div style={{
            fontSize: '0.78rem', color: '#4B5563', textAlign: 'center', lineHeight: 1.5
          }}>
            Based on news sentiment, market breadth, momentum & volatility
          </div>
        </div>

        {/* Market Mood + Counts */}
        <div style={{
          background: 'linear-gradient(135deg, #0C1022, #10142a)',
          border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 28
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Market Mood
          </div>

          {/* Big mood label */}
          <div style={{
            fontSize: '2.5rem', fontWeight: 900, marginBottom: 20,
            color: market_mood === 'Bullish' ? '#10B981' : market_mood === 'Bearish' ? '#F43F5E' : '#F59E0B'
          }}>
            {market_mood === 'Bullish' ? '🐂' : market_mood === 'Bearish' ? '🐻' : '⚖️'} {market_mood}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <MoodBadge count={bull_count} type="Bullish" />
            <MoodBadge count={neutral_count} type="Neutral" />
            <MoodBadge count={bear_count} type="Bearish" />
          </div>

          <div style={{ marginTop: 20, padding: '12px 16px',
            background: 'rgba(99,102,241,0.06)', borderRadius: 10,
            borderLeft: '3px solid #6366F1' }}>
            <span style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>
              {bull_count > bear_count
                ? `${bull_count} out of ${tickers.length} stocks show bullish sentiment. Consider focusing on strong momentum plays.`
                : bull_count < bear_count
                  ? `${bear_count} stocks show bearish sentiment. Consider defensive positioning or waiting for reversal signals.`
                  : 'Market sentiment is mixed. Wait for clearer directional signals before taking large positions.'}
            </span>
          </div>
        </div>
      </div>

      {/* Per-ticker sentiment bars */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1022, #10142a)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 28
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Per-Stock Sentiment
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem', color: '#4B5563' }}>
            <span style={{ color: '#F43F5E' }}>◀ Bearish</span>
            <span style={{ color: '#10B981' }}>Bullish ▶</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tickers.map(item => (
            <SentimentBar
              key={item.ticker}
              ticker={item.ticker}
              sentiment={item.sentiment}
              label={item.label}
              color={item.color}
            />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: '0.72rem', color: '#374151', textAlign: 'center' }}>
        ⚠️ Sentiment analysis is based on news headlines only. Not financial advice.
      </div>
    </div>
  );
}
