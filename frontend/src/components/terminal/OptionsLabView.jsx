import React, { useState } from 'react';
import useStore from '../../store/useStore';
import OptionsChainView from '../OptionsChainView';
import OptionsStrategyLabView from './OptionsStrategyLabView';
import { Layers, GitCommit, Sliders, ShieldCheck } from 'lucide-react';

export default function OptionsLabView({ initialTab = 'chain' }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  const TABS = [
    { id: 'chain',    label: 'Live Options Chain',    icon: Layers,    desc: 'Calls, Puts, Greeks, PCR & Max Pain', color: '#10B981' },
    { id: 'strategy', label: 'Strategy Lab & Payoff', icon: GitCommit, desc: 'Multi-Leg Options Payoff Profiler',  color: '#F97316' },
  ];

  return (
    <div style={{ padding: 'clamp(12px, 2vw, 22px)', maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box' }}>

      {/* Top Header & Sub-Tab Switcher */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 12,
        padding: '12px 18px', backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(249, 115, 22, 0.2))',
            border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers size={18} color="#10B981" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                Options & Derivatives Lab — <span style={{ color: '#818CF8' }}>{selectedSymbol}</span>
              </h2>
              <span style={{ fontSize: '0.62rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '2px 7px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                F&O DERIVATIVES
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
              Real-time NSE options chain with implied volatility, open interest heatmaps, and institutional multi-leg strategy payoff modeling.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
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

      {/* Content Area */}
      <div style={{ width: '100%' }}>
        {activeSubTab === 'chain' && <OptionsChainView ticker={selectedSymbol} />}
        {activeSubTab === 'strategy' && <OptionsStrategyLabView ticker={selectedSymbol} compact={false} />}
      </div>

    </div>
  );
}
