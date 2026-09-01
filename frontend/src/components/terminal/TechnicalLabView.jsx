import React, { useState } from 'react';
import useStore from '../../store/useStore';
import LevelsPanel from '../LevelsPanel';
import PatternsPanel from '../PatternsPanel';
import VolatilityPanel from '../VolatilityPanel';
import { Target, Zap, Activity, Layers, Sparkles } from 'lucide-react';

export default function TechnicalLabView({ initialTab = 'levels' }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  const TABS = [
    { id: 'levels',     label: 'Levels & S/R Zones', icon: Target,   desc: 'Pivots, Fibonacci & Volume Profile', color: '#38BDF8' },
    { id: 'patterns',   label: 'Chart Patterns',     icon: Zap,      desc: 'Pattern Recognition & Confluence',   color: '#F59E0B' },
    { id: 'volatility', label: 'Volatility Forecast',icon: Activity, desc: 'GARCH, Cones & ATR Bands',           color: '#A855F7' },
  ];

  return (
    <div style={{ padding: 'clamp(12px, 2vw, 22px)', maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box' }}>
      
      {/* Unified Technical Lab Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 12,
        padding: '12px 18px', backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.2))',
            border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers size={18} color="#38BDF8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                Technical Lab — <span style={{ color: '#818CF8' }}>{selectedSymbol}</span>
              </h2>
              <span style={{ fontSize: '0.62rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '2px 7px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                QUANT TA
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
              Multi-dimensional technical intelligence: algorithmic support/resistance, candlestick pattern confluence, and statistical volatility modeling.
            </p>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div style={{
          display: 'flex', gap: 6, background: 'rgba(9, 13, 30, 0.8)',
          padding: 4, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap'
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isSel = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  cursor: 'pointer', fontSize: '0.76rem', fontWeight: isSel ? 800 : 600,
                  background: isSel ? `linear-gradient(135deg, ${tab.color}25, ${tab.color}10)` : 'transparent',
                  color: isSel ? '#FFF' : '#94A3B8',
                  borderBottom: isSel ? `2px solid ${tab.color}` : '2px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} color={isSel ? tab.color : '#64748B'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Active Technical Tool */}
      <div style={{ width: '100%' }}>
        {activeSubTab === 'levels' && <LevelsPanel ticker={selectedSymbol} />}
        {activeSubTab === 'patterns' && <PatternsPanel ticker={selectedSymbol} />}
        {activeSubTab === 'volatility' && <VolatilityPanel ticker={selectedSymbol} />}
      </div>

    </div>
  );
}
