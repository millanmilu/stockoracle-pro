import React from 'react';
import {
  Wifi, WifiOff, RefreshCw, Zap, Shield, AlertTriangle, Clock,
  Download, Trash2, CheckCircle, CheckCircle2
} from 'lucide-react';
import { BROKERS } from './brokerConstants';
import { formatRemaining } from './brokerHelpers';
import StatusBadge from './StatusBadge';
import FieldRow from './FieldRow';

export default function BrokerTab({
  liveStatus, brokerLatency, isRefreshing, fetchStatus, savedAccounts,
  selectedBroker, setSelectedBroker, statuses, broker, creds, currentStatus, currentMsg,
  handleExportConfigs, handleQuickConnect, isConnecting, handleFieldChange,
  persistToDisk, setPersistToDisk, handleTest, handleSave, handleApply, handleClear,
  auditLogs,
}) {
  const messageIsSuccess = currentStatus === 'connected' || currentStatus === 'tested';
  return (
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
                const hasSaved = savedAccounts[b.id]?.has_credentials;
                const st = statuses[b.id] || (isAct && liveStatus?.session_active ? 'connected' : (hasSaved ? 'saved' : (b.supported ? 'untested' : 'coming-soon')));

                return (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setSelectedBroker(b.id)}
                    aria-pressed={isSel}
                    style={{
                      width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
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
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isSel ? '#FFFFFF' : '#E2E8F0', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{b.name}</span>
                          {hasSaved && (
                            <span title="Encrypted credentials stored on server" style={{ fontSize: '0.58rem', background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '0 4px', borderRadius: 3, fontWeight: 800 }}>
                              STORED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748B' }}>{b.subtitle}</div>
                      </div>
                    </div>
                    <StatusBadge status={st} />
                  </button>
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

              {/* Stored Credentials Profile Card & 1-Click Connect Banner */}
              {savedAccounts[selectedBroker]?.has_credentials && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(99, 102, 241, 0.08))',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.4)'
                    }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Saved Profile Ready</span>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                          SECURE VAULT
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 2 }}>
                        Credentials permanently encrypted in server database. You do not need to re-type them.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickConnect(selectedBroker)}
                    disabled={isConnecting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 16px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 800,
                      cursor: 'pointer', boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <Zap size={14} className={isConnecting ? 'broker-spin' : ''} />
                    {isConnecting ? 'Connecting…' : '⚡ 1-Click Connect'}
                  </button>
                </div>
              )}

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
                  background: messageIsSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${messageIsSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: messageIsSuccess ? '#34D399' : '#F87171',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {messageIsSuccess ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                  <span>{currentMsg}</span>
                </div>
              )}

              {/* Accurate Disk vs DB Checkbox Label */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <input
                  type="checkbox"
                  id="persist-env"
                  checked={persistToDisk}
                  onChange={e => setPersistToDisk(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#6366F1', cursor: 'pointer' }}
                />
                <label htmlFor="persist-env" style={{ fontSize: '0.73rem', color: '#CBD5E1', cursor: 'pointer', lineHeight: 1.4 }}>
                  <b>Save to Disk (.env file):</b> Also write credentials to server <code>backend/.env</code> for survival across server reboots. Credentials are encrypted and saved to PostgreSQL/database regardless.
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
                  disabled={currentStatus === 'saving'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: '#F1F5F9', fontSize: '0.78rem',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <Shield size={13} /> {currentStatus === 'saving' ? 'Saving…' : 'Save to Server (DB)'}
                </button>

                {savedAccounts[selectedBroker]?.has_credentials && (
                  <button
                    type="button"
                    onClick={() => handleQuickConnect(selectedBroker)}
                    disabled={isConnecting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 8, border: '1px solid #10B981',
                      background: 'rgba(16, 185, 129, 0.15)', color: '#10B981',
                      fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    <Zap size={14} className={isConnecting ? 'broker-spin' : ''} />
                    {isConnecting ? 'Connecting…' : 'Connect Stored Credentials'}
                  </button>
                )}

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
                  {currentStatus === 'applying' ? 'Activating Feed…' : 'Save & Apply Active'}
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

  );
}
