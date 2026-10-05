import React from 'react';
import { Play, RefreshCw, Settings, Search, BookOpen, Download, Copy, Check, BarChart2 } from 'lucide-react';
import { QUICK_TICKERS, PRESETS } from './backtestConstants';

export default function BacktestHeader({
  activeTicker, handleTickerSelect, searchInput, setSearchInput, handleSearchSubmit,
  strategy, setStrategy, strategyOptions, applyPreset, data, loading, copiedReport,
  handleCopyReport, handleExportCSV, setShowGuideModal, showSettings, setShowSettings, runBacktest,
}) {
  return (
      <div style={{
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.9))',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Title & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.15))',
              border: '1px solid rgba(99,102,241,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8'
            }}>
              <BarChart2 size={19} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Institutional Backtest Studio v3.0 — <span style={{ color: '#818CF8' }}>{activeTicker}</span>
                </h2>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)'
                }}>
                  OUT-OF-SAMPLE
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 1 }}>
                Multi-Strategy Walk-Forward Engine · Zero Look-Ahead Bias · Variable Frictions · Monthly Heatmap
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowGuideModal(true)}
              style={{
                background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: 8, padding: '6px 11px', color: '#38BDF8', fontSize: '0.72rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
              }}>
              <BookOpen size={13} />
              <span>Kaise Use Karein</span>
            </button>

            <button
              onClick={handleCopyReport}
              disabled={!data}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '6px 11px', color: '#94A3B8', fontSize: '0.72rem',
                fontWeight: 700, cursor: data ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 5
              }}>
              {copiedReport ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
              <span>{copiedReport ? 'Copied!' : 'Copy Report'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!data?.trade_journal?.length}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '6px 11px', color: '#94A3B8', fontSize: '0.72rem',
                fontWeight: 700, cursor: data?.trade_journal?.length ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 5
              }}>
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: showSettings ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${showSettings ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, padding: '6px 11px', color: showSettings ? '#818CF8' : '#94A3B8',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
              }}>
              <Settings size={13} />
              <span>Config & Risk</span>
            </button>

            <button
              onClick={() => runBacktest()}
              disabled={loading}
              style={{
                background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                border: 'none', borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: '0.76rem',
                fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(99,102,241,0.35)'
              }}>
              {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
              <span>{loading ? 'Simulating…' : 'Run Backtest'}</span>
            </button>
          </div>
        </div>

        {/* ── Sub-bar: Quick Switcher, Search & Strategy Select ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          {/* Quick Tickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginRight: 4 }}>
              Universe:
            </span>
            {QUICK_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => handleTickerSelect(t)}
                style={{
                  background: activeTicker === t ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeTicker === t ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  color: activeTicker === t ? '#818CF8' : '#94A3B8',
                  padding: '3px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}>
                {t}
              </button>
            ))}

            {/* Inline Search */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
              <div style={{
                position: 'relative', display: 'flex', alignItems: 'center',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '2px 6px'
              }}>
                <Search size={11} color="#64748B" style={{ marginRight: 4 }} />
                <input
                  type="text"
                  placeholder="Custom Ticker..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#F8FAFC', fontSize: '0.68rem', width: 90
                  }}
                />
              </div>
            </form>
          </div>

          {/* Strategy Dropdown & Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Strategy:
              </span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                style={{
                  background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.4)',
                  color: '#818CF8', borderRadius: 6, padding: '4px 8px', fontSize: '0.72rem',
                  fontWeight: 700, outline: 'none', cursor: 'pointer'
                }}>
                {strategyOptions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Presets Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  title={p.desc}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94A3B8', padding: '3px 7px', borderRadius: 5, fontSize: '0.64rem',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3
                  }}>
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

  );
}
