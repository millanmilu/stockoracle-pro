import { fmt, signalLabel, signalColor } from '../utils/formatters'

export default function PredictionPanel({ prediction }) {
  if (!prediction) return <div className="spinner" />

  const { current_price, predicted_price_7d, predicted_return_7d, ai_confidence_score, signal, model_trained } = prediction
  const retPct  = predicted_return_7d * 100
  const retUp   = retPct >= 0
  const score   = ai_confidence_score || 50

  const scoreColor = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F43F5E'

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
            {model_trained ? '⚡ LSTM Active' : '📐 Rule-Based'}
          </div>
        </div>
      </div>

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

      {/* Model status notice */}
      <div style={{
        marginTop: 12, padding: '10px 14px',
        background: model_trained ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${model_trained ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
        borderRadius: 10, fontSize: '0.78rem',
        color: model_trained ? '#10B981' : '#F59E0B'
      }}>
        {model_trained
          ? '✅ Predictions powered by trained PyTorch BiLSTM + Attention model'
          : '⚠️ Using rule-based fallback — go to AI Lab to train the LSTM model for this ticker'}
      </div>
    </div>
  )
}
