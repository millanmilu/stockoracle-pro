import React, { useId } from 'react';
import { RefreshCw, Zap, Shield, CheckCircle, XCircle, Trash2, ExternalLink, Layers } from 'lucide-react';
import { AI_PROVIDERS_META } from './brokerConstants';

export default function AiProvidersTab({
  selectedAiProvider, setSelectedAiProvider, aiData, aiKeysInput, aiSelectedModels,
  setAiSelectedModels,   aiTesting, aiTestResult, aiSaving, aiRefreshing, fetchAiProviders,
  handleAiKeyChange, handleTestAi, handleSaveAi, handleActivateAi, handleDeleteAi,
}) {
  const activeAiMeta = AI_PROVIDERS_META.find(p => p.id === selectedAiProvider) || AI_PROVIDERS_META[0];
  const activeAiBackend = (aiData.providers || []).find(p => p.id === selectedAiProvider);
  const modelSelectId = useId();
  const apiKeyInputId = useId();
  return (
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
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
                  All market analysis, trade explanations, news sentiment, and NLP screening queries route dynamically to this active provider.
                </div>
              </div>
            </div>

            <button
              onClick={() => fetchAiProviders(true)}
              disabled={aiRefreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 8, padding: '7px 12px', color: '#CBD5E1', fontSize: '0.74rem',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={aiRefreshing ? 'broker-spin' : ''} /> {aiRefreshing ? 'Refreshing…' : 'Refresh Providers'}
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
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedAiProvider(p.id)}
                  aria-pressed={isSelected}
                  style={{
                    width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
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
                </button>
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
                <label htmlFor={modelSelectId} style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 6 }}>
                  Target LLM Model
                </label>
                <select
                  id={modelSelectId}
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
                <label htmlFor={apiKeyInputId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 6 }}>
                  <span>API Key (Paste any provider key to auto-detect)</span>
                  {activeAiBackend?.masked_key && activeAiBackend.masked_key !== 'Not Configured' && (
                    <span style={{ color: '#818CF8', fontFamily: 'monospace' }}>Saved: {activeAiBackend.masked_key}</span>
                  )}
                </label>
                <input
                  id={apiKeyInputId}
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

  );
}
