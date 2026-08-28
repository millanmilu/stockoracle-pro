import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, Wifi, WifiOff, CheckCircle, XCircle, Eye, EyeOff, 
  RefreshCw, Zap, Shield, AlertTriangle, Clock, Info, Check, 
  Server, Lock, Activity, ArrowRight, Radio
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Inject spin keyframe once ─────────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('broker-spin-style')) {
  const s = document.createElement('style');
  s.id = 'broker-spin-style';
  s.textContent = '@keyframes brokerSpin { to { transform: rotate(360deg); } } .broker-spin { animation: brokerSpin 0.8s linear infinite; } @keyframes pulseLive { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.92); } } .pulse-live { animation: pulseLive 2s ease-in-out infinite; }';
  document.head.appendChild(s);
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LS_KEY = 'stockoracle_broker_configs';

const BROKERS = [
  {
    id: 'angel_one',
    name: 'Angel One',
    subtitle: 'SmartAPI Connect',
    logo: '🪬',
    color: '#F97316',
    supported: true,
    fields: [
      { key: 'api_key',     label: 'API Key',      placeholder: 'e.g. UgegfQMq',          type: 'password', help: 'SmartAPI Key from Angel One developer portal' },
      { key: 'client_id',   label: 'Client ID',    placeholder: 'e.g. M62446252',        type: 'text',     help: 'Your Angel One login client code' },
      { key: 'password',    label: 'PIN / Password', placeholder: '4-digit MPIN or Login Password', type: 'password', help: 'Your Angel One login MPIN or trading password' },
      { key: 'totp_secret', label: 'TOTP Secret (Base32)', placeholder: 'e.g. RP2CFZHVER26CNJLUMTOFFBZZE', type: 'password', help: 'Base32 TOTP QR secret key from 2FA setup' },
    ],
  },
  {
    id: 'zerodha',
    name: 'Zerodha',
    subtitle: 'Kite Connect API',
    logo: '🪁',
    color: '#387ED1',
    supported: false,
    fields: [],
  },
  {
    id: 'upstox',
    name: 'Upstox',
    subtitle: 'Upstox Pro v2',
    logo: '⚡',
    color: '#7C3AED',
    supported: false,
    fields: [],
  },
  {
    id: 'fyers',
    name: 'Fyers',
    subtitle: 'Fyers API v3',
    logo: '🔥',
    color: '#EAB308',
    supported: false,
    fields: [],
  },
];

/* ─── Storage Helpers ────────────────────────────────────────────────────────── */

function loadConfigs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveConfigs(configs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(configs)); } catch {}
}

/* ─── Status Badge ───────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    connected:     { icon: <CheckCircle size={13} />, label: 'Session Active', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    failed:        { icon: <XCircle size={13} />,     label: 'Disconnected',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
    testing:       { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Testing…', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    applying:      { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Applying…',color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    untested:      { icon: <AlertTriangle size={13} />, label: 'Not Tested', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
    saved:         { icon: <Shield size={13} />,        label: 'Saved',      color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
    'coming-soon': { icon: <Clock size={13} />,         label: 'Upcoming',   color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  };
  const s = map[status] || map.untested;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

/* ─── Field Row Component ─────────────────────────────────────────────────────── */
function FieldRow({ field, value, onChange }) {
  const [show, setShow] = useState(false);
  const isPass = field.type === 'password';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#CBD5E1' }}>{field.label}</label>
        <div title={field.help} style={{ cursor: 'help', color: '#6366F1' }}>
          <Info size={11} />
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={isPass && !show ? 'password' : 'text'}
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          autoComplete="off"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 8, padding: '9px 36px 9px 12px',
            color: '#F1F5F9', fontSize: '0.82rem',
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
          onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.25)'}
        />
        {isPass && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 2,
            }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 3 }}>{field.help}</div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export default function BrokerSettingsView() {
  const [selectedBroker, setSelectedBroker] = useState('angel_one');
  const [configs, setConfigs] = useState(loadConfigs);
  const [statuses, setStatuses] = useState({});
  const [messages, setMessages] = useState({});
  const [liveStatus, setLiveStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [persistToDisk, setPersistToDisk] = useState(true);

  const broker = BROKERS.find(b => b.id === selectedBroker);
  const creds = configs[selectedBroker] || {};

  /* Function to fetch live status from backend */
  const fetchStatus = useCallback(async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/broker/status`);
      if (res.ok) {
        const data = await res.json();
        setLiveStatus(data);
        if (data.session_active) {
          setStatuses(s => ({ ...s, angel_one: 'connected' }));
        } else if (data.api_key_set) {
          setStatuses(s => ({ ...s, angel_one: 'failed' }));
        }
        if (showToast) toast.success('Broker status updated.');
      }
    } catch {
      if (showToast) toast.error('Could not reach backend API.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /* Auto-poll status on mount and every 10 seconds */
  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => {
      fetchStatus();
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const handleFieldChange = (key, val) => {
    setConfigs(prev => {
      const updated = { ...prev, [selectedBroker]: { ...(prev[selectedBroker] || {}), [key]: val } };
      return updated;
    });
    setStatuses(s => ({ ...s, [selectedBroker]: s[selectedBroker] === 'connected' ? 'connected' : 'untested' }));
  };

  const handleSave = () => {
    saveConfigs(configs);
    setStatuses(s => ({ ...s, [selectedBroker]: s[selectedBroker] || 'saved' }));
    toast.success('Credentials saved in browser localStorage!');
  };

  const handleTest = async () => {
    const c = configs[selectedBroker] || {};
    if (!c.api_key || !c.client_id || !c.password || !c.totp_secret) {
      toast.error('Please fill in all 4 Angel One fields first.');
      return;
    }
    setStatuses(s => ({ ...s, [selectedBroker]: 'testing' }));
    setMessages(m => ({ ...m, [selectedBroker]: '' }));
    try {
      const res = await fetch(`${API_BASE}/api/broker/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: selectedBroker, angel_one: c }),
      });
      const data = await res.json();
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message }));
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: 'Network error — could not contact backend server.' }));
      toast.error('Network error');
    }
  };

  const handleApply = async () => {
    const c = configs[selectedBroker] || {};
    if (!c.api_key || !c.client_id || !c.password || !c.totp_secret) {
      toast.error('Please fill all fields and Test first.');
      return;
    }
    setStatuses(s => ({ ...s, [selectedBroker]: 'applying' }));
    try {
      const res = await fetch(`${API_BASE}/api/broker/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: selectedBroker,
          angel_one: c,
          persist_to_disk: persistToDisk,
        }),
      });
      const data = await res.json();
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message }));
      if (data.success) {
        toast.success(data.message || 'Live feed active!');
        fetchStatus();
      } else {
        toast.error(data.message);
      }
    } catch {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: 'Network error while applying credentials.' }));
      toast.error('Network error');
    }
  };

  const handleClear = () => {
    if (!window.confirm('Are you sure you want to clear credentials for this broker?')) return;
    setConfigs(prev => {
      const updated = { ...prev };
      delete updated[selectedBroker];
      saveConfigs(updated);
      return updated;
    });
    setStatuses(s => ({ ...s, [selectedBroker]: 'untested' }));
    setMessages(m => ({ ...m, [selectedBroker]: '' }));
    toast('Cleared credentials.');
  };

  const currentStatus = statuses[selectedBroker] || (broker?.supported ? (liveStatus?.session_active ? 'connected' : 'untested') : 'coming-soon');
  const currentMsg = messages[selectedBroker] || '';

  // Format remaining time
  const formatRemaining = (mins) => {
    if (mins == null) return null;
    if (mins <= 0) return 'Expiring / Refreshing now';
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0) return `${hrs}h ${rem}m remaining`;
    return `${rem}m remaining`;
  };

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 28px)', maxWidth: 1150, margin: '0 auto', color: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Settings size={22} color="#6366F1" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F1F5F9' }}>Broker Settings & Live Feed Control</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
            Manage broker API credentials, proactive session keepalive, and live tick streaming connection.
          </p>
        </div>

        <button
          onClick={() => fetchStatus(true)}
          disabled={isRefreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 8, padding: '7px 14px', color: '#94A3B8', fontSize: '0.75rem',
            fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={13} className={isRefreshing ? 'broker-spin' : ''} />
          {isRefreshing ? 'Checking…' : 'Refresh Status'}
        </button>
      </div>

      {/* Live Server Session Card */}
      {liveStatus && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {/* Card 1: Session Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: liveStatus.session_active ? '#10B981' : '#EF4444',
              boxShadow: liveStatus.session_active ? '0 0 10px #10B981' : '0 0 8px #EF4444',
            }} className={liveStatus.session_active ? 'pulse-live' : ''} />
            <div>
              <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>SESSION STATUS</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: liveStatus.session_active ? '#10B981' : '#EF4444' }}>
                {liveStatus.session_active ? 'Active & Streaming' : 'Inactive / Reconnecting'}
              </div>
            </div>
          </div>

          {/* Card 2: Expiry & Keepalive */}
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>KEEPALIVE & EXPIRY</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#E2E8F0' }}>
              {liveStatus.remaining_minutes != null
                ? `⏳ ${formatRemaining(liveStatus.remaining_minutes)}`
                : (liveStatus.session_active ? '⚡ Auto-Renew Active' : '—')}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Auto-refreshes before expiry</div>
          </div>

          {/* Card 3: Active Client Code */}
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>ACTIVE CLIENT</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#93C5FD', fontFamily: 'JetBrains Mono, monospace' }}>
              {liveStatus.client_id_masked || 'None Configured'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
              {liveStatus.persisted_on_disk ? '💾 Saved in backend/.env' : 'In-Memory Only'}
            </div>
          </div>

          {/* Card 4: Last Checked Timestamp */}
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>LAST CHECKED</div>
            <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace' }}>
              {liveStatus.checked_at_ist || '—'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#10B981' }}>● Real-time Polling (10s)</div>
          </div>
        </div>
      )}

      {/* Main Grid: Selector + Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Broker Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.08em', marginBottom: 2 }}>SELECT BROKER</div>
          {BROKERS.map(b => {
            const st = statuses[b.id] || (b.supported ? (liveStatus?.session_active ? 'connected' : 'untested') : 'coming-soon');
            const hasData = !!(configs[b.id]?.api_key);
            const isSelected = selectedBroker === b.id;

            return (
              <button
                key={b.id}
                onClick={() => b.supported && setSelectedBroker(b.id)}
                disabled={!b.supported}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: '12px 14px', borderRadius: 10, border: 'none', cursor: b.supported ? 'pointer' : 'not-allowed',
                  background: isSelected
                    ? `linear-gradient(135deg, ${b.color}20, ${b.color}08)`
                    : 'rgba(15,23,42,0.6)',
                  borderLeft: `3px solid ${isSelected ? b.color : 'transparent'}`,
                  outline: isSelected ? `1px solid ${b.color}50` : '1px solid rgba(99,102,241,0.12)',
                  textAlign: 'left', transition: 'all 0.15s', opacity: b.supported ? 1 : 0.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.25rem' }}>{b.logo}</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? b.color : '#CBD5E1' }}>{b.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748B' }}>{b.subtitle}</div>
                    </div>
                  </div>
                  {hasData && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1' }} title="Saved locally" />}
                </div>
                <StatusBadge status={st} />
              </button>
            );
          })}
        </div>

        {/* Right: Config Panel */}
        <div style={{
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(99,102,241,0.18)',
          borderRadius: 14, padding: '22px 24px', boxShadow: '0 4px 25px rgba(0,0,0,0.25)',
        }}>
          {!broker?.supported ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
              <Clock size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#CBD5E1' }}>Coming Soon</div>
              <div style={{ fontSize: '0.78rem', marginTop: 6 }}>This broker connector is in development and will be available in an upcoming update.</div>
            </div>
          ) : (
            <>
              {/* Broker Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '2rem' }}>{broker.logo}</span>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: broker.color }}>
                      {broker.name} <span style={{ color: '#64748B', fontWeight: 400, fontSize: '0.85rem' }}>({broker.subtitle})</span>
                    </div>
                    <div style={{ marginTop: 4 }}><StatusBadge status={currentStatus} /></div>
                  </div>
                </div>

                {liveStatus?.created_at_ist && (
                  <div style={{ fontSize: '0.7rem', color: '#64748B', textAlign: 'right' }}>
                    Authenticated: <span style={{ color: '#94A3B8' }}>{liveStatus.created_at_ist}</span>
                  </div>
                )}
              </div>

              {/* Status Message Banner */}
              {currentMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 18,
                  background: currentStatus === 'connected' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${currentStatus === 'connected' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  fontSize: '0.78rem', color: currentStatus === 'connected' ? '#10B981' : '#EF4444',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {currentStatus === 'connected' ? <Check size={15} /> : <AlertTriangle size={15} />}
                  <span>{currentMsg}</span>
                </div>
              )}

              {/* Last Auth Error if any */}
              {liveStatus?.last_auth_error && !currentMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 18,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  fontSize: '0.75rem', color: '#F87171', display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <b>Last Server Session Error:</b> {liveStatus.last_auth_error}
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 2 }}>
                      Ensure your TOTP Secret is the Base32 string from your 2FA authenticator setup QR.
                    </div>
                  </div>
                </div>
              )}

              {/* Fields */}
              {broker.fields.map(f => (
                <FieldRow key={f.key} field={f} value={creds[f.key] || ''} onChange={handleFieldChange} />
              ))}

              {/* Options: Persist to Server Checkbox */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                margin: '16px 0 18px 0', padding: '10px 12px',
                background: 'rgba(15,23,42,0.5)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.12)',
              }}>
                <input
                  type="checkbox"
                  id="persist-checkbox"
                  checked={persistToDisk}
                  onChange={e => setPersistToDisk(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#6366F1' }}
                />
                <label htmlFor="persist-checkbox" style={{ fontSize: '0.75rem', color: '#CBD5E1', cursor: 'pointer', userSelect: 'none' }}>
                  <b>Persist to Server (.env):</b> Keep active credentials saved on EC2 disk so server restarts don't lose session.
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={handleSave}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'rgba(99,102,241,0.15)', color: '#818CF8',
                    fontSize: '0.8rem', fontWeight: 600,
                    outline: '1px solid rgba(99,102,241,0.3)', transition: 'all 0.15s',
                  }}
                >
                  <Shield size={14} /> Save in Browser
                </button>

                <button
                  onClick={handleTest}
                  disabled={['testing','applying'].includes(currentStatus)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    cursor: ['testing','applying'].includes(currentStatus) ? 'not-allowed' : 'pointer',
                    background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
                    fontSize: '0.8rem', fontWeight: 600,
                    outline: '1px solid rgba(245,158,11,0.3)', transition: 'all 0.15s',
                  }}
                >
                  {currentStatus === 'testing'
                    ? <><RefreshCw size={14} className="broker-spin" /> Verifying…</>
                    : <><Wifi size={14} /> Test Connection</>
                  }
                </button>

                <button
                  onClick={handleApply}
                  disabled={['testing','applying'].includes(currentStatus)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 20px', borderRadius: 8, border: 'none',
                    cursor: ['testing','applying'].includes(currentStatus) ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                    color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                    boxShadow: '0 2px 10px rgba(99,102,241,0.35)', transition: 'all 0.15s',
                  }}
                >
                  {currentStatus === 'applying'
                    ? <><RefreshCw size={14} className="broker-spin" /> Applying Session…</>
                    : <><Zap size={14} /> Apply as Active</>
                  }
                </button>

                <button
                  onClick={handleClear}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                    fontSize: '0.8rem', fontWeight: 600,
                    outline: '1px solid rgba(239,68,68,0.2)', marginLeft: 'auto',
                  }}
                >
                  <WifiOff size={14} /> Clear Form
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 24 }}>
        {[
          { icon: '🔄', title: 'Session Keepalive', desc: 'Auto-refreshes tokens before the 8-hour expiry and at 8:45 AM pre-market' },
          { icon: '💾', title: 'Disk Persistence', desc: 'Saves safely to backend/.env so EC2 reboots keep the active session intact' },
          { icon: '📡', title: 'Real-Time Sync', desc: '10-second background polling updates connection badges dynamically' },
          { icon: '🛡️', title: 'Zero Candle Drop', desc: 'Protected WS pipeline guarantees candles stay synchronized and reliable' },
        ].map((card, i) => (
          <div key={i} style={{
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.12)',
            borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 2 }}>{card.title}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.4 }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
