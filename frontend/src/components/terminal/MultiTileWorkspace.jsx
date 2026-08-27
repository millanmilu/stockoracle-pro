import React, { useState } from 'react';
import useStore from '../../store/useStore';
import ChartPane from '../ChartPane';
import MultiChartGrid from '../MultiChartGrid';
import ValuationTerminalView from './ValuationTerminalView';
import OptionsStrategyLabView from './OptionsStrategyLabView';
import QuantRiskCockpit from './QuantRiskCockpit';
import { 
  Grid2X2, Columns, LayoutGrid, Maximize2, Minimize2, 
  CandlestickChart, Calculator, Layers, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';

export default function MultiTileWorkspace() {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const [workspaceMode, setWorkspaceMode] = useState('institutional-4'); // 'institutional-4' | '4-charts' | '2-split'
  const [maximizedTile, setMaximizedTile] = useState(null); // null | 1 | 2 | 3 | 4

  const toggleMaximize = (tileId) => {
    setMaximizedTile(maximizedTile === tileId ? null : tileId);
  };

  const renderTileHeader = (tileId, title, icon, color, badgeText) => {
    const Icon = icon;
    const isMax = maximizedTile === tileId;
    return (
      <div style={{
        height: '36px',
        background: '#090D1E',
        borderBottom: '1px solid rgba(99, 102, 241, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        flexShrink: 0,
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            color: '#FFFFFF',
            background: color || '#6366F1',
            padding: '1px 6px',
            borderRadius: '4px',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            T{tileId}
          </span>
          <Icon size={14} color={color || '#818CF8'} />
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#F0F0FF', letterSpacing: '0.02em' }}>
            {title}
          </span>
          {badgeText && (
            <span style={{
              fontSize: '0.64rem',
              color: '#818CF8',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 600
            }}>
              {badgeText}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => toggleMaximize(tileId)}
            title={isMax ? "Restore Tile" : "Maximize Tile"}
            style={{
              background: isMax ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '3px 7px',
              color: isMax ? '#818CF8' : '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.68rem',
              fontWeight: 600,
              transition: 'all 0.15s'
            }}
          >
            {isMax ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            <span>{isMax ? 'Restore' : 'Maximize'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#04050E',
      overflow: 'hidden',
    }}>

      {/* ── Top Workspace Ribbon ── */}
      <div style={{
        height: '42px',
        background: '#070A17',
        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 20
      }}>
        {/* Left: Workspace Title & Active Asset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Grid2X2 size={16} color="#818CF8" />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#F0F0FF', letterSpacing: '0.03em' }}>
            MULTI-TILE WORKSPACE
          </span>
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 8px',
            borderRadius: '5px',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#818CF8',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700
          }}>
            {selectedSymbol}
          </span>
        </div>

        {/* Right: Mode Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => { setWorkspaceMode('institutional-4'); setMaximizedTile(null); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: workspaceMode === 'institutional-4' ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
              background: workspaceMode === 'institutional-4' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
              color: workspaceMode === 'institutional-4' ? '#F0F0FF' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s'
            }}
          >
            <LayoutGrid size={13} />
            <span>4-Quadrant Suite</span>
          </button>

          <button
            onClick={() => { setWorkspaceMode('4-charts'); setMaximizedTile(null); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: workspaceMode === '4-charts' ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
              background: workspaceMode === '4-charts' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
              color: workspaceMode === '4-charts' ? '#F0F0FF' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s'
            }}
          >
            <CandlestickChart size={13} />
            <span>4-Chart Grid</span>
          </button>

          <button
            onClick={() => { setWorkspaceMode('2-split'); setMaximizedTile(null); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: workspaceMode === '2-split' ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
              background: workspaceMode === '2-split' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
              color: workspaceMode === '2-split' ? '#F0F0FF' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s'
            }}
          >
            <Columns size={13} />
            <span>2-Split View</span>
          </button>
        </div>
      </div>

      {/* ── Mode 1: 4-Chart Grid (Multi-Asset Candlesticks) ── */}
      {workspaceMode === '4-charts' ? (
        <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
          <MultiChartGrid layout="2x2" />
        </div>
      ) : workspaceMode === '2-split' ? (
        /* ── Mode 2: 2-Split View (Pro Chart + DCF Valuation) ── */
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: maximizedTile === 1 ? '1fr' : (maximizedTile === 2 ? '1fr' : '1fr 1fr'),
          gap: 6,
          padding: 6,
          overflow: 'hidden',
          background: '#04050E'
        }}>
          {(maximizedTile === null || maximizedTile === 1) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#070A17',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.2)',
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}>
              {renderTileHeader(1, `Pro Chart — ${selectedSymbol}`, CandlestickChart, '#6366F1', 'Live Market')}
              <div style={{ flex: 1, minHeight: 0, height: '100%', position: 'relative' }}>
                <ChartPane
                  paneId={0}
                  symbol={selectedSymbol}
                  interval="1d"
                  isActive={true}
                  onSelectPane={() => {}}
                  onSymbolChange={(id, s) => setSelectedSymbol(s)}
                  onIntervalChange={() => {}}
                  onToggleMaximize={() => toggleMaximize(1)}
                  isMaximized={maximizedTile === 1}
                />
              </div>
            </div>
          )}

          {(maximizedTile === null || maximizedTile === 2) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#070A17',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.2)',
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}>
              {renderTileHeader(2, `DCF Valuation — ${selectedSymbol}`, Calculator, '#10B981', 'Fair Value')}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <ValuationTerminalView ticker={selectedSymbol} compact={maximizedTile === null} />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Mode 3: 4-Quadrant Institutional Analysis Suite ── */
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: maximizedTile ? '1fr' : '1fr 1fr',
          gridTemplateRows: maximizedTile ? '1fr' : '1fr 1fr',
          gap: 6,
          padding: 6,
          overflow: 'hidden',
          background: '#04050E'
        }}>
          {/* Quadrant 1: Pro Trading Chart */}
          {(maximizedTile === null || maximizedTile === 1) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#070A17',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.2)',
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}>
              {renderTileHeader(1, `Pro Chart — ${selectedSymbol}`, CandlestickChart, '#6366F1', 'Live Market')}
              <div style={{ flex: 1, minHeight: 0, height: '100%', position: 'relative' }}>
                <ChartPane
                  paneId={0}
                  symbol={selectedSymbol}
                  interval="1d"
                  isActive={true}
                  onSelectPane={() => {}}
                  onSymbolChange={(id, s) => setSelectedSymbol(s)}
                  onIntervalChange={() => {}}
                  onToggleMaximize={() => toggleMaximize(1)}
                  isMaximized={maximizedTile === 1}
                />
              </div>
            </div>
          )}

          {/* Quadrant 2: DCF Valuation Model */}
          {(maximizedTile === null || maximizedTile === 2) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#070A17',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.2)',
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}>
              {renderTileHeader(2, `DCF Valuation — ${selectedSymbol}`, Calculator, '#10B981', 'Fair Value')}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <ValuationTerminalView ticker={selectedSymbol} compact={maximizedTile === null} />
              </div>
            </div>
          )}

          {/* Quadrant 3: Options Strategy Lab */}
          {(maximizedTile === null || maximizedTile === 3) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#070A17',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.2)',
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}>
              {renderTileHeader(3, `Options Strategy — ${selectedSymbol}`, Layers, '#F59E0B', 'Payoff & Greeks')}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <OptionsStrategyLabView ticker={selectedSymbol} compact={maximizedTile === null} />
              </div>
            </div>
          )}

          {/* Quadrant 4: Quant Risk Cockpit */}
          {(maximizedTile === null || maximizedTile === 4) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#070A17',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.2)',
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}>
              {renderTileHeader(4, `Quant Risk (VaR) — ${selectedSymbol}`, ShieldAlert, '#EC4899', 'Portfolio Risk')}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <QuantRiskCockpit compact={maximizedTile === null} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
