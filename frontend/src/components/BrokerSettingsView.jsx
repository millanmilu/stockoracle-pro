import { useState, useEffect } from 'react';
import { Settings, Wifi, WifiOff, CheckCircle, XCircle, Eye, EyeOff, RefreshCw, Zap, Shield, AlertTriangle, Clock, Info } from 'lucide-react';
import toast from 'react-hot-toast';

/* â”€â”€â”€ Inject spin keyframe once â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
if (typeof document !== 'undefined' && !document.getElementById('broker-spin-style')) {
  const s = document.createElement('style');
  s.id = 'broker-spin-style';
  s.textContent = '.broker-spin{animation:brokerSpin 0.8s linear infinite}@keyframes brokerSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}

/* â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LS_KEY = 'stockoracle_broker_configs';

const BROKERS = [
  {
    id: 'angel_one',
    name: 'Angel One',
    subtitle: 'SmartAPI',
    logo: 'ðŸª¬',
    color: '#F97316',
    supported: true,
    fields: [
      { key: 'api_key',     label: 'API Key',      placeholder: 'e.g. AbcdEFgh',        type: 'password', help: 'From My Profile â†’ API Key in Angel One app' },
      { key: 'client_id',   label: 'Client ID',    placeholder: 'e.g. M123456',          type: 'text',     help: 'Your Angel One login ID (starts with letter)' },
      { key: 'password',    label: 'Password',     placeholder: 'Angel One login password', type: 'password', help: 'Same password you use to login' },
      { key: 'totp_secret', label: 'TOTP Secret',  placeholder: 'e.g. RP2CFZHVER26CNJLâ€¦',  type: 'password', help: 'Base32 secret from the TOTP setup QR code' },
    ],
  },
  {
    id: 'zerodha',
    name: 'Zerodha',
    subtitle: 'Kite Connect',
    logo: 'ðŸ”µ',
    color: '#387ED1',
    supported: false,
    fields: [],
  },
  {
    id: 'upstox',
    name: 'Upstox',
    subtitle: 'API v2',
    logo: 'ðŸŸ£',
    color: '#7C3AED',
    supported: false,
    fields: [],
  },
  {
    id: 'fyers',
    name: 'Fyers',
    subtitle: 'API v3',
    logo: 'ðŸŸ¡',
    color: '#EAB308',
    supported: false,
    fields: [],
  },
];

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function loadConfigs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveConfigs(configs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(configs)); } catch {}
}

/* â”€â”€â”€ Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function StatusBadge({ status }) {
  const map = {
    connected:  { icon: <CheckCircle size={13} />, label: 'Connected',  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    failed:     { icon: <XCircle size={13} />,     label: 'Failed',     color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
    testing:    { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Testingâ€¦', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    applying:   { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Applyingâ€¦',color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    untested:   { icon: <AlertTriangle size={13} />, label: 'Untested', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
    saved:      { icon: <Shield size={13} />,        label: 'Saved',    color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
    'coming-soon': { icon: <Clock size={13} />,      label: 'Coming Soon', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
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

/* â”€â”€â”€ Field Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      <div style={{ fontSize: '0.65rem', color: '#4B5563', marginTop: 3 }}>{field.help}</div>
    </div>
  );
}

/* â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function BrokerSettingsView() {
  const [selectedBroker, setSelectedBroker] = useState('angel_one');
  const [configs, setConfigs] = useState(loadConfigs);
  const [statuses, setStatuses] = useState({});   // { angel_one: 'connected'|'failed'|'untested'... }
  const [messages, setMessages] = useState({});   // { angel_one: 'some message' }
  const [liveStatus, setLiveStatus] = useState(null);

  const broker = BROKERS.find(b => b.id === selectedBroker);
  const creds = configs[selectedBroker] || {};

  /* fetch backend live status on mount */
  useEffect(() => {
    fetch(`${API_BASE}/api/broker/status`)
      .then(r => r.json())
      .then(data => {
        setLiveStatus(data);
        if (data.session_active) {
          setStatuses(s => ({ ...s, angel_one: 'connected' }));
        }
      })
      .catch(() => {});
  }, []);

  const handleFieldChange = (key, val) => {
    setConfigs(prev => {
      const updated = { ...prev, [selectedBroker]: { ...(prev[selectedBroker] || {}), [key]: val } };
      return updated;
    });
    // Mark as unsaved
    setStatuses(s => ({ ...s, [selectedBroker]: s[selectedBroker] === 'connected' ? 'connected' : 'untested' }));
  };

  const handleSave = () => {
    saveConfigs(configs);
    setStatuses(s => ({ ...s, [selectedBroker]: s[selectedBroker] || 'saved' }));
    toast.success('Credentials saved locally!');
  };

  const handleTest = async () => {
    const c = configs[selectedBroker] || {};
    if (!c.api_key || !c.client_id || !c.password || !c.totp_secret) {
      toast.error('Pehle sab fields bharo!');
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
    } catch (e) {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: 'Network error â€” backend reachable hai?' }));
      toast.error('Network error');
    }
  };

  const handleApply = async () => {
    const c = configs[selectedBroker] || {};
    if (!c.api_key || !c.client_id || !c.password || !c.totp_secret) {
      toast.error('Pehle Test karke confirm karo!');
      return;
    }
    setStatuses(s => ({ ...s, [selectedBroker]: 'applying' }));
    try {
      const res = await fetch(`${API_BASE}/api/broker/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: selectedBroker, angel_one: c }),
      });
      const data = await res.json();
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message }));
      if (data.success) {
        toast.success('Live feed active! WS status bar mein "WS Live" dikhega.');
        // Refresh backend status
        fetch(`${API_BASE}/api/broker/status`).then(r => r.json()).then(setLiveStatus).catch(() => {});
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: 'Network error' }));
      toast.error('Network error');
    }
  };

  const handleClear = () => {
    if (!window.confirm('Is broker ki credentials clear karein?')) return;
    setConfigs(prev => {
      const updated = { ...prev };
      delete updated[selectedBroker];
      saveConfigs(updated);
      return updated;
    });
    setStatuses(s => ({ ...s, [selectedBroker]: 'untested' }));
    setMessages(m => ({ ...m, [selectedBroker]: '' }));
    toast('Cleared!');
  };

  const currentStatus = statuses[selectedBroker] || (broker?.supported ? 'untested' : 'coming-soon');
  const currentMsg = messages[selectedBroker] || '';

  return (
    <div style={{ padding: 'clamp(14px,2.5vw,28px)', maxWidth: 1100, margin: '0 auto', color: '#F1F5F9' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Settings size={22} color="#6366F1" />
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F1F5F9' }}>Broker Settings</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
          API credentials <b>sirf aapke browser</b> mein store hoti hain (localStorage). Backend sirf apply/test ke waqt use karta hai.
        </p>
      </div>

      {/* Backend Live Status Bar */}
      {liveStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 24,
        }}>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>BACKEND SESSION</span>
          <StatusBadge status={liveStatus.session_active ? 'connected' : 'failed'} />
          <span style={{ fontSize: '0.72rem', color: '#4B5563' }}>
            Active broker: <b style={{ color: '#CBD5E1' }}>{liveStatus.active_broker === 'angel_one' ? 'Angel One' : 'None'}</b>
          </span>
          {liveStatus.client_id_masked && (
            <span style={{ fontSize: '0.72rem', color: '#4B5563' }}>
              Client: <b style={{ color: '#CBD5E1', fontFamily: 'monospace' }}>{liveStatus.client_id_masked}</b>
            </span>
          )}
          <span style={{ fontSize: '0.72rem', color: '#374151', marginLeft: 'auto' }}>{liveStatus.checked_at_ist}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Broker Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>SELECT BROKER</div>
          {BROKERS.map(b => {
            const st = statuses[b.id] || (b.supported ? 'untested' : 'coming-soon');
            const hasData = !!(configs[b.id]?.api_key);
            return (
              <button
                key={b.id}
                onClick={() => b.supported && setSelectedBroker(b.id)}
                disabled={!b.supported}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  padding: '12px 14px', borderRadius: 10, border: 'none', cursor: b.supported ? 'pointer' : 'not-allowed',
                  background: selectedBroker === b.id
                    ? `linear-gradient(135deg, ${b.color}18, ${b.color}08)`
                    : 'rgba(15,23,42,0.5)',
                  borderLeft: `3px solid ${selectedBroker === b.id ? b.color : 'transparent'}`,
                  outline: selectedBroker === b.id ? `1px solid ${b.color}40` : '1px solid rgba(99,102,241,0.1)',
                  textAlign: 'left', transition: 'all 0.15s', opacity: b.supported ? 1 : 0.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>{b.logo}</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: selectedBroker === b.id ? b.color : '#CBD5E1' }}>{b.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#4B5563' }}>{b.subtitle}</div>
                    </div>
                  </div>
                  {hasData && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1' }} title="Saved" />}
                </div>
                <StatusBadge status={st} />
              </button>
            );
          })}
        </div>

        {/* Right: Config Panel */}
        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 14, padding: '22px 24px',
        }}>
          {!broker?.supported ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#4B5563' }}>
              <Clock size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Coming Soon</div>
              <div style={{ fontSize: '0.75rem', marginTop: 6 }}>Ye broker jald available hoga</div>
            </div>
          ) : (
            <>
              {/* Broker Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
                <span style={{ fontSize: '2rem' }}>{broker.logo}</span>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: broker.color }}>{broker.name} <span style={{ color: '#4B5563', fontWeight: 400 }}>({broker.subtitle})</span></div>
                  <div style={{ marginTop: 4 }}><StatusBadge status={currentStatus} /></div>
                </div>
              </div>

              {/* Status Message */}
              {currentMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 18,
                  background: currentStatus === 'connected' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${currentStatus === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  fontSize: '0.78rem', color: currentStatus === 'connected' ? '#10B981' : '#EF4444',
                }}>
                  {currentMsg}
                </div>
              )}

              {/* Fields */}
              {broker.fields.map(f => (
                <FieldRow key={f.key} field={f} value={creds[f.key] || ''} onChange={handleFieldChange} />
              ))}

              {/* Security Note */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(99,102,241,0.06)', borderRadius: 8, padding: '10px 12px', marginTop: 4, marginBottom: 20,
              }}>
                <Shield size={13} style={{ marginTop: 1, flexShrink: 0, color: '#6366F1' }} />
                <p style={{ margin: 0, fontSize: '0.68rem', color: '#475569', lineHeight: 1.5 }}>
                  Credentials <b style={{ color: '#6366F1' }}>sirf browser ke localStorage</b> mein save hoti hain â€” koi bhi external server pe nahi jaati jab tak tum "Apply" na karo.
                  Apply karne ke baad credentials sirf current server process mein in-memory rehti hain; .env file change nahi hoti.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleSave}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'rgba(99,102,241,0.15)', color: '#818CF8',
                    fontSize: '0.8rem', fontWeight: 600,
                    outline: '1px solid rgba(99,102,241,0.3)', transition: 'all 0.15s',
                  }}
                >
                  <Shield size={14} /> Save Locally
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
                    ? <><RefreshCw size={14} className="broker-spin" /> Testingâ€¦</>
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
                    boxShadow: '0 2px 8px rgba(99,102,241,0.3)', transition: 'all 0.15s',
                  }}
                >
                  {currentStatus === 'applying'
                    ? <><RefreshCw size={14} className="broker-spin" /> Applyingâ€¦</>
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
                  <WifiOff size={14} /> Clear
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 24 }}>
        {[
          { icon: 'ðŸ”’', title: 'Local Only', desc: 'Credentials sirf browser mein rahti hain' },
          { icon: 'âš¡', title: 'Hot Reload', desc: 'Apply karo â€” server restart ki zaroorat nahi' },
          { icon: 'ðŸ”„', title: 'Test First', desc: 'Pehle Test karo, phir Apply â€” safe workflow' },
          { icon: 'ðŸ“¡', title: 'Auto Live', desc: 'Apply ke baad WS feed automatically live ho jaata hai' },
        ].map((card, i) => (
          <div key={i} style={{
            background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.1)',
            borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 2 }}>{card.title}</div>
              <div style={{ fontSize: '0.7rem', color: '#4B5563' }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

