import React from 'react';
import { PieChart, TrendingUp, TrendingDown, Award, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function PaperPortfolioBreakdown({ analytics = {}, positions = [] }) {
  const {
    profit_factor = 1.0,
    best_trade = 0.0,
    worst_trade = 0.0,
    win_count = 0,
    loss_count = 0,
    total_trades = 0,
    sector_allocation = [],
  } = analytics;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: 16,
      marginTop: 20,
    }}>
      {/* 1. Sector / Holding Allocation Breakdown */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 16,
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <PieChart size={18} color="#818CF8" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC' }}>
            Portfolio Sector Allocation
          </h3>
        </div>

        {sector_allocation.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8', fontSize: '0.8rem' }}>
            No open stock holdings to allocate. Buy stocks to view sector exposure!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sector_allocation.map((item, idx) => {
              const colors = ['#6366F1', '#10B981', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6'];
              const col = colors[idx % colors.length];

              return (
                <div key={item.sector} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                    <span style={{ color: '#F8FAFC', fontWeight: 700 }}>{item.sector}</span>
                    <span style={{ color: col, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({item.pct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, width: '100%', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: col, borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Trading Performance & Edge Analytics */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 16,
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <ShieldCheck size={18} color="#10B981" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC' }}>
            Quantitative Risk & Edge Metrics
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Profit Factor */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Profit Factor</span>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: profit_factor >= 1.5 ? '#10B981' : (profit_factor >= 1.0 ? '#38BDF8' : '#F43F5E'),
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 2,
            }}>
              {profit_factor.toFixed(2)}
            </div>
          </div>

          {/* Total Trades */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Win / Loss Ratio</span>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: '#F8FAFC',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 2,
            }}>
              <span style={{ color: '#10B981' }}>{win_count}W</span> : <span style={{ color: '#F43F5E' }}>{loss_count}L</span>
            </div>
          </div>

          {/* Best Trade */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Award size={13} color="#10B981" />
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Best Trade</span>
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#34D399',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 2,
            }}>
              +₹{best_trade.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Worst Trade */}
          <div style={{
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={13} color="#F43F5E" />
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Worst Trade</span>
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#F87171',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 2,
            }}>
              {worst_trade < 0 ? '-' : ''}₹{Math.abs(worst_trade).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
