import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Key, Brain } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE, BROKERS } from './broker-settings/brokerConstants';
import { buildCleanPayload, readApiResponse, validateBrokerInputs } from './broker-settings/brokerHelpers';
import useAiProviders from './broker-settings/useAiProviders';
import AiProvidersTab from './broker-settings/AiProvidersTab';
import BrokerTab from './broker-settings/BrokerTab';

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

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export default function BrokerSettingsView({ initialTab = 'broker' }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'ai' ? 'ai' : 'broker');
  useEffect(() => {
    setActiveTab(initialTab === 'ai' ? 'ai' : 'broker');
  }, [initialTab]);
  
  // ── Broker State ──
  const [selectedBroker, setSelectedBroker] = useState('angel_one');
  const [configs, setConfigs] = useState({});
  const [dirtyFields, setDirtyFields] = useState({}); // Bug #2: tracks user-edited fields
  const dirtyFieldsRef = useRef(dirtyFields);
  dirtyFieldsRef.current = dirtyFields;
  const [statuses, setStatuses] = useState({});
  const [messages, setMessages] = useState({});
  const [liveStatus, setLiveStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [persistToDisk, setPersistToDisk] = useState(false);
  const [brokerLatency, setBrokerLatency] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [savedAccounts, setSavedAccounts] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  
  const aiProviders = useAiProviders();
  const { fetchAiProviders } = aiProviders;


  const timerRef = useRef(null);

  /* Function to fetch live status and saved accounts from backend DB */
  const fetchStatus = useCallback(async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const responses = await Promise.all([
        fetch(`${API_BASE}/api/broker/status`),
        fetch(`${API_BASE}/api/broker/accounts`),
        fetch(`${API_BASE}/api/broker/audit-logs?limit=8`),
      ]);
      const [statusData, accountsData, logsData] = await Promise.all(
        responses.map((response) => readApiResponse(response, 'Could not sync broker settings.'))
      );

      setLiveStatus(statusData);
      if (statusData.session_active && statusData.active_broker) {
        setStatuses(s => ({ ...s, [statusData.active_broker]: 'connected' }));
      }

      if (accountsData.accounts) {
        setSavedAccounts(accountsData.accounts);
        setConfigs(prev => {
          const next = { ...prev };
          Object.entries(accountsData.accounts).forEach(([bId, bVal]) => {
            if (bVal.credentials && Object.keys(bVal.credentials).length > 0) {
              const dirty = dirtyFieldsRef.current[bId] || {};
              const serverCredentials = Object.fromEntries(
                Object.entries(bVal.credentials).filter(([key]) => !dirty[key])
              );
              next[bId] = { ...(next[bId] || {}), ...serverCredentials };
            }
          });
          return next;
        });
      }

      setAuditLogs(logsData.logs || []);

      if (showToast) toast.success('Synced with backend database.');
    } catch (error) {
      if (showToast) toast.error(error.message || 'Could not reach backend API.');
      else console.error('Broker settings sync failed:', error);
    } finally {
      setIsRefreshing(false);
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
    setStatuses(s => ({ ...s, [selectedBroker]: 'untested' }));
  };


  /* BUG #5 (HIGH): "Save to Server" saves to SQLite backend DB */
  const handleSave = async () => {
    const clean = buildCleanPayload(configs, dirtyFields, selectedBroker);
    if (!validateBrokerInputs(selectedBroker, clean)) return;

    setStatuses(s => ({ ...s, [selectedBroker]: 'saving' }));
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
      const data = await readApiResponse(res, 'Could not save broker credentials.');
      if (data.success) {
        setDirtyFields(prev => ({ ...prev, [selectedBroker]: {} }));
        setStatuses(s => ({ ...s, [selectedBroker]: 'saved' }));
        toast.success(`Saved ${selectedBroker} credentials securely to server DB!`);
        fetchStatus();
      } else {
        setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
        toast.error(data.message || 'Save failed.');
      }
    } catch (error) {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      toast.error(error.message || 'Network error saving to server.');
    }
  };

  /* Test Connection (Bug #9: Real probe & Latency) */
  const handleTest = async () => {
    const clean = buildCleanPayload(configs, dirtyFields, selectedBroker);
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
      const data = await readApiResponse(res, 'Broker connection test failed.');
      const elapsed = Math.round(performance.now() - t0);
      setBrokerLatency(data.latency_ms ?? elapsed);
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'tested' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message || 'Connection test failed.' }));
      
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
      fetchStatus();
    } catch (error) {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: error.message || 'Network error — could not contact backend.' }));
      toast.error(error.message || 'Network error');
    }
  };

  /* Apply and Activate Broker for Live Feed */
  const handleApply = async () => {
    const clean = buildCleanPayload(configs, dirtyFields, selectedBroker);
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
      const data = await readApiResponse(res, 'Could not activate this broker.');
      setStatuses(s => ({ ...s, [selectedBroker]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: data.message }));
      if (data.success) {
        setDirtyFields(prev => ({ ...prev, [selectedBroker]: {} }));
        toast.success(data.message || 'Broker activated! Live stream active.');
        fetchStatus();
      } else {
        toast.error(data.message || 'Broker activation failed.');
      }
    } catch (error) {
      setStatuses(s => ({ ...s, [selectedBroker]: 'failed' }));
      setMessages(m => ({ ...m, [selectedBroker]: error.message || 'Network error while applying credentials.' }));
      toast.error(error.message || 'Network error');
    }
  };

  /* 1-Click Quick Connect Using Stored Credentials (No form typing needed) */
  const handleQuickConnect = async (brokerId = selectedBroker) => {
    setIsConnecting(true);
    setStatuses(s => ({ ...s, [brokerId]: 'applying' }));
    try {
      const res = await fetch(`${API_BASE}/api/broker/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: brokerId }),
      });
      const data = await readApiResponse(res, 'Could not connect using stored credentials.');
      setStatuses(s => ({ ...s, [brokerId]: data.success ? 'connected' : 'failed' }));
      setMessages(m => ({ ...m, [brokerId]: data.message }));
      if (data.success) {
        toast.success(data.message || 'Connected successfully!');
        fetchStatus();
      } else {
        toast.error(data.message || 'Connection failed.');
      }
    } catch (error) {
      setStatuses(s => ({ ...s, [brokerId]: 'failed' }));
      setMessages(m => ({ ...m, [brokerId]: error.message || 'Network error while connecting broker.' }));
      toast.error(error.message || 'Network error connecting broker.');
    } finally {
      setIsConnecting(false);
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
      const data = await readApiResponse(res, 'Could not clear broker credentials.');
      if (data.success) {
        setConfigs(prev => { const u = { ...prev }; delete u[selectedBroker]; return u; });
        setDirtyFields(prev => { const u = { ...prev }; delete u[selectedBroker]; return u; });
        setStatuses(s => ({ ...s, [selectedBroker]: 'untested' }));
        setMessages(m => ({ ...m, [selectedBroker]: '' }));
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.message || 'Could not clear broker credentials.');
      }
    } catch (error) {
      toast.error(error.message || 'Network error clearing credentials.');
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


  // BUG #4 (HIGH): Only show "connected" for the active broker
  const broker = BROKERS.find(b => b.id === selectedBroker);
  const creds = configs[selectedBroker] || {};
  const isActiveBroker = liveStatus?.active_broker === selectedBroker;
  const currentStatus = statuses[selectedBroker] || (isActiveBroker && liveStatus?.session_active ? 'connected' : (broker?.supported ? 'untested' : 'coming-soon'));
  const currentMsg = messages[selectedBroker] || '';


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
            aria-pressed={activeTab === 'broker'}
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
            aria-pressed={activeTab === 'ai'}
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
        <AiProvidersTab {...aiProviders} />
      )}


      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 2: BROKER SETTINGS (ALL 12 BUGS FIXED)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'broker' && (
        <BrokerTab
          liveStatus={liveStatus}
          brokerLatency={brokerLatency}
          isRefreshing={isRefreshing}
          fetchStatus={fetchStatus}
          savedAccounts={savedAccounts}
          selectedBroker={selectedBroker}
          setSelectedBroker={setSelectedBroker}
          statuses={statuses}
          broker={broker}
          creds={creds}
          currentStatus={currentStatus}
          currentMsg={currentMsg}
          handleExportConfigs={handleExportConfigs}
          handleQuickConnect={handleQuickConnect}
          isConnecting={isConnecting}
          handleFieldChange={handleFieldChange}
          persistToDisk={persistToDisk}
          setPersistToDisk={setPersistToDisk}
          handleTest={handleTest}
          handleSave={handleSave}
          handleApply={handleApply}
          handleClear={handleClear}
          auditLogs={auditLogs}
        />
      )}

    </div>
  );
}
