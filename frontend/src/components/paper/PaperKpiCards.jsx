import React from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Trophy, Percent, ShieldAlert, Sparkles, PieChart, Activity
} from 'lucide-react';

export default function PaperKpiCards({ account, positions = [], history = [], analytics = {} }) {
  const cash = account?.cash_balance ?? 1000000.0;
  const startBalance = account?.starting_balance ?? 1000000.0;

  // Invested & Market Values from enriched positions
  const investedVal = positions.reduce((sum, p) => sum + (p.invested_value ?? (p.shares * p.avg_buy_price)), 0);
  const marketVal = positions.reduce((sum, p) => sum + (p.market_value ?? (p.shares * (p.current_price || p.avg_buy_price))), 0);
  const totalNetWorth = cash + marketVal;
  const totalReturnPct = startBalance > 0 ? (((totalNetWorth - startBalance) / startBalance) * 100) : 0.0;

  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealized_pnl ?? (((p.current_price || p.avg_buy_price) - p.avg_buy_price) * p.shares)), 0);
  const totalUnrealizedPct = investedVal > 0 ? ((totalUnrealizedPnl / investedVal) * 100) : 0.0;

  const closedTrades = history.filter((h) => h.action === 'SELL');
  const winCount = closedTrades.filter((h) => (h.realized_pnl || 0) > 0).length;
  const totalRealizedPnl = closedTrades.reduce((sum, h) => sum + (h.realized_pnl || 0), 0);
  const winRate = closedTrades.length > 0 ? ((winCount / closedTrades.length) * 100).toFixed(1) : '0.0';

  const isNetWorthProfit = totalReturnPct >= 0;
  const isUnrealizedProfit = totalUnrealizedPnl >= 0;
  const isRealizedProfit = totalRealizedPnl >= 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 16,
      marginBottom: 20,
    }}>
      {/* 1. Available Cash */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Available Virtual Cash
          </span>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#38BDF8',
          }}>
            <Wallet size={15} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 4 }}>
            Invested in Assets: <strong style={{ color: '#F8FAFC' }}>₹{investedVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
          </div>
        </div>
      </div>

      {/* 2. Portfolio Net Worth */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: '1px solid rgba(129, 140, 248, 0.25)',
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Portfolio Net Worth
          </span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: isNetWorthProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${isNetWorthProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            borderRadius: 6, padding: '2px 6px',
            fontSize: '0.7rem', fontWeight: 800,
            color: isNetWorthProfit ? '#34D399' : '#F87171',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {isNetWorthProfit ? '+' : ''}{totalReturnPct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
            ₹{totalNetWorth.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 4 }}>
            Holding Market Value: <strong style={{ color: '#818CF8' }}>₹{marketVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
          </div>
        </div>
      </div>

      {/* 3. Open Unrealized P&L */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: `1px solid ${isUnrealizedProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Open Unrealized P&L
          </span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: isUnrealizedProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${isUnrealizedProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            borderRadius: 6, padding: '2px 6px',
            fontSize: '0.7rem', fontWeight: 800,
            color: isUnrealizedProfit ? '#34D399' : '#F87171',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {isUnrealizedProfit ? '+' : ''}{totalUnrealizedPct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800,
            color: isUnrealizedProfit ? '#10B981' : '#F43F5E',
            fontFamily: 'JetBrains Mono, monospace',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {isUnrealizedProfit ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
            <span>₹{Math.abs(totalUnrealizedPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 4 }}>
            Active Positions: <strong style={{ color: '#F8FAFC' }}>{positions.length} holdings</strong>
          </div>
        </div>
      </div>

      {/* 4. Win Rate & Realized P&L */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Trade Win Rate & Realized P&L
          </span>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10B981',
          }}>
            <Trophy size={15} />
          </div>
        </div>
        <div>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800,
            color: Number(winRate) >= 50 ? '#10B981' : '#F59E0B',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {winRate}% <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>({winCount}/{closedTrades.length} won)</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: isRealizedProfit ? '#34D399' : '#F87171', marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            Realized P&L: {isRealizedProfit ? '+' : ''}₹{totalRealizedPnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
