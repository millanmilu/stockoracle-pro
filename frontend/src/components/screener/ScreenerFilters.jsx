import React from 'react';
import { UNIVERSES, SECTORS } from '../../constants/screenerConfig';
import { Sliders, Terminal, RefreshCw, Play, RotateCcw } from 'lucide-react';

export default function ScreenerFilters({
  universe = 'ALL NSE',
  setUniverse,
  selectedSector = 'ALL',
  setSelectedSector,
  minRoce = 15,
  setMinRoce,
  maxPe = 40,
  setMaxPe,
  maxDebt = 1.5,
  setMaxDebt,
  minRsi = 0,
  setMinRsi,
  maxRsi = 100,
  setMaxRsi,
  minVolRatio = 0.8,
  setMinVolRatio,
  marketCapCat = 'ALL',
  setMarketCapCat,
  queryMode = 'visual',
  setQueryMode,
  formulaQuery = '',
  setFormulaQuery,
  onResetFilters,
  onRunScreen,
  loading = false,
  onClose
}) {
  return (
    <div style={{
      background: '#090D1C',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      {/* Top Row: Mode switcher & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setQueryMode('visual')}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: queryMode === 'visual' ? 'rgba(99,102,241,0.25)' : 'transparent',
              color: queryMode === 'visual' ? '#818CF8' : '#64748B',
              fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            <Sliders size={12} /> Sliders Filter Builder
          </button>
          <button
            type="button"
            onClick={() => setQueryMode('formula')}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: queryMode === 'formula' ? 'rgba(99,102,241,0.25)' : 'transparent',
              color: queryMode === 'formula' ? '#818CF8' : '#64748B',
              fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            <Terminal size={12} /> Screener.in SQL Formula
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)',
              color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            <RotateCcw size={11} /> Reset
          </button>
          <button
            type="button"
            onClick={() => onRunScreen()}
            disabled={loading}
            style={{
              padding: '4px 12px', borderRadius: 6, background: '#10B981', color: '#FFF',
              border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
            }}
          >
            {loading ? <RefreshCw size={11} className="spin" /> : <Play size={11} />} Apply & Run
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Index Universe Selector */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginRight: 2 }}>Universe:</span>
        {UNIVERSES.slice(0, 10).map((u) => {
          const isActive = universe === u.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setUniverse(u.id)}
              style={{
                padding: '3px 8px', borderRadius: 12,
                background: isActive ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.03)',
                border: isActive ? '1px solid transparent' : '1px solid rgba(255,255,255,0.06)',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                fontSize: '0.66rem', fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s'
              }}
            >
              {u.icon} {u.id}
            </button>
          );
        })}
      </div>

      {queryMode === 'visual' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, paddingTop: 4 }}>
          {/* ROCE */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>Min ROCE %</span><strong style={{ color: '#10B981' }}>{minRoce}%</strong>
            </div>
            <input 
              type="range" min="0" max="60" value={minRoce} 
              onChange={(e) => setMinRoce(Number(e.target.value))} 
              style={{ width: '100%', accentColor: '#10B981' }} 
            />
          </div>

          {/* Max P/E */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>Max P/E Ratio</span><strong style={{ color: '#38BDF8' }}>{maxPe}x</strong>
            </div>
            <input 
              type="range" min="5" max="80" value={maxPe} 
              onChange={(e) => setMaxPe(Number(e.target.value))} 
              style={{ width: '100%', accentColor: '#38BDF8' }} 
            />
          </div>

          {/* Max Debt/Equity */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>Max Debt/Equity</span><strong style={{ color: '#F59E0B' }}>{maxDebt}x</strong>
            </div>
            <input 
              type="range" min="0" max="3" step="0.1" value={maxDebt} 
              onChange={(e) => setMaxDebt(Number(e.target.value))} 
              style={{ width: '100%', accentColor: '#F59E0B' }} 
            />
          </div>

          {/* RSI Range */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>RSI (14) Range</span><strong style={{ color: '#818CF8' }}>{minRsi} - {maxRsi}</strong>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input 
                type="range" min="0" max="50" value={minRsi} 
                onChange={(e) => setMinRsi(Number(e.target.value))} 
                style={{ width: '50%', accentColor: '#818CF8' }} 
              />
              <input 
                type="range" min="50" max="100" value={maxRsi} 
                onChange={(e) => setMaxRsi(Number(e.target.value))} 
                style={{ width: '50%', accentColor: '#818CF8' }} 
              />
            </div>
          </div>

          {/* Vol Ratio */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>Min Vol Surge</span><strong style={{ color: '#A855F7' }}>{minVolRatio}x</strong>
            </div>
            <input 
              type="range" min="0.5" max="3.0" step="0.1" value={minVolRatio} 
              onChange={(e) => setMinVolRatio(Number(e.target.value))} 
              style={{ width: '100%', accentColor: '#A855F7' }} 
            />
          </div>

          {/* Market Cap Filter */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>Market Cap Category</span>
            </div>
            <select
              value={marketCapCat}
              onChange={(e) => setMarketCapCat(e.target.value)}
              style={{ width: '100%', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px', color: '#F1F5F9', fontSize: '0.68rem' }}
            >
              <option value="ALL">All Market Caps</option>
              <option value="LARGE">Large Cap (&gt; ₹50,000 Cr)</option>
              <option value="MID">Mid Cap (₹10,000–50,000 Cr)</option>
              <option value="SMALL">Small Cap (&lt; ₹10,000 Cr)</option>
            </select>
          </div>

          {/* Sector Filter */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
              <span>Sector Filter</span>
            </div>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              style={{ width: '100%', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px', color: '#F1F5F9', fontSize: '0.68rem' }}
            >
              <option value="ALL">All Sectors</option>
              <option value="IT">IT & Software</option>
              <option value="Banking">Banking & Financials</option>
              <option value="Pharma">Pharma & Healthcare</option>
              <option value="Auto">Automobiles</option>
              <option value="Energy">Energy & Utilities</option>
              <option value="FMCG">FMCG & Consumer</option>
              <option value="Metals">Metals & Mining</option>
              <option value="Realty">Infrastructure & Realty</option>
              <option value="Chemicals">Chemicals & Materials</option>
              <option value="Telecom">Telecom & Media</option>
            </select>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            value={formulaQuery}
            onChange={(e) => setFormulaQuery(e.target.value)}
            rows={2}
            style={{
              width: '100%', background: '#060913', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6, padding: '6px 10px', color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem', outline: 'none'
            }}
          />
          <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 4 }}>
            Supported variables: <code>ROCE</code>, <code>ROE</code>, <code>PE</code>, <code>PB</code>, <code>DebtToEquity</code>, <code>RSI14</code>, <code>VolumeRatio20D</code>, <code>MarketCap</code>, <code>Sector</code>, <code>MarketCapCat</code>
          </div>
        </div>
      )}
    </div>
  );
}
