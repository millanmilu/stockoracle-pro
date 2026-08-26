import React, { useState } from 'react';
import useStore from '../../store/useStore';
import LiveChartView from '../LiveChartView';
import ValuationTerminalView from './ValuationTerminalView';
import OptionsStrategyLabView from './OptionsStrategyLabView';
import QuantRiskCockpit from './QuantRiskCockpit';
import RRGRotationView from './RRGRotationView';
import { Grid3X3, Columns, Maximize2, RefreshCw } from 'lucide-react';

export default function MultiTileWorkspace() {
  const { selectedSymbol } = useStore();
  const [layoutMode, setLayoutMode] = useState('4-grid'); // '2-split' | '4-grid'

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#04060E',
      overflow: 'hidden',
    }}>
      {/* Top Tile Control Ribbon */}
      <div style={{
        height: '42px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#090C18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Grid3X3 size={16} color="#818CF8" />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#F0F0FF', letterSpacing: '0.04em' }}>
            BLOOMBERG PRO MULTI-TILE WORKSPACE — {selectedSymbol}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLayoutMode('2-split')}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: layoutMode === '2-split' ? '#4F46E5' : 'rgba(255,255,255,0.06)',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Columns size={12} /> 2-Split View
          </button>
          <button
            onClick={() => setLayoutMode('4-grid')}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: layoutMode === '4-grid' ? '#4F46E5' : 'rgba(255,255,255,0.06)',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Grid3X3 size={12} /> 4-Grid Bloomberg View
          </button>
        </div>
      </div>

      {/* Dynamic Grid Layout */}
      {layoutMode === '2-split' ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ background: '#090C18', overflowY: 'auto' }}>
            <LiveChartView />
          </div>
          <div style={{ background: '#090C18', overflowY: 'auto' }}>
            <ValuationTerminalView ticker={selectedSymbol} />
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          overflow: 'hidden',
          gap: 1,
          background: 'rgba(255,255,255,0.08)'
        }}>
          {/* Tile 1: Live Pro Chart */}
          <div style={{ background: '#090C18', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <LiveChartView />
          </div>

          {/* Tile 2: DCF Valuation Model */}
          <div style={{ background: '#090C18', overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <ValuationTerminalView ticker={selectedSymbol} />
          </div>

          {/* Tile 3: Options Strategy Lab */}
          <div style={{ background: '#090C18', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <OptionsStrategyLabView ticker={selectedSymbol} />
          </div>

          {/* Tile 4: Quant Risk Cockpit */}
          <div style={{ background: '#090C18', overflowY: 'auto' }}>
            <QuantRiskCockpit />
          </div>
        </div>
      )}
    </div>
  );
}
