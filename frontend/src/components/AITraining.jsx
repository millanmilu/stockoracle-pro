import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

export default function AITraining() {
  const [ticker, setTicker]   = useState('')
  const [status, setStatus]   = useState(null)
  const [starting, setStarting] = useState(false)
  const pollRef = useRef(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const handleTrain = async () => {
    if (!ticker.trim()) return
    setStarting(true)
    stopPolling()

    try {
      await axios.post(`${API}/api/train/${ticker.toUpperCase()}`)
      setStatus({ status: 'training', epoch: 0, total_epochs: 60, loss: 0, val_loss: 0 })

      pollRef.current = setInterval(async () => {
        try {
          const { data } = await axios.get(`${API}/api/train/${ticker.toUpperCase()}/status`)
          setStatus(data)
          if (data.status === 'completed' || data.status === 'failed') stopPolling()
        } catch (_) {}
      }, 2000)
    } catch (e) {
      setStatus({
        status: 'failed',
        error: e.response?.data?.detail || 'Failed to start training. Check that the API is reachable.'
      })
    } finally {
      setStarting(false)
    }
  }

  const progress = status?.total_epochs
    ? Math.round((status.epoch / status.total_epochs) * 100)
    : 0

  const metrics = status?.metrics

  return (
    <div className="ailab-panel">
      <div className="card-title">🧠 AI Lab — Train LSTM Model</div>
      <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.7 }}>
        Train a custom <strong style={{ color: '#F0F0FF' }}>BiLSTM + Multi-Head Attention</strong> model on real 1-year historical data from Angel One.
        Once trained, the model is saved to disk and used for all future predictions on this ticker.
      </p>

      <div className="ailab-config">
        <div className="ailab-field">
          <label>Ticker Symbol</label>
          <input
            className="ticker-input"
            style={{ background: '#080B18', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '9px 12px', color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace', width: '100%', fontSize: '0.9rem', outline: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            placeholder="e.g. RELIANCE"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <div className="ailab-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleTrain}
            disabled={starting || !ticker.trim() || status?.status === 'training'}
          >
            {starting ? 'Starting...' : status?.status === 'training' ? '⚡ Training...' : '🚀 Train LSTM Model'}
          </button>
        </div>
      </div>

      {/* Progress Card */}
      {status && (status.status === 'training' || status.status === 'completed') && (
        <div className="training-progress-card">
          <div className="training-title">
            {status.status === 'completed' ? '✅ Training Complete' : `⚡ Training: ${ticker}`}
          </div>
          <div className="training-subtitle">
            {status.status === 'completed'
              ? 'Model saved and ready for predictions'
              : `Epoch ${status.epoch} / ${status.total_epochs}`}
          </div>
          <div className="train-bar-track">
            <div className="train-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          {status.status === 'training' && (
            <div className="train-metrics">
              <div className="train-metric">
                <div className="train-metric-val">{status.loss?.toFixed(6) ?? '—'}</div>
                <div className="train-metric-key">TRAIN LOSS</div>
              </div>
              <div className="train-metric">
                <div className="train-metric-val">{status.val_loss?.toFixed(6) ?? '—'}</div>
                <div className="train-metric-key">VAL LOSS</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Final Results */}
      {status?.status === 'completed' && metrics && (
        <div className="results-grid">
          <div className="result-card">
            <div className="result-card-title">Direction Accuracy</div>
            <div className="result-card-value" style={{ color: metrics.dir_accuracy > 0.55 ? '#10B981' : '#F59E0B' }}>
              {(metrics.dir_accuracy * 100).toFixed(1)}%
            </div>
            <div className="result-card-sub">Correct up/down predictions</div>
          </div>
          <div className="result-card">
            <div className="result-card-title">Final Train Loss</div>
            <div className="result-card-value" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1rem' }}>
              {metrics.train_loss?.toFixed(6)}
            </div>
            <div className="result-card-sub">MSE on training set</div>
          </div>
          <div className="result-card">
            <div className="result-card-title">Final Val Loss</div>
            <div className="result-card-value" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1rem' }}>
              {metrics.val_loss?.toFixed(6)}
            </div>
            <div className="result-card-sub">MSE on validation set</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {status?.status === 'failed' && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, color: '#F43F5E', fontSize: '0.85rem' }}>
          ❌ {status.error || 'Training failed. Please try again.'}
        </div>
      )}

      {/* Idle hint */}
      {!status && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, color: '#9CA3AF', fontSize: '0.82rem' }}>
          💡 Enter an Indian NSE stock ticker symbol (e.g. RELIANCE, TCS, INFY) and click Train. Training takes ~2 minutes on the EC2 server.
        </div>
      )}
    </div>
  )
}
