import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { fmt } from '../utils/formatters';
import { Bell, BellOff, PlusCircle, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.hostname.includes('amplifyapp.com')) {
      return 'wss://stockoracle.duckdns.org/ws/prices';
    }
    return `${protocol}//${window.location.host}/ws/prices`;
  }
  return 'ws://localhost:8000/ws/prices';
};

export default function PriceAlerts() {
  const { priceAlerts, addAlert, removeAlert, livePrices, setLivePrice } = useStore();
  const [form, setForm] = useState({ ticker: '', condition: 'above', threshold: '' });
  const [formError, setFormError] = useState('');
  const [notifGranted, setNotifGranted] = useState(Notification.permission === 'granted');
  const firedRef = useRef(new Set());   // Prevent duplicate fires per session

  // Request browser notification permission
  const requestPermission = async () => {
    const perm = await Notification.requestPermission();
    setNotifGranted(perm === 'granted');
    if (perm !== 'granted') {
      toast.error('Notification permission denied. Alerts will show as toasts only.');
    }
  };

  // WebSocket live prices for all unique tickers with alerts
  useEffect(() => {
    if (priceAlerts.length === 0) return;
    const tickers = [...new Set(priceAlerts.map((a) => a.ticker))];
    let ws;
    try {
      ws = new WebSocket(getWsUrl());
      ws.onopen = () => {
        ws.send(JSON.stringify({ subscribe: tickers }));
      };
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.ticker && payload.price) {
            setLivePrice(payload.ticker, { price: payload.price, change_pct: payload.change_pct });
          }
        } catch { /* ignore */ }
      };
    } catch { /* WS unavailable */ }
    return () => ws?.close();
  }, [priceAlerts.length]);

  // Check alerts against live prices
  useEffect(() => {
    priceAlerts.forEach((alert) => {
      const live = livePrices[alert.ticker];
      if (!live) return;
      const price = live.price;
      const triggered =
        (alert.condition === 'above' && price >= alert.threshold) ||
        (alert.condition === 'below' && price <= alert.threshold);

      if (triggered && !firedRef.current.has(alert.id)) {
        firedRef.current.add(alert.id);
        const msg = `${alert.ticker} is ${alert.condition} ₹${alert.threshold} — now at ${fmt.price(price)}`;
        toast.success(`🔔 Alert: ${msg}`, { duration: 8000 });
        if (notifGranted) {
          new Notification('StockOracle Price Alert', { body: msg, icon: '/favicon.ico' });
        }
      }
    });
  }, [livePrices, priceAlerts, notifGranted]);

  const handleAdd = (e) => {
    e.preventDefault();
    const threshold = parseFloat(form.threshold);
    const cleanTicker = form.ticker ? form.ticker.trim().toUpperCase() : '';
    if (!cleanTicker || isNaN(threshold) || threshold <= 0) {
      setFormError('Please enter a valid ticker and threshold price.');
      return;
    }
    addAlert({
      ticker: cleanTicker,
      condition: form.condition,
      threshold,
    });
    setForm({ ticker: '', condition: 'above', threshold: '' });
    setFormError('');
    toast.success(`Alert set for ${cleanTicker}`);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={24} style={{ color: '#F59E0B' }} /> Price Alerts
        </h1>
        {!notifGranted && (
          <button
            onClick={requestPermission}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            <Bell size={15} /> Enable Browser Notifications
          </button>
        )}
        {notifGranted && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: '0.85rem' }}>
            <CheckCircle size={15} /> Browser notifications active
          </span>
        )}
      </div>

      {/* Add alert form */}
      <div style={{ background: 'var(--card-bg, #1e1e1e)', border: '1px solid var(--border, #333)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text, #fff)', fontSize: '0.95rem' }}>New Alert</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
            <label style={{ fontSize: '0.78rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticker</label>
            <input
              type="text" placeholder="RELIANCE" value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--bg, #121212)', color: 'var(--text, #fff)', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.78rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</label>
            <select
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--bg, #121212)', color: 'var(--text, #fff)', fontSize: '0.9rem' }}
            >
              <option value="above">Price Goes Above</option>
              <option value="below">Price Goes Below</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
            <label style={{ fontSize: '0.78rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threshold (₹)</label>
            <input
              type="number" placeholder="1500.00" value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--bg, #121212)', color: 'var(--text, #fff)', fontSize: '0.9rem' }}
            />
          </div>
          <button type="submit" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
            borderRadius: 8, background: '#F59E0B', color: '#000', border: 'none',
            cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', alignSelf: 'flex-end',
          }}>
            <PlusCircle size={16} /> Set Alert
          </button>
        </form>
        {formError && <p style={{ color: 'var(--danger, #F43F5E)', fontSize: '0.82rem', marginTop: 8 }}>{formError}</p>}
      </div>

      {/* Active alerts list */}
      {priceAlerts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary, #555)', padding: 48, background: 'var(--card-bg, #1e1e1e)', borderRadius: 12, border: '1px solid var(--border, #333)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔕</div>
          <div>No active alerts. Add one above.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {priceAlerts.map((alert) => {
            const live = livePrices[alert.ticker];
            const currentPrice = live?.price;
            const fired = firedRef.current.has(alert.id);
            return (
              <div key={alert.id} style={{
                background: fired ? 'rgba(16,185,129,0.08)' : 'var(--card-bg, #1e1e1e)',
                border: `1px solid ${fired ? 'rgba(16,185,129,0.3)' : 'var(--border, #333)'}`,
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                <span style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem' }}>
                  {alert.ticker}
                </span>
                <span style={{ color: 'var(--text-secondary, #aaa)', fontSize: '0.9rem' }}>
                  {alert.condition === 'above' ? '▲ above' : '▼ below'}{' '}
                  <strong style={{ color: 'var(--text, #fff)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(alert.threshold)}</strong>
                </span>
                {currentPrice != null && (
                  <span style={{ color: '#666', fontSize: '0.82rem' }}>
                    Now: <span style={{ color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(currentPrice)}</span>
                  </span>
                )}
                {fired && (
                  <span style={{ color: '#10B981', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={14} /> Triggered
                  </span>
                )}
                <button onClick={() => removeAlert(alert.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#F43F5E', opacity: 0.7 }} title="Remove alert">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ color: '#555', fontSize: '0.78rem', textAlign: 'center' }}>
        Alerts are checked against live WebSocket prices. They fire as toasts{notifGranted ? ' and browser notifications' : ''} while this tab is open.
      </p>
    </div>
  );
}
