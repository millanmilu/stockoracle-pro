import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { fmt } from '../utils/formatters';
import api from '../utils/api';
import { 
  Bell, BellOff, PlusCircle, Trash2, CheckCircle, 
  Activity, TrendingUp, Sparkles, Volume2, ShieldAlert, RefreshCw, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

const ALERT_CATEGORIES = [
  { id: 'price_above',  label: 'Price Above (₹)',    icon: TrendingUp,  desc: 'Triggers when live LTP crosses above target' },
  { id: 'price_below',  label: 'Price Below (₹)',    icon: TrendingUp,  desc: 'Triggers when live LTP crosses below target' },
  { id: 'rsi_below',    label: 'RSI Oversold (<30)',  icon: Activity,    desc: 'Triggers when RSI 14 drops into oversold territory' },
  { id: 'rsi_above',    label: 'RSI Overbought (>70)',icon: Activity,    desc: 'Triggers when RSI 14 crosses into overbought zone' },
  { id: 'volume_spike', label: 'Volume Surge (>2x)', icon: Volume2,     desc: 'Triggers when trading volume surges above 20-day average' },
  { id: 'pattern',      label: 'Pattern Detection',  icon: Layers,      desc: 'Triggers when AI detects specific candlestick pattern' },
  { id: 'ai_signal',    label: 'AI Forecast Shift',  icon: Sparkles,    desc: 'Triggers when 7-day AI ensemble turns Bullish/Bearish' },
];

export default function PriceAlerts() {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [notifGranted, setNotifGranted] = useState(Notification.permission === 'granted');
  const [form, setForm] = useState({
    ticker: selectedSymbol || 'RELIANCE',
    alert_type: 'price_above',
    threshold: '',
    multiplier: '2.0',
    pattern: 'Double Bottom',
    signal: 'Buy',
  });
  const [formError, setFormError] = useState('');
  const firedRef = useRef(new Set());

  // Fetch alerts from backend
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/smart-alerts');
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  // Evaluate alerts against live backend data
  const evaluateAlerts = async () => {
    try {
      setEvaluating(true);
      const { data } = await api.get('/api/smart-alerts/evaluate');
      if (Array.isArray(data)) {
        setAlerts(data);
        // Check for new triggers
        data.forEach(a => {
          if (a.is_triggered && !firedRef.current.has(a.id)) {
            firedRef.current.add(a.id);
            const msg = `🔔 ${a.ticker}: ${a.reason || 'Alert condition met!'}`;
            toast.success(msg, { duration: 9000 });
            if (notifGranted) {
              new Notification('StockOracle Smart Alert', { body: msg, icon: '/favicon.ico' });
            }
          }
        });
      }
    } catch {}
    finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Poll evaluation every 45s
  useEffect(() => {
    if (alerts.length === 0) return;
    const interval = setInterval(() => {
      evaluateAlerts();
    }, 45000);
    return () => clearInterval(interval);
  }, [alerts.length]);

  const requestPermission = async () => {
    const perm = await Notification.requestPermission();
    setNotifGranted(perm === 'granted');
    if (perm !== 'granted') {
      toast.error('Notification permission denied. Alerts will show as toasts only.');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const cleanTicker = form.ticker ? form.ticker.trim().toUpperCase() : '';
    if (!cleanTicker) {
      setFormError('Please enter a valid stock ticker.');
      return;
    }

    let param_value = {};
    if (form.alert_type === 'price_above' || form.alert_type === 'price_below') {
      const val = parseFloat(form.threshold);
      if (isNaN(val) || val <= 0) {
        setFormError('Please enter a valid threshold price.');
        return;
      }
      param_value = { threshold: val };
    } else if (form.alert_type === 'rsi_below') {
      param_value = { threshold: 30 };
    } else if (form.alert_type === 'rsi_above') {
      param_value = { threshold: 70 };
    } else if (form.alert_type === 'volume_spike') {
      param_value = { multiplier: parseFloat(form.multiplier) || 2.0 };
    } else if (form.alert_type === 'pattern') {
      param_value = { pattern: form.pattern };
    } else if (form.alert_type === 'ai_signal') {
      param_value = { signal: form.signal };
    }

    try {
      await api.post('/api/smart-alerts', {
        ticker: cleanTicker,
        alert_type: form.alert_type,
        param_value,
      });
      toast.success(`Smart alert set for ${cleanTicker}`);
      setFormError('');
      fetchAlerts();
    } catch (err) {
      setFormError('Failed to create alert.');
    }
  };

  const handleDelete = async (alertId) => {
    try {
      await api.delete(`/api/smart-alerts/${alertId}`);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert removed');
    } catch {
      toast.error('Failed to remove alert');
    }
  };

  const getAlertTitle = (a) => {
    const type = a.alert_type;
    const param = a.param_value || {};
    if (type === 'price_above') return `Price >= ₹${param.threshold || 0}`;
    if (type === 'price_below') return `Price <= ₹${param.threshold || 0}`;
    if (type === 'rsi_below') return `RSI Oversold (<= 30)`;
    if (type === 'rsi_above') return `RSI Overbought (>= 70)`;
    if (type === 'volume_spike') return `Volume Spike (${param.multiplier || 2}x avg)`;
    if (type === 'pattern') return `Pattern: ${param.pattern || 'Any'}`;
    if (type === 'ai_signal') return `AI Signal: ${param.signal || 'Buy'}`;
    return type;
  };

  const cardStyle = {
    background: '#0C1022',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: 12,
    padding: 'clamp(14px, 2.5vw, 20px)',
  };

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={20} style={{ color: '#F59E0B' }} /> Smart Alerts Hub
          </h1>
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 3 }}>
            Real-time triggers for Price Targets, RSI Overbought/Oversold, Volume Surges & AI Forecasts
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={evaluateAlerts}
            disabled={evaluating}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: '#818CF8',
              border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', fontSize: '0.78rem',
            }}
          >
            <RefreshCw size={13} className={evaluating ? 'spinner' : ''} /> {evaluating ? 'Evaluating…' : 'Check Now'}
          </button>

          {!notifGranted ? (
            <button
              onClick={requestPermission}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', fontSize: '0.78rem',
              }}
            >
              <Bell size={13} /> Enable Notifications
            </button>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: '0.78rem' }}>
              <CheckCircle size={14} /> Notifications Active
            </span>
          )}
        </div>
      </div>

      {/* Add Alert Card */}
      <div style={cardStyle}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F0F0FF', marginBottom: 14 }}>
          Create New Smart Alert
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Ticker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120 }}>
            <label style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticker</label>
            <input
              type="text"
              placeholder="RELIANCE"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(255,255,255,0.04)', color: '#F0F0FF', fontSize: '0.85rem' }}
            />
          </div>

          {/* Alert Type Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
            <label style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trigger Condition</label>
            <select
              value={form.alert_type}
              onChange={(e) => setForm((f) => ({ ...f, alert_type: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: '#0F172A', color: '#F0F0FF', fontSize: '0.85rem' }}
            >
              {ALERT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Conditional Input based on Alert Type */}
          {(form.alert_type === 'price_above' || form.alert_type === 'price_below') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 }}>
              <label style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threshold (₹)</label>
              <input
                type="number"
                placeholder="2950.00"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(255,255,255,0.04)', color: '#F0F0FF', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {form.alert_type === 'volume_spike' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120 }}>
              <label style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Multiplier</label>
              <select
                value={form.multiplier}
                onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: '#0F172A', color: '#F0F0FF', fontSize: '0.85rem' }}
              >
                <option value="1.5">1.5x 20-day Avg</option>
                <option value="2.0">2.0x 20-day Avg</option>
                <option value="3.0">3.0x 20-day Avg</option>
              </select>
            </div>
          )}

          {form.alert_type === 'pattern' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 150 }}>
              <label style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chart Pattern</label>
              <select
                value={form.pattern}
                onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: '#0F172A', color: '#F0F0FF', fontSize: '0.85rem' }}
              >
                <option value="Double Bottom">Double Bottom</option>
                <option value="Hammer">Hammer</option>
                <option value="Bullish Engulfing">Bullish Engulfing</option>
                <option value="Head and Shoulders">Head and Shoulders</option>
              </select>
            </div>
          )}

          {form.alert_type === 'ai_signal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120 }}>
              <label style={{ fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecast Signal</label>
              <select
                value={form.signal}
                onChange={(e) => setForm((f) => ({ ...f, signal: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)', background: '#0F172A', color: '#F0F0FF', fontSize: '0.85rem' }}
              >
                <option value="Buy">Strong Buy / Buy</option>
                <option value="Sell">Strong Sell / Sell</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', alignSelf: 'flex-end',
            }}
          >
            <PlusCircle size={15} /> Set Smart Alert
          </button>
        </form>

        {formError && <p style={{ color: '#EF5350', fontSize: '0.8rem', marginTop: 8 }}>{formError}</p>}
      </div>

      {/* Active Alerts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#6B7280', padding: 48 }}>
            <BellOff size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>No active alerts. Add one above.</div>
          </div>
        ) : (
          alerts.map((alert) => {
            const isTrig = alert.is_triggered || alert.triggered;
            return (
              <div
                key={alert.id}
                style={{
                  background: isTrig ? 'rgba(16,185,129,0.06)' : '#0C1022',
                  border: `1px solid ${isTrig ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.15)'}`,
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>
                    {alert.ticker}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#F0F0FF', fontWeight: 600 }}>
                    {getAlertTitle(alert)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {alert.current_value != null && (
                    <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                      Current: <strong style={{ color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>{typeof alert.current_value === 'number' ? `₹${alert.current_value.toFixed(2)}` : alert.current_value}</strong>
                    </span>
                  )}

                  {isTrig ? (
                    <span style={{ color: '#10B981', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.12)', padding: '3px 8px', borderRadius: 6 }}>
                      <CheckCircle size={13} /> Triggered: {alert.reason || 'Active'}
                    </span>
                  ) : (
                    <span style={{ color: '#F59E0B', fontSize: '0.72rem', background: 'rgba(245,158,11,0.1)', padding: '2px 7px', borderRadius: 6 }}>
                      Monitoring
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(alert.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF5350', opacity: 0.7, padding: 4 }}
                    title="Remove alert"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ color: '#6B7280', fontSize: '0.75rem', textAlign: 'center' }}>
        Smart Alerts evaluate indicators, volume surges, chart patterns, and ML signals continuously.
      </p>
    </div>
  );
}


