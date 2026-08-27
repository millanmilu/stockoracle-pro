import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import { RefreshCw, TrendingUp, TrendingDown, Activity, Newspaper, Target, Zap } from 'lucide-react';

/* ─── Gauge ──────────────────────────────────────────────────────────────── */
function SemiGauge({ value, max = 100, color, label, sub }) {
  const r = 72, sw = 13;
  const circ = Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), max) / max) * circ;
  const cx = 90, cy = 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={180} height={110} viewBox="0 0 180 110">
        <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx - r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} strokeLinecap="round" />
        <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx - r} ${cy}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color}80)` }} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={32} fontWeight={900}
          fill={color} fontFamily="'Space Grotesk', sans-serif">{value}</text>
        <text x={18} y={cy + 12} fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter">FEAR</text>
        <text x={148} y={cy + 12} fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter">GREED</text>
      </svg>
      <div style={{ fontWeight: 700, fontSize: '1rem', color, letterSpacing: '0.06em',
        textShadow: `0 0 16px ${color}60`, textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#4B5563', textAlign: 'center' }}>{sub}</div>}
    </div>
  );
}

/* ─── Indicator Chip ─────────────────────────────────────────────────────── */
function IndChip({ label, value, signal, color }) {
  return (
    <div style={{
      background: 'rgba(14,17,38,0.9)', border: `1px solid ${color}30`,
      borderRadius: 12, padding: '12px 14px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.7 }} />
      <div style={{ fontSize: '0.68rem', color: '#4B5563', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F0F0FF',
        fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {signal && <div style={{ fontSize: '0.7rem', color, fontWeight: 600, marginTop: 3 }}>{signal}</div>}
    </div>
  );
}

/* ─── Sentiment Bar ──────────────────────────────────────────────────────── */
function SentBar({ score, color }) {
  const pct = Math.abs(score) * 100;
  const isPos = score >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 20 }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {!isPos && <div style={{ width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #F43F5E, #F97316)', borderRadius: 4,
          transition: 'width 1s ease', boxShadow: '0 0 8px #F43F5E60' }} />}
      </div>
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
      <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {isPos && <div style={{ width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 4,
          transition: 'width 1s ease', boxShadow: '0 0 8px #10B98160' }} />}
      </div>
    </div>
  );
}

/* ─── Verdict Badge ──────────────────────────────────────────────────────── */
function VerdictBadge({ verdict, color, icon }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: `${color}15`, border: `2px solid ${color}50`,
      borderRadius: 14, padding: '10px 22px',
      boxShadow: `0 0 24px ${color}25`
    }}>
      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: 900, color,
        fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em' }}>{verdict}</span>
    </div>
  );
}

/* ─── Level Pill ─────────────────────────────────────────────────────────── */
function LevelPill({ price, type }) {
  const color = type === 'support' ? '#10B981' : '#F43F5E';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}12`, border: `1px solid ${color}35`,
      borderRadius: 8, padding: '4px 10px', fontSize: '0.78rem',
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color
    }}>
      {type === 'support' ? '▼' : '▲'} ₹{price?.toFixed(2)}
    </span>
  );
}

/* ─── Section Card ───────────────────────────────────────────────────────── */
function Card({ title, icon: Icon, color = '#6366F1', children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(12,16,34,0.95)', border: '1px solid rgba(99,102,241,0.15)',
      borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden',
      ...style
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {Icon && <Icon size={15} color={color} />}
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280',
          textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function SentimentTAView({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
  const ticker = (propTicker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [period, setPeriod]   = useState('3M');

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.get(`/api/stock/${ticker}/sentiment-ta`, { params: { period } })
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load sentiment & TA data.'))
      .finally(() => setLoading(false));
  }, [ticker, period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <RefreshCw size={36} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#6366F1', fontWeight: 600 }}>Analysing Sentiment + Technical Indicators…</div>
      <div style={{ color: '#374151', fontSize: '0.8rem' }}>FinBERT scanning headlines · RSI · MACD · Bollinger Bands</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#F43F5E', marginBottom: 12 }}>{error}</div>
      <button onClick={load} style={{ background: '#6366F1', color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
    </div>
  );

  const d = data || {};
  const isDark = true;

  // RSI color
  const rsiColor = d.rsi < 30 ? '#10B981' : d.rsi > 70 ? '#F43F5E' : '#F59E0B';
  const macdColor = d.macd_hist > 0 ? '#10B981' : '#F43F5E';
  const adxColor  = d.adx > 25 ? '#06B6D4' : '#9CA3AF';

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#F0F0FF',
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={20} color="#6366F1" />
            Sentiment + TA — {d.company_name || ticker}
          </h1>
          <p style={{ margin: '3px 0 0', color: '#94A3B8', fontSize: '0.8rem' }}>
            FinBERT News · RSI · MACD · Bollinger Bands · Options PCR · AI Verdict
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {['1M','3M','6M','1Y'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              background: period === p ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(99,102,241,0.08)',
              border: period === p ? 'none' : '1px solid rgba(99,102,241,0.2)',
              color: period === p ? '#fff' : '#9CA3AF', transition: 'all 0.2s'
            }}>{p}</button>
          ))}
          <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem',
            fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.25)', color: '#818CF8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      {/* ── Combined Verdict (Hero) ── */}
      <Card title="AI Combined Verdict" icon={Zap} color="#6366F1">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <VerdictBadge verdict={d.verdict} color={d.verdict_color} icon={d.verdict_icon} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <span style={{ color: '#9CA3AF' }}>Price: <strong style={{ color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>₹{d.close?.toFixed(2)}</strong></span>
              <span style={{ color: '#9CA3AF' }}>Period Return: <strong style={{
                color: d.period_return_pct >= 0 ? '#10B981' : '#F43F5E' }}>{d.period_return_pct >= 0 ? '+' : ''}{d.period_return_pct}%</strong></span>
              {d.week52_high > 0 && <span style={{ color: '#9CA3AF' }}>52W High: <strong style={{ color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>₹{d.week52_high?.toFixed(2)}</strong>
                {d.pct_from_52w_high !== null && <span style={{ color: '#F43F5E', marginLeft: 4, fontSize: '0.75rem' }}>({d.pct_from_52w_high}%)</span>}</span>}
              {d.week52_low > 0 && <span style={{ color: '#9CA3AF' }}>52W Low: <strong style={{ color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>₹{d.week52_low?.toFixed(2)}</strong>
                {d.pct_from_52w_low !== null && <span style={{ color: '#10B981', marginLeft: 4, fontSize: '0.75rem' }}>(+{d.pct_from_52w_low}%)</span>}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                background: `${d.ta_color}18`, border: `1px solid ${d.ta_color}40`, color: d.ta_color }}>
                📊 TA: {d.ta_rating}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                background: `${d.sentiment_color}18`, border: `1px solid ${d.sentiment_color}40`, color: d.sentiment_color }}>
                {d.sentiment_icon} News: {d.sentiment_label}
              </span>
              {d.pcr && <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#06B6D4' }}>
                ⚙️ PCR: {d.pcr} ({d.pcr_sentiment})
              </span>}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Row: Sentiment + TA Score ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>

        {/* Sentiment Gauge */}
        <Card title="News Sentiment (FinBERT)" icon={Newspaper} color={d.sentiment_color}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <SemiGauge
              value={Math.round(Math.abs(d.sentiment_score || 0) * 100)}
              color={d.sentiment_color || '#F59E0B'}
              label={d.sentiment_label || 'Neutral'}
              sub="Based on latest Google News RSS headlines"
            />
            <div style={{ width: '100%' }}>
              <SentBar score={d.sentiment_score || 0} color={d.sentiment_color || '#F59E0B'} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: '#374151' }}>
                <span>← Bearish</span><span>Bullish →</span>
              </div>
            </div>
          </div>
        </Card>

        {/* TA Score Gauge */}
        <Card title="Technical Analysis Score" icon={TrendingUp} color={d.ta_color}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <SemiGauge
              value={Math.round((d.ta_score / 6) * 100)}
              color={d.ta_color || '#F59E0B'}
              label={d.ta_rating || 'Neutral'}
              sub={`Score ${d.ta_score}/6 — RSI · MACD · Bollinger`}
            />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>RSI</span>
                <span style={{ color: rsiColor, fontWeight: 700 }}>{d.rsi_signal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>MACD</span>
                <span style={{ color: macdColor, fontWeight: 700 }}>{d.macd_signal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Bollinger</span>
                <span style={{ color: '#818CF8', fontWeight: 700, fontSize: '0.72rem' }}>{d.bb_signal}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* PCR Card */}
        <Card title="Options PCR Sentiment" icon={Activity} color="#06B6D4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#06B6D4',
                fontFamily: "'Space Grotesk', sans-serif",
                textShadow: '0 0 24px rgba(6,182,212,0.5)' }}>
                {d.pcr ?? '—'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Put / Call Ratio</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10,
              background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
              fontSize: '0.82rem', color: '#06B6D4', fontWeight: 700, textAlign: 'center' }}>
              {d.pcr_sentiment}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#374151', lineHeight: 1.6 }}>
              PCR &lt;0.7 = Bullish (calls dominate)<br />
              PCR 0.7–1.0 = Neutral<br />
              PCR &gt;1.0 = Bearish (puts dominate)
            </div>
          </div>
        </Card>
      </div>

      {/* ── Technical Indicators Grid ── */}
      <Card title="Technical Indicators" icon={TrendingUp} color="#818CF8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          <IndChip label="RSI (14)" value={d.rsi?.toFixed(1)} signal={d.rsi < 30 ? 'Oversold' : d.rsi > 70 ? 'Overbought' : 'Neutral'} color={rsiColor} />
          <IndChip label="MACD" value={d.macd?.toFixed(4)} signal={d.macd_hist > 0 ? '▲ Bull Cross' : '▼ Bear Cross'} color={macdColor} />
          <IndChip label="MACD Hist" value={d.macd_hist?.toFixed(4)} signal={d.macd_hist > 0 ? 'Momentum Up' : 'Momentum Down'} color={macdColor} />
          <IndChip label="BB %B" value={d.bb_pct_b?.toFixed(3)} signal={d.bb_pct_b < 0.1 ? 'Near Lower' : d.bb_pct_b > 0.9 ? 'Near Upper' : 'Mid Band'} color="#818CF8" />
          <IndChip label="BB Upper" value={`₹${d.bb_upper?.toFixed(2)}`} color="#F43F5E" />
          <IndChip label="BB Lower" value={`₹${d.bb_lower?.toFixed(2)}`} color="#10B981" />
          <IndChip label="SMA 20" value={`₹${d.sma20?.toFixed(2)}`} signal={d.close > d.sma20 ? '▲ Above' : '▼ Below'} color={d.close > d.sma20 ? '#10B981' : '#F43F5E'} />
          <IndChip label="SMA 50" value={`₹${d.sma50?.toFixed(2)}`} signal={d.close > d.sma50 ? '▲ Above' : '▼ Below'} color={d.close > d.sma50 ? '#10B981' : '#F43F5E'} />
          <IndChip label="EMA 12" value={`₹${d.ema12?.toFixed(2)}`} color="#06B6D4" />
          <IndChip label="ATR (14)" value={`₹${d.atr?.toFixed(2)}`} signal="Avg True Range" color="#F59E0B" />
          <IndChip label="ADX" value={d.adx?.toFixed(1)} signal={d.adx > 25 ? 'Strong Trend' : 'Weak Trend'} color={adxColor} />
          <IndChip label="Volume" value={d.volume > 1e6 ? `${(d.volume / 1e6).toFixed(1)}M` : d.volume?.toLocaleString()} color="#9CA3AF" />
        </div>
      </Card>

      {/* ── Support / Resistance + AI News ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>

        {/* Key Levels */}
        <Card title="Key Price Levels" icon={Target} color="#F59E0B">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {d.resistance_levels?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#F43F5E', fontWeight: 700, marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>⬆️ Resistance</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.resistance_levels.map((p, i) => <LevelPill key={i} price={p} type="resistance" />)}
                </div>
              </div>
            )}
            {d.pivot_points?.pivot && (
              <div style={{ padding: '8px 12px', borderRadius: 8,
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                fontSize: '0.8rem', color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                Pivot ₹{d.pivot_points.pivot?.toFixed(2)} &nbsp;|&nbsp;
                R1 ₹{d.pivot_points.R1?.toFixed(2)} &nbsp;|&nbsp;
                S1 ₹{d.pivot_points.S1?.toFixed(2)}
              </div>
            )}
            {d.support_levels?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700, marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>⬇️ Support</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.support_levels.map((p, i) => <LevelPill key={i} price={p} type="support" />)}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* AI News Summary */}
        <Card title="AI News Summary (Gemini)" icon={Newspaper} color="#8B5CF6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {d.ai_news_summary && (
              <div style={{ padding: '12px 14px', borderRadius: 10,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                fontSize: '0.83rem', color: '#C4B5FD', lineHeight: 1.7 }}>
                {d.ai_news_summary}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(d.headlines || []).slice(0, 5).map((h, i) => (
                <div key={i} style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.5
                }}>
                  <span style={{ color: '#6366F1', marginRight: 6 }}>•</span>{h}
                </div>
              ))}
              {(!d.headlines || d.headlines.length === 0) && (
                <div style={{ color: '#374151', fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>
                  No recent headlines found
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: '0.7rem', color: '#1F2937', textAlign: 'center', paddingTop: 8 }}>
        ⚠️ Sentiment analysis is based on public news headlines only. TA signals are for informational use. Not financial advice.
      </div>
    </div>
  );
}
