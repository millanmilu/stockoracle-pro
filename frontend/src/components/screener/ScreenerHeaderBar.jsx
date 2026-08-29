import React from 'react';
import { SlidersHorizontal, Filter, Download, Save, Dices } from 'lucide-react';

export default function ScreenerHeaderBar({
  filtersOpen,
  onToggleFilters,
  queryMode,
  onExportCsv,
  onOpenSaveModal,
  onOpenBacktestModal
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.6) 0%, rgba(9, 13, 28, 0.8) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      borderRadius: 14,
      padding: '12px 18px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Brand & Subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
        }}>
          <SlidersHorizontal size={20} color="#FFF" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
              Institutional Screener
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: '#A5B4FC',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.05em'
            }}>
              PRO v2.0
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 2, fontWeight: 500 }}>
            Real-time multi-factor quantitative scanning • Live WebSocket ticks • 100% True Backtesting
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onToggleFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            background: filtersOpen ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            color: filtersOpen ? '#A5B4FC' : '#94A3B8',
            border: filtersOpen ? '1px solid #6366F1' : '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            fontSize: '0.74rem',
            fontWeight: 700,
            transition: 'all 0.15s ease'
          }}
        >
          <Filter size={14} /> Filter Drawer
          <span style={{
            background: '#6366F1',
            color: '#FFF',
            borderRadius: '50%',
            width: 17,
            height: 17,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            fontWeight: 800
          }}>
            {queryMode === 'visual' ? '10' : '1'}
          </span>
        </button>

        <button
          onClick={onExportCsv}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 13px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#CBD5E1',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            fontSize: '0.74rem',
            fontWeight: 600,
            transition: 'all 0.15s ease'
          }}
        >
          <Download size={14} /> Export CSV
        </button>

        <button
          onClick={onOpenSaveModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 13px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#CBD5E1',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            fontSize: '0.74rem',
            fontWeight: 600,
            transition: 'all 0.15s ease'
          }}
        >
          <Save size={14} /> Save Screen
        </button>

        <button
          onClick={onOpenBacktestModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 15px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: '#FFF',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.74rem',
            fontWeight: 800,
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
            transition: 'transform 0.15s ease'
          }}
        >
          <Dices size={14} /> Backtest Strategy
        </button>
      </div>
    </div>
  );
}
