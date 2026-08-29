import React, { memo } from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import FiftyTwoWeekBar from './FiftyTwoWeekBar';
import RsiBar from './RsiBar';
import VolumeChip from './VolumeChip';

function ScreenerTableRowComponent({ 
  row, 
  index, 
  activeTab = 'all',
  isSelected = false, 
  onToggleSelect, 
  onInspect,
  onNavigateChart, 
  onNavigateFundamentals,
  liveTick
}) {
  const price = liveTick?.price != null ? liveTick.price : (row.close_price ?? row.price ?? 0);
  const change1d = liveTick?.change_pct != null ? liveTick.change_pct : (row.change_1d_pct ?? row.change ?? 0);
  const isPositive = change1d >= 0;
  
  const isHighRoce = (row.roce_pct || 0) >= 20;
  const isOverbought = (row.rsi_14 || row.rsi || 50) >= 70;
  const isOversold = (row.rsi_14 || row.rsi || 50) <= 35;
  const isStrongAi = (row.ai_consensus_score || row.ai_score || 50) >= 80;

  return (
    <tr
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        textAlign: 'right',
        color: '#CBD5E1',
        background: isSelected 
          ? 'rgba(99,102,241,0.14)' 
          : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
        cursor: 'pointer',
        transition: 'background 0.12s'
      }}
      onClick={() => onInspect(row)}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      }}
    >
      {/* Checkbox */}
      <td style={{ textAlign: 'center', padding: '6px 8px', width: 30 }} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(row.ticker)}
          style={{ cursor: 'pointer', accentColor: '#6366F1' }}
        />
      </td>

      {/* Index number */}
      <td style={{ textAlign: 'left', padding: '6px 8px', color: '#475569', fontSize: '0.62rem' }}>
        {index + 1}
      </td>

      {/* Ticker & Name */}
      <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#F8FAFC' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span 
            style={{ color: '#38BDF8', fontWeight: 800 }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigateChart(row.ticker);
            }}
          >
            {row.ticker}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 400, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name || row.ticker}
          </span>
        </div>
      </td>

      {/* Sector */}
      <td style={{ textAlign: 'left', padding: '6px 8px' }}>
        <span style={{ padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontSize: '0.62rem' }}>
          {row.sector || 'General'}
        </span>
      </td>

      {/* Price */}
      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#F1F5F9', fontFamily: 'JetBrains Mono, monospace' }}>
        ₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>

      {/* 1D Change */}
      <td style={{ padding: '6px 8px', color: isPositive ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
        {isPositive ? '+' : ''}{Number(change1d).toFixed(2)}%
      </td>

      {/* Valuation columns */}
      {(activeTab === 'all' || activeTab === 'valuation') && (
        <>
          <td style={{ padding: '6px 8px', color: (row.pe_ratio || 0) < 25 ? '#38BDF8' : '#CBD5E1' }}>
            {row.pe_ratio != null ? `${row.pe_ratio}x` : '—'}
          </td>
          <td style={{ padding: '6px 8px', color: isHighRoce ? '#10B981' : '#CBD5E1', fontWeight: isHighRoce ? 700 : 500 }}>
            {row.roce_pct != null ? `${row.roce_pct}%` : '—'}
          </td>
          <td style={{ padding: '6px 8px', color: (row.debt_to_equity || 0) < 0.5 ? '#10B981' : '#F59E0B' }}>
            {row.debt_to_equity != null ? row.debt_to_equity : '—'}
          </td>
        </>
      )}

      {/* Technical columns */}
      {(activeTab === 'all' || activeTab === 'technical') && (
        <>
          <td style={{ padding: '6px 8px' }}>
            <span style={{
              padding: '2px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 700,
              background: isOverbought ? 'rgba(239,68,68,0.15)' : isOversold ? 'rgba(16,185,129,0.15)' : 'transparent',
              color: isOverbought ? '#EF4444' : isOversold ? '#10B981' : '#94A3B8'
            }}>
              {row.rsi_14 != null ? row.rsi_14 : (row.rsi || '—')}
            </span>
          </td>
          <td style={{ padding: '6px 8px', color: (row.volume_ratio_20d || row.volume_ratio || 1) > 1.5 ? '#A855F7' : '#94A3B8', fontWeight: 700 }}>
            {row.volume_ratio_20d != null ? `${row.volume_ratio_20d}x` : (row.volume_ratio ? `${row.volume_ratio}x` : '—')}
          </td>
        </>
      )}

      {/* AI Score */}
      {(activeTab === 'all' || activeTab === 'ai') && (
        <td style={{ padding: '6px 8px' }}>
          <span style={{
            padding: '2px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 800,
            background: isStrongAi ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.15)',
            color: isStrongAi ? '#10B981' : '#818CF8',
            border: isStrongAi ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(99,102,241,0.3)'
          }}>
            {row.ai_consensus_score || row.ai_score || 50} • {row.ai_signal || row.signal?.toUpperCase() || 'BUY'}
          </span>
        </td>
      )}

      {/* 52W Range mini-bar */}
      {activeTab === 'all' && (
        <td style={{ padding: '6px 8px', width: 90 }}>
          <FiftyTwoWeekBar price={price} low52w={row.distance_52w_low_pct} high52w={row.distance_52w_high_pct} />
        </td>
      )}

      {/* Quick Action Buttons */}
      <td style={{ padding: '6px 8px', textAlign: 'center', width: 90 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button
            onClick={() => onNavigateChart(row.ticker)}
            title="Open Live Chart"
            style={{
              padding: '3px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.12)',
              color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)', cursor: 'pointer',
              fontSize: '0.6rem', fontWeight: 700
            }}
          >
            Chart
          </button>
          <button
            onClick={() => onNavigateFundamentals(row.ticker)}
            title="View Fundamentals"
            style={{
              padding: '3px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)',
              color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer',
              fontSize: '0.6rem', fontWeight: 700
            }}
          >
            Info
          </button>
        </div>
      </td>
    </tr>
  );
}

export const ScreenerTableRow = memo(ScreenerTableRowComponent);
export default ScreenerTableRow;
