import { fmt, signalLabel, signalColor } from '../utils/formatters'

export default function PredictionPanel({ prediction }) {
  if (!prediction) return <div className="spinner" />

  const {
    current_price, predicted_price_7d,
    predicted_upper_price_7d, predicted_lower_price_7d,
    predicted_return_7d, ai_confidence_score,
    signal, model_trained, model_weights, confidence_std
  } = prediction

  const retPct  = predicted_return_7d * 100
  const retUp   = retPct >= 0
  const score   = ai_confidence_score || 50
  const scoreColor = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F43F5E'

  const weights = model_weights || {}
  const hasWeights = Object.keys(weights).length > 0

  return (
    <div>
      {/* Prediction Cards */}
      <div className="pred-grid">
        <div className="pred-card">
          <div className="pred-label">Current Price</div>
          <div className="pred-price">{fmt.price(current_price)}</div>
          <div className="pred-return" style={{ color: '#9CA3AF' }}>Live</div>
        </div>

        <div className="pred-card" style={{ borderColor: retUp ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)' }}>
          <div className="pred-label">7-Day Target</div>
          <div className="pred-price" style={{ color: retUp ? '#10B981' : '#F43F5E' }}>
            {fmt.price(predicted_price_7d)}
          </div>
          <div className="pred-return" style={{ color: retUp ? '#10B981' : '#F43F5E' }}>
            {fmt.pct(retPct)}
          </div>
        </div>

        <div className="pred-card">
          <div className="pred-label">AI Signal</div>
          <div style={{ marginTop: 8 }}>
            <span className={`signal-pill signal-${signal}`}>
              {signalLabel(signal)}
            </span>
          </div>
          <div className="pred-return" style={{ color: signalColor(signal), marginTop: 8 }}>
              {model_trained ? 'AI Ensemble Active' : 'Rule-Based'}
          </div>
        </div>
      </div>

      {/* Confidence Band */}
      {predicted_upper_price_7d != null && predicted_lower_price_7d != null && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 12, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: 2 }}>LOWER 95% RANGE</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#F43F5E', fontWeight: 700, fontSize: '0.92rem' }}>
              {fmt.price(predicted_lower_price_7d)}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#4B5563' }}>CONFIDENCE STD</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF', fontSize: '0.82rem' }}>
              ±{confidence_std != null ? (confidence_std * 100).toFixed(2) : '—'}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: 2 }}>UPPER 95% RANGE</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#10B981', fontWeight: 700, fontSize: '0.92rem' }}>
              {fmt.price(predicted_upper_price_7d)}
            </div>
          </div>
        </div>
      )}

      {/* AI Confidence Score Bar */}
      <div className="score-bar-wrap">
        <div className="score-bar-label">
          <span>AI Confidence Score</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: scoreColor }}>
            {score} / 100
          </span>
        </div>
        <div className="score-bar-track">
          <div className="score-bar-fill" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}aa)` }} />
        </div>
      </div>

      {/* Model weight breakdown */}
      {model_trained && hasWeights && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(weights).map(([name, w]) => (
            <div key={name} style={{
              flex: 1, minWidth: 80, padding: '8px 10px',
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)',
              borderRadius: 8, textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{name}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#A5B4FC', fontWeight: 700, fontSize: '0.88rem', marginTop: 2 }}>
                {(w * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model status notice */}
      <div style={{
        marginTop: 12, padding: '10px 14px',
        background: model_trained ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${model_trained ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
        borderRadius: 10, fontSize: '0.78rem',
        color: model_trained ? '#10B981' : '#F59E0B'
      }}>
        {model_trained
          ? 'Predictions use the trained BiLSTM, Transformer, and gradient-boosting ensemble.'
          : 'Using a rule-based fallback — train a model in AI Lab for this ticker.'}
      </div>
    </div>
  )
}
