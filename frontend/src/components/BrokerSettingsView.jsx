import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Settings, Wifi, WifiOff, CheckCircle, XCircle, Eye, EyeOff, 
  RefreshCw, Zap, Shield, AlertTriangle, Clock, Info, Check, 
  Brain, Cpu, Sparkles, Key, Download, Upload, Trash2, ArrowUpRight,
  ExternalLink, Layers, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

/* ─── Inject spin keyframe once ─────────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('broker-spin-style')) {
  const s = document.createElement('style');
  s.id = 'broker-spin-style';
  s.textContent = `
    @keyframes brokerSpin { to { transform: rotate(360deg); } }
    .broker-spin { animation: brokerSpin 0.8s linear infinite; }
    @keyframes pulseLive { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.92); } }
    .pulse-live { animation: pulseLive 2s ease-in-out infinite; }
    @media (max-width: 768px) {
      .broker-main-grid { grid-template-columns: 1fr !important; }
      .ai-provider-grid { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(s);
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    supported: true,
    fields: [
      { key: 'api_key',      label: 'API Key',       placeholder: 'e.g. abcd1234efgh5678', type: 'password', help: 'Kite Connect API Key from developer portal' },
      { key: 'api_secret',   label: 'API Secret',    placeholder: 'e.g. 32-character secret', type: 'password', help: 'Kite Connect API Secret' },
      { key: 'access_token', label: 'Access Token / Enctoken', placeholder: 'Daily Access Token or Enctoken', type: 'password', help: 'Session access token generated upon daily login' },
    ],
  },
  {
    id: 'upstox',
    name: 'Upstox',
    subtitle: 'Upstox Pro v2',
    logo: '⚡',
    color: '#7C3AED',
    supported: true,
    fields: [
      { key: 'api_key',      label: 'API Key (Client ID)', placeholder: 'Upstox App Client ID', type: 'password', help: 'Client ID from Upstox Developer Portal' },
      { key: 'api_secret',   label: 'API Secret',    placeholder: 'Upstox App Secret Key', type: 'password', help: 'Secret Key from Upstox Developer Portal' },
      { key: 'redirect_uri', label: 'Redirect URI',  placeholder: 'https://127.0.0.1:8000/api/broker/callback', type: 'text', help: 'OAuth Redirect URI' },
      { key: 'access_token', label: 'Access Token',  placeholder: 'Daily OAuth Access Token', type: 'password', help: 'OAuth2 access token for data and orders' },
    ],
  },
  {
    id: 'fyers',
    name: 'Fyers',
    subtitle: 'Fyers API v3',
    logo: '🔥',
    color: '#EAB308',
    supported: true,
    fields: [
      { key: 'app_id',       label: 'App ID',        placeholder: 'e.g. XXXXXX-100', type: 'text', help: 'Fyers App ID from API Dashboard' },
      { key: 'secret_key',   label: 'Secret Key',    placeholder: 'Fyers App Secret Key', type: 'password', help: 'Secret Key from Fyers API dashboard' },
      { key: 'access_token', label: 'Access Token',  placeholder: 'Daily 2FA Auth Token', type: 'password', help: 'Access token generated after daily login' },
    ],
  },
];

const AI_PROVIDERS_META = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: '✨',
    color: '#818CF8',
    regex: /^AIza[A-Za-z0-9_-]{35}$/,
    defaultModel: 'gemini-3.6-flash',
    speed: '85ms (Ultra Fast)',
    quality: 'State-of-the-Art',
    cost: 'Free Tier Available',
    freeLimit: '15 RPM / 1M TPM Free',
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', recommended: true, free: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', recommended: false, free: true },
      { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   recommended: false, free: false },
      { id: 'gemini-pro',       name: 'Gemini 1.0 Pro',   recommended: false, free: true },
    ],
    signupUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '🧠',
    color: '#10B981',
    regex: /^sk-[A-Za-z0-9_-]{20,}$/,
    defaultModel: 'gpt-4o-mini',
    speed: '160ms (Fast)',
    quality: 'Exceptional',
    cost: '$0.15 / 1M Tokens',
    freeLimit: 'Pay-as-you-go',
    models: [
      { id: 'gpt-4o-mini',   name: 'GPT-4o Mini',   recommended: true, free: false },
      { id: 'gpt-4o',        name: 'GPT-4o Flagship', recommended: false, free: false },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', recommended: false, free: false },
    ],
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    logo: '🪐',
    color: '#F97316',
    regex: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    defaultModel: 'claude-3-5-sonnet-20241022',
    speed: '240ms (Medium)',
    quality: 'State-of-the-Art',
    cost: '$3.00 / 1M Tokens',
    freeLimit: 'Pay-as-you-go',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', recommended: true, free: false },
      { id: 'claude-3-haiku-20240307',    name: 'Claude 3 Haiku',    recommended: false, free: false },
      { id: 'claude-3-opus-20240229',     name: 'Claude 3 Opus',     recommended: false, free: false },
    ],
    signupUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    logo: '🌪️',
    color: '#F59E0B',
    regex: /^mist-[A-Za-z0-9_-]{20,}$/,
    defaultModel: 'mistral-small-latest',
    speed: '140ms (Fast)',
    quality: 'Very High',
    cost: 'Free Tier Available',
    freeLimit: '1 RPS Free Tier',
    models: [
      { id: 'mistral-small-latest',  name: 'Mistral Small',  recommended: true, free: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', recommended: false, free: false },
      { id: 'mistral-large-latest',  name: 'Mistral Large',  recommended: false, free: false },
      { id: 'open-mistral-7b',       name: 'Mistral 7B',     recommended: false, free: true },
    ],
    signupUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    logo: '🌊',
    color: '#06B6D4',
    regex: /^CO[A-Za-z0-9_-]{24,}$/,
    defaultModel: 'command-r-plus',
    speed: '190ms (Fast)',
    quality: 'High (RAG-Tuned)',
    cost: 'Trial Keys Free',
    freeLimit: '1,000 requests/mo',
    models: [
      { id: 'command-r-plus', name: 'Command R+',  recommended: true, free: true },
      { id: 'command-r',      name: 'Command R',   recommended: false, free: true },
      { id: 'command-light',  name: 'Command Light', recommended: false, free: true },
    ],
    signupUrl: 'https://dashboard.cohere.com/api-keys',
  },
  {
    id: 'groq',
    name: 'Groq LPU',
    logo: '⚡',
    color: '#EC4899',
    regex: /^gsk_[A-Za-z0-9_-]{30,}$/,
    defaultModel: 'llama-3.3-70b-versatile',
    speed: '25ms (Lightning Fast)',
    quality: 'Very High',
    cost: 'Free Beta Tier',
    freeLimit: '30 RPM Free',
    models: [
      { id: 'llama-3.3-70b-versatile',       name: 'Llama 3.3 70B Versatile',     recommended: true, free: true },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B',     recommended: false, free: true },
      { id: 'llama-3.1-8b-instant',          name: 'Llama 3.1 8B Instant',        recommended: false, free: true },
      { id: 'llama-3.1-70b-versatile',       name: 'Llama 3.1 70B Versatile',     recommended: false, free: true },
      { id: 'mixtral-8x7b-32768',            name: 'Mixtral 8x7B (32k Context)',  recommended: false, free: true },
      { id: 'gemma2-9b-it',                  name: 'Gemma 2 9B IT',               recommended: false, free: true },
      { id: 'llama3-70b-8192',               name: 'Llama 3 70B (Legacy 8k)',     recommended: false, free: true },
      { id: 'llama3-8b-8192',                name: 'Llama 3 8B (Legacy 8k)',      recommended: false, free: true },
    ],
    signupUrl: 'https://console.groq.com/keys',
  },
];

/* ─── Status Badge ───────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    connected:     { icon: <CheckCircle size={13} />, label: 'Session Active', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    failed:        { icon: <XCircle size={13} />,     label: 'Disconnected',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
    testing:       { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Testing…', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    applying:      { icon: <RefreshCw size={13} className="broker-spin" />, label: 'Applying…',color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    untested:      { icon: <AlertTriangle size={13} />, label: 'Not Tested', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
    saved:         { icon: <Shield size={13} />,        label: 'Saved in DB', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
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
export default function BrokerSettingsView({ initialTab = 'broker' }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'ai' ? 'ai' : 'broker');
  
  // ── Broker State ──
  const [selectedBroker, setSelectedBroker] = useState('angel_one');
  const [configs, setConfigs] = useState({});
  const [dirtyFields, setDirtyFields] = useState({}); // Bug #2: tracks user-edited fields
  const [statuses, setStatuses] = useState({});
  const [messages, setMessages] = useState({});
  const [liveStatus, setLiveStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [persistToDisk, setPersistToDisk] = useState(true);
  const [brokerLatency, setBrokerLatency] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // ── Multi-AI Providers State ──
  const [selectedAiProvider, setSelectedAiProvider] = useState('gemini');
  const [aiData, setAiData] = useState({ active_provider: 'gemini', providers: [] });
  const [aiKeysInput, setAiKeysInput] = useState({});
  const [aiSelectedModels, setAiSelectedModels] = useState({});
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [aiSaving, setAiSaving] = useState(false);

  const timerRef = useRef(null);

  /* Function to fetch live status and saved accounts from backend DB */
  const fetchStatus = useCallback(async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const [resStatus, resAccounts, resLogs] = await Promise.all([
        fetch(`${API_BASE}/api/broker/status`),
        fetch(`${API_BASE}/api/broker/accounts`),
        fetch(`${API_BASE}/api/broker/audit-logs?limit=8`),
      ]);

      if (resStatus.ok) {
        const data = await resStatus.json();
        setLiveStatus(data);
        if (data.session_active && data.active_broker) {
          setStatuses(s => ({ ...s, [data.active_broker]: 'connected' }));
        }
      }

      if (resAccounts.ok) {
        const accData = await resAccounts.json();
        if (accData && accData.accounts) {
          setConfigs(prev => {
            const next = { ...prev };
            Object.entries(accData.accounts).forEach(([bId, bVal]) => {
              if (bVal.credentials && Object.keys(bVal.credentials).length > 0) {
                // Merge without overwriting user uncommitted dirty fields
                next[bId] = { ...(next[bId] || {}), ...bVal.credentials };
                if (bVal.is_active) {
                  setStatuses(s => ({ ...s, [bId]: 'connected' }));
                }
              }
            });
            return next;
          });
        }
      }

      if (resLogs.ok) {
        const logData = await resLogs.json();
        if (logData && logData.logs) {
          setAuditLogs(logData.logs);
        }
      }

      if (showToast) toast.success('Synced with backend database.');
    } catch {
      if (showToast) toast.error('Could not reach backend API.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /* Fetch AI Providers info */
  const fetchAiProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers`);
      if (res.ok) {
        const data = await res.json();
        setAiData(data);
        if (data.providers) {
          const modMap = {};
          data.providers.forEach(p => {
            modMap[p.id] = p.selected_model || p.default_model;
          });
          setAiSelectedModels(prev => ({ ...modMap, ...prev }));
        }
      }
    } catch (e) {
      console.warn('AI providers fetch error:', e);
    }
  }, []);

  /* BUG #3 (CRITICAL): Page Visibility API to pause polling when tab is hidden */
  useEffect(() => {
    fetchStatus();
    fetchAiProviders();

    const startPolling = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!document.hidden) {
          fetchStatus();
        }
      }, 10000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        fetchStatus();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchStatus, fetchAiProviders]);

  /* ── Broker Field Change (Tracks dirty fields to prevent Bug #2) ── */
  const handleFieldChange = (key, val) => {
    setConfigs(prev => ({
      ...prev,
      [selectedBroker]: { ...(prev[selectedBroker] || {}), [key]: val }
    }));
    setDirtyFields(prev => ({
      ...prev,
      [selectedBroker]: { ...(prev[selectedBroker] || {}), [key]: true }
    }));
    setStatuses(s => ({ ...s, [selectedBroker]: s[selectedBroker] === 'connected' ? 'connected' : 'untested' }));
  };

  /* Helper to sanitize payload and omit unedited masked values (Bug #2) */
  const buildCleanPayload = (brokerId) => {
    const raw = configs[brokerId] || {};
    const dirty = dirtyFields[brokerId] || {};
    const clean = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (v != null) {
        const strVal = String(v);
        // If it was edited OR is not a masked placeholder
        if (dirty[k] || (!strVal.startsWith('••') && !strVal.includes('••••'))) {
          clean[k] = strVal;
        }
      }
    });
    return clean;
  };

  /* BUG #6 (HIGH): Input validation for all brokers */
  const validateBrokerInputs = (bId, credsObj) => {
    if (bId === 'angel_one') {
      if (!credsObj.api_key || !credsObj.client_id || !credsObj.password || !credsObj.totp_secret) {
        toast.error('Please fill in all 4 Angel One fields.');
        return false;
      }
    } else if (bId === 'zerodha') {
      if (!credsObj.api_key || !credsObj.api_secret) {
        toast.error('Please fill in Zerodha API Key and Secret.');
        return false;
      }
    } else if (bId === 'upstox') {
      if (!credsObj.api_key || !credsObj.api_secret) {
        toast.error('Please fill in Upstox Client ID and API Secret.');
        return false;
      }
    } else if (bId === 'fyers') {
      if (!credsObj.app_id || !credsObj.secret_key) {
        toast.error('Please fill in Fyers App ID and Secret Key.');
        return false;
      }
    }
    return true;
  };

  /* BUG #5 (HIGH): "Save to Server" saves to SQLite backend DB */
  const handleSave = async () => {
    const clean = buildCleanPayload(selectedBroker);
    if (!validateBrokerInputs(selectedBroker, clean)) return;

    try {
      const res = await fetch(`${API_BASE}/api/broker/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: selectedBroker,
          [selectedBroker]: clean,
          persist_to_disk: persistToDisk,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatuses(s => ({ ...s, [selectedBroker]: 'saved' }));
        toast.success(`Saved ${selectedBroker} credentials securely to server DB!`);
        fetchStatus();
      } else {
        toast.error(data.message || 'Save failed.');
      }
    } catch {
      toast.error('Network error saving to server.');
    }
  };

  /* Test Connection (Bug #9: Real probe & Latency) */
  const handleTest = async () => {
    const clean = buildCleanPayload(selectedBroker);
    if (!validateBrokerInputs(selectedBroker, clean)) return;

    setStatuses(s => ({ ...s, [selectedBroker]: 'testing' }));
    setMessages(m => ({ ...m, [selectedBroker]: '' }));
    setBrokerLatency(null);

    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/api/broker/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: selectedBroker,
          [selectedBroker]: clean,
        }),
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - t0);
      setBrokerLatency(data.latency_ms || elapsed);
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message }));
      
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
      fetchStatus();
    } catch {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: 'Network error — could not contact backend.' }));
      toast.error('Network error');
    }
  };

  /* Apply and Activate Broker for Live Feed */
  const handleApply = async () => {
    const clean = buildCleanPayload(selectedBroker);
    if (!validateBrokerInputs(selectedBroker, clean)) return;

    setStatuses(s => ({ ...s, [selectedBroker]: 'applying' }));
    try {
      const res = await fetch(`${API_BASE}/api/broker/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: selectedBroker,
          [selectedBroker]: clean,
          persist_to_disk: persistToDisk,
        }),
      });
      const data = await res.json();
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message }));
      if (data.success) {
        toast.success(data.message || 'Broker activated! Live stream active.');
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

  /* BUG #7 (HIGH): Clear deletes from backend DB and memory */
  const handleClear = async () => {
    if (!window.confirm(`Clear credentials for ${selectedBroker.replace('_', ' ').toUpperCase()} from server database?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/broker/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: selectedBroker }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(prev => { const u = { ...prev }; delete u[selectedBroker]; return u; });
        setDirtyFields(prev => { const u = { ...prev }; delete u[selectedBroker]; return u; });
        setStatuses(s => ({ ...s, [selectedBroker]: 'untested' }));
        setMessages(m => ({ ...m, [selectedBroker]: '' }));
        toast.success(data.message);
        fetchStatus();
      }
    } catch {
      toast.error('Network error clearing credentials.');
    }
  };

  /* Export / Import Broker Configs (Backup) */
  const handleExportConfigs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `stockoracle_broker_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Broker configuration backup exported.');
  };

  /* ── AI Provider Actions ── */

  /* Auto-detect provider when user pastes an API key into AI tab */
  const handleAiKeyChange = (val) => {
    setAiKeysInput(prev => ({ ...prev, [selectedAiProvider]: val }));
    const trimmed = val.trim();
    for (const p of AI_PROVIDERS_META) {
      if (p.regex.test(trimmed)) {
        if (selectedAiProvider !== p.id) {
          setSelectedAiProvider(p.id);
          setAiSelectedModels(m => ({ ...m, [p.id]: p.defaultModel }));
          setAiKeysInput(prev => ({ ...prev, [p.id]: trimmed }));
          toast.success(`Auto-detected ${p.name} API Key!`, { icon: p.logo });
        }
        break;
      }
    }
  };

  const handleTestAi = async () => {
    const rawKey = (aiKeysInput[selectedAiProvider] || '').trim();
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAiProvider,
          api_key: rawKey,
          model: aiSelectedModels[selectedAiProvider],
        }),
      });
      const data = await res.json();
      setAiTestResult(data);
      if (data.success) {
        toast.success(data.message || 'Connected successfully!');
      } else {
        toast.error(data.message || 'Connection failed.');
      }
      fetchAiProviders();
    } catch {
      toast.error('Network error testing AI provider.');
    } finally {
      setAiTesting(false);
    }
  };

  const handleSaveAi = async (activateNow = false) => {
    const rawKey = (aiKeysInput[selectedAiProvider] || '').trim();
    setAiSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAiProvider,
          api_key: rawKey,
          model: aiSelectedModels[selectedAiProvider],
          is_active: activateNow,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setAiKeysInput(prev => ({ ...prev, [selectedAiProvider]: '' }));
        fetchAiProviders();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to save AI configuration.');
    } finally {
      setAiSaving(false);
    }
  };

  const handleActivateAi = async (pId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchAiProviders();
      }
    } catch {
      toast.error('Failed to activate AI provider.');
    }
  };

  const handleDeleteAi = async (pId) => {
    if (!window.confirm(`Delete encrypted credentials for ${pId.toUpperCase()}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setAiKeysInput(prev => ({ ...prev, [pId]: '' }));
        fetchAiProviders();
      }
    } catch {
      toast.error('Failed to delete credentials.');
    }
  };

  // BUG #4 (HIGH): Only show "connected" for the active broker
  const broker = BROKERS.find(b => b.id === selectedBroker);
  const creds = configs[selectedBroker] || {};
  const isActiveBroker = liveStatus?.active_broker === selectedBroker;
  const currentStatus = statuses[selectedBroker] || (isActiveBroker && liveStatus?.session_active ? 'connected' : (broker?.supported ? 'untested' : 'coming-soon'));
  const currentMsg = messages[selectedBroker] || '';

  // BUG #12 (LOW): Safe remaining minutes formatter
  const formatRemaining = (mins) => {
    if (mins == null) return null;
    if (mins <= 0) return 'Expiring / Refreshing now';
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0) return `${hrs}h ${rem}m remaining`;
    return `${rem}m remaining`;
  };

  const activeAiMeta = AI_PROVIDERS_META.find(p => p.id === selectedAiProvider) || AI_PROVIDERS_META[0];
  const activeAiBackend = (aiData.providers || []).find(p => p.id === selectedAiProvider);

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 28px)', maxWidth: 1200, margin: '0 auto', color: '#F1F5F9' }}>

      {/* Top Header & Navigation Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Settings size={22} color="#6366F1" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
              Settings & Credentials Control Hub
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94A3B8' }}>
            Manage Indian Broker API integrations, real-time tick keepalives, and multi-model AI LLM intelligence engines.
          </p>
        </div>

        {/* Tab Toggle Switcher */}
        <div style={{
          display: 'flex', background: 'rgba(15,23,42,0.85)',
          padding: 4, borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)',
          gap: 4
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('broker')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              background: activeTab === 'broker' ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'transparent',
              color: activeTab === 'broker' ? '#FFF' : '#94A3B8',
              transition: 'all 0.15s'
            }}
          >
            <Key size={14} /> Broker Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              background: activeTab === 'ai' ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'transparent',
              color: activeTab === 'ai' ? '#FFF' : '#94A3B8',
              transition: 'all 0.15s'
            }}
          >
            <Brain size={14} /> AI Providers <span style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>6 ENGINES</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 1: MULTI-AI PROVIDERS SETTINGS
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Banner / Status Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.08))',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', border: '1px solid rgba(139,92,246,0.4)'
              }}>
                🧠
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#F8FAFC' }}>
                    Active LLM Engine: <span style={{ color: '#C084FC' }}>{AI_PROVIDERS_META.find(p => p.id === aiData.active_provider)?.name || 'Google Gemini'}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} className="pulse-live" /> LIVE
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
                  All market analysis, trade explanations, news sentiment, and NLP screening queries route dynamically to this active provider.
                </div>
              </div>
            </div>

            <button
              onClick={fetchAiProviders}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 8, padding: '7px 12px', color: '#CBD5E1', fontSize: '0.74rem',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} /> Refresh Providers
            </button>
          </div>

          {/* 6 AI Provider Cards Grid */}
          <div className="ai-provider-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {AI_PROVIDERS_META.map(p => {
              const backendInfo = (aiData.providers || []).find(b => b.id === p.id);
              const isActive = aiData.active_provider === p.id;
              const isSelected = selectedAiProvider === p.id;
              const hasCreds = backendInfo?.has_credentials;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedAiProvider(p.id)}
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))'
                      : 'rgba(15,23,42,0.7)',
                    border: isSelected
                      ? `2px solid ${p.color}`
                      : isActive
                      ? '1px solid rgba(16,185,129,0.5)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isSelected ? `0 4px 16px ${p.color}25` : 'none',
                    position: 'relative'
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 8, height: 8, borderRadius: '50%', background: '#10B981',
                      boxShadow: '0 0 8px #10B981'
                    }} className="pulse-live" title="Active Platform Engine" />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.25rem' }}>{p.logo}</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? '#FFF' : '#E2E8F0' }}>{p.name}</div>
                      <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{p.speed}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: '0.66rem' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4,
                      background: hasCreds ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                      color: hasCreds ? '#10B981' : '#64748B', fontWeight: 700
                    }}>
                      {hasCreds ? '✓ Encrypted' : 'Unconfigured'}
                    </span>
                    <span style={{ color: '#94A3B8', fontWeight: 600 }}>{p.freeLimit.split(' ')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active AI Configurator Card */}
          <div style={{
            background: 'rgba(15,23,42,0.85)',
            border: `1px solid ${activeAiMeta.color}40`,
            borderRadius: 12, padding: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.6rem' }}>{activeAiMeta.logo}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC' }}>
                    {activeAiMeta.name} Integration
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    {activeAiMeta.cost} • {activeAiMeta.freeLimit}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={activeAiMeta.signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem',
                    color: activeAiMeta.color, textDecoration: 'none', background: `${activeAiMeta.color}15`,
                    padding: '5px 10px', borderRadius: 6, border: `1px solid ${activeAiMeta.color}30`, fontWeight: 600
                  }}
                >
                  Get API Key <ExternalLink size={12} />
                </a>
                {aiData.active_provider === selectedAiProvider ? (
                  <span style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.2)', color: '#10B981', fontWeight: 800, border: '1px solid rgba(16,185,129,0.3)' }}>
                    ● Currently Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleActivateAi(selectedAiProvider)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                      borderRadius: 6, border: '1px solid #10B981', background: 'rgba(16,185,129,0.15)',
                      color: '#10B981', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <Zap size={12} /> Set as Active Engine
                  </button>
                )}
              </div>
            </div>

            {/* Model Selector & Key Input */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 6 }}>
                  Target LLM Model
                </label>
                <select
                  value={aiSelectedModels[selectedAiProvider] || activeAiMeta.defaultModel}
                  onChange={e => setAiSelectedModels(m => ({ ...m, [selectedAiProvider]: e.target.value }))}
                  style={{
                    width: '100%', background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
                    padding: '9px 12px', color: '#F1F5F9', fontSize: '0.8rem',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  {activeAiMeta.models.map(m => (
                    <option key={m.id} value={m.id} style={{ background: '#0F172A', color: '#FFF' }}>
                      {m.name} {m.recommended ? '★ (Recommended)' : ''} {m.free ? '— [Free Tier]' : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 4 }}>
                  Default model utilized for market reasoning and chat workflows.
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 6 }}>
                  <span>API Key (Paste any provider key to auto-detect)</span>
                  {activeAiBackend?.masked_key && activeAiBackend.masked_key !== 'Not Configured' && (
                    <span style={{ color: '#818CF8', fontFamily: 'monospace' }}>Saved: {activeAiBackend.masked_key}</span>
                  )}
                </label>
                <input
                  type="password"
                  value={aiKeysInput[selectedAiProvider] || ''}
                  onChange={e => handleAiKeyChange(e.target.value)}
                  placeholder={`Enter ${activeAiMeta.name} API Key (e.g. ${activeAiMeta.id === 'gemini' ? 'AIza...' : activeAiMeta.id === 'groq' ? 'gsk_...' : 'sk-...'})`}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 8, padding: '9px 12px', color: '#F8FAFC', fontSize: '0.8rem',
                    fontFamily: 'JetBrains Mono, monospace', outline: 'none'
                  }}
                />
                <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 4 }}>
                  Keys are encrypted server-side using AES-128 Fernet. Never stored in plaintext.
                </div>
              </div>
            </div>

            {/* Test Feedback Snippet if tested */}
            {aiTestResult && (
              <div style={{
                background: aiTestResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${aiTestResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: '0.74rem', color: aiTestResult.success ? '#34D399' : '#F87171',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {aiTestResult.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
                  <span>{aiTestResult.message}</span>
                </div>
                {aiTestResult.latency_ms && (
                  <span style={{ fontWeight: 800, fontFamily: 'monospace' }}>⚡ {aiTestResult.latency_ms}ms</span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleTestAi}
                disabled={aiTesting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)',
                  background: 'rgba(30,41,59,0.8)', color: '#CBD5E1', fontSize: '0.76rem',
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                <RefreshCw size={13} className={aiTesting ? 'broker-spin' : ''} />
                {aiTesting ? 'Testing Probe…' : 'Test API Key (Live Probe)'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveAi(false)}
                disabled={aiSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#FFF',
                  fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(99,102,241,0.3)'
                }}
              >
                <Shield size={13} /> {aiSaving ? 'Encrypting & Saving…' : 'Encrypt & Save to DB'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveAi(true)}
                disabled={aiSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 8, border: '1px solid #10B981',
                  background: 'rgba(16,185,129,0.15)', color: '#10B981',
                  fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer'
                }}
              >
                <Zap size={13} /> Save & Make Active Engine
              </button>

              {activeAiBackend?.has_credentials && (
                <button
                  type="button"
                  onClick={() => handleDeleteAi(selectedAiProvider)}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)', color: '#F87171',
                    fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} /> Delete Key
                </button>
              )}
            </div>
          </div>

          {/* AI Providers Comparison Matrix */}
          <div style={{
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '18px 20px',
            overflowX: 'auto'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Layers size={15} color="#818CF8" /> LLM Intelligence & Speed Matrix
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                  <th style={{ padding: '8px 10px' }}>Provider</th>
                  <th style={{ padding: '8px 10px' }}>Recommended Model</th>
                  <th style={{ padding: '8px 10px' }}>Latency (Speed)</th>
                  <th style={{ padding: '8px 10px' }}>Quantitative Quality</th>
                  <th style={{ padding: '8px 10px' }}>Pricing / Free Tier</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {AI_PROVIDERS_META.map(p => {
                  const bInfo = (aiData.providers || []).find(b => b.id === p.id);
                  const isAct = aiData.active_provider === p.id;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isAct ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: '#F8FAFC' }}>
                        {p.logo} {p.name}
                      </td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: '#818CF8' }}>
                        {p.defaultModel}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#34D399', fontWeight: 600 }}>
                        {p.speed}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#CBD5E1' }}>
                        {p.quality}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#94A3B8' }}>
                        {p.cost}
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        {isAct ? (
                          <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>ACTIVE</span>
                        ) : bInfo?.has_credentials ? (
                          <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>READY</span>
                        ) : (
                          <span style={{ color: '#64748B' }}>Unset</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 2: BROKER SETTINGS (ALL 12 BUGS FIXED)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'broker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active Broker Live Status Card */}
          <div style={{
            background: liveStatus?.session_active
              ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.06))',
            border: `1px solid ${liveStatus?.session_active ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: liveStatus?.session_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${liveStatus?.session_active ? '#10B981' : '#EF4444'}44`,
              }}>
                {liveStatus?.session_active
                  ? <Wifi size={22} color="#10B981" />
                  : <WifiOff size={22} color="#EF4444" />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#F8FAFC' }}>
                    Active Broker Feed: <span style={{ color: '#818CF8' }}>{(liveStatus?.active_broker || 'angel_one').toUpperCase().replace('_', ' ')}</span>
                  </span>
                  <StatusBadge status={liveStatus?.session_active ? 'connected' : 'failed'} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 3 }}>
                  {liveStatus?.session_active ? (
                    <span>
                      Session token authenticated • {liveStatus?.remaining_minutes != null ? `⏳ ${formatRemaining(liveStatus.remaining_minutes)}` : 'Active'}
                      {liveStatus.expires_at_ist && ` (Valid until ${liveStatus.expires_at_ist})`}
                    </span>
                  ) : (
                    <span style={{ color: '#F87171' }}>
                      {liveStatus?.last_auth_error || 'No active session. Save credentials and apply broker below.'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {brokerLatency && (
                <span style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', color: '#34D399', fontWeight: 800, fontFamily: 'monospace' }}>
                  ⚡ {brokerLatency}ms probe
                </span>
              )}
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
                {isRefreshing ? 'Checking…' : 'Sync Status'}
              </button>
            </div>
          </div>

          {/* Main Broker Workspace Grid */}
          <div className="broker-main-grid" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 16 }}>

            {/* Left Column: Broker Selector */}
            <div style={{
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, padding: '0 4px' }}>
                Select Supported Broker
              </div>

              {BROKERS.map(b => {
                const isSel = selectedBroker === b.id;
                const isAct = liveStatus?.active_broker === b.id;
                const st = statuses[b.id] || (isAct && liveStatus?.session_active ? 'connected' : (b.supported ? 'untested' : 'coming-soon'));

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBroker(b.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: isSel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                      border: isSel ? `1px solid ${b.color}` : '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: '1.2rem' }}>{b.logo}</span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isSel ? '#FFFFFF' : '#E2E8F0' }}>{b.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748B' }}>{b.subtitle}</div>
                      </div>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                );
              })}

              <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={handleExportConfigs}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '7px', borderRadius: 6, background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontSize: '0.7rem',
                    fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Download size={12} /> Backup Configs (JSON)
                </button>
              </div>
            </div>

            {/* Right Column: Broker Form */}
            <div style={{
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '20px 22px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>

              {/* Form Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.5rem' }}>{broker?.logo}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F1F5F9' }}>
                      {broker?.name} Configuration
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{broker?.subtitle}</span>
                  </div>
                </div>
                <StatusBadge status={currentStatus} />
              </div>

              {/* Form Fields */}
              <div>
                {broker?.fields.map(f => (
                  <FieldRow
                    key={f.key}
                    field={f}
                    value={creds[f.key]}
                    onChange={handleFieldChange}
                  />
                ))}
              </div>

              {/* Status/Error Banner */}
              {currentMsg && (
                <div style={{
                  padding: '9px 12px', borderRadius: 8, fontSize: '0.75rem',
                  background: currentStatus === 'connected' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${currentStatus === 'connected' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: currentStatus === 'connected' ? '#34D399' : '#F87171',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {currentStatus === 'connected' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                  <span>{currentMsg}</span>
                </div>
              )}

              {/* BUG #8 (MEDIUM): Accurate Disk vs DB Checkbox Label */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <input
                  type="checkbox"
                  id="persist-env"
                  checked={persistToDisk}
                  onChange={e => setPersistToDisk(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#6366F1', cursor: 'pointer' }}
                />
                <label htmlFor="persist-env" style={{ fontSize: '0.73rem', color: '#CBD5E1', cursor: 'pointer', lineHeight: 1.4 }}>
                  <b>Save to Disk (.env file):</b> Also write credentials to server <code>.env</code> file for survival across server reboots. Credentials are encrypted and saved to SQLite database regardless.
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={currentStatus === 'testing'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)',
                    background: 'rgba(30,41,59,0.8)', color: '#CBD5E1', fontSize: '0.78rem',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={currentStatus === 'testing' ? 'broker-spin' : ''} />
                  {currentStatus === 'testing' ? 'Testing Probe…' : 'Test Connection'}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: '#F1F5F9', fontSize: '0.78rem',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <Shield size={13} /> Save to Server (DB)
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={currentStatus === 'applying'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#FFFFFF',
                    fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(99,102,241,0.35)'
                  }}
                >
                  <Zap size={14} />
                  {currentStatus === 'applying' ? 'Activating Feed…' : 'Apply as Active Broker'}
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)', color: '#F87171',
                    fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} /> Clear
                </button>
              </div>

            </div>
          </div>

          {/* Broker Audit Logs Section */}
          {auditLogs.length > 0 && (
            <div style={{
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#818CF8" /> Recent Broker Connection Audit Trail
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {auditLogs.map((l, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)',
                    fontSize: '0.72rem', border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: '#818CF8', textTransform: 'uppercase' }}>{l.broker}</span>
                      <span style={{ color: '#94A3B8' }}>{l.event}</span>
                      <span style={{ color: '#CBD5E1' }}>{l.details}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {l.latency_ms && <span style={{ color: '#34D399', fontFamily: 'monospace' }}>{l.latency_ms}ms</span>}
                      <span style={{ color: '#64748B', fontSize: '0.68rem' }}>{l.created_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
