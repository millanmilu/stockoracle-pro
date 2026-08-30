import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import { 
  Wallet, TrendingUp, RotateCcw, ShieldAlert, Sparkles, Plus, 
  BookOpen, Activity, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

import PaperKpiCards from './paper/PaperKpiCards';
import PaperOrderCard from './paper/PaperOrderCard';
import PaperPositionsTable from './paper/PaperPositionsTable';
import PaperTradeHistory from './paper/PaperTradeHistory';
import PaperPortfolioBreakdown from './paper/PaperPortfolioBreakdown';
import PaperSellModal from './paper/PaperSellModal';

export default function PaperTradingView() {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);

  const [account, setAccount] = useState({ cash_balance: 1000000.0, starting_balance: 1000000.0 });
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSellPosition, setSelectedSellPosition] = useState(null);

  // Fetch Paper Trading Data (Account, Positions, History, Analytics)
  const fetchPaperData = useCallback(async () => {
    try {
      const [accRes, posRes, histRes, anaRes] = await Promise.all([
        api.get('/api/paper/account').catch(() => ({ data: { cash_balance: 1000000.0, starting_balance: 1000000.0 } })),
        api.get('/api/paper/positions').catch(() => ({ data: [] })),
        api.get('/api/paper/history?limit=100').catch(() => ({ data: [] })),
        api.get('/api/paper/analytics').catch(() => ({ data: {} })),
      ]);

      if (accRes.data) setAccount(accRes.data);
      if (Array.isArray(posRes.data)) setPositions(posRes.data);
      if (Array.isArray(histRes.data)) setHistory(histRes.data);
      if (anaRes.data) setAnalytics(anaRes.data);
    } catch (err) {
      console.error('Failed to fetch paper trading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaperData();
    const timer = setInterval(fetchPaperData, 10000); // 10s auto-refresh
    return () => clearInterval(timer);
  }, [fetchPaperData]);

  // Full Close Position
  const handleCloseFullPosition = async (posId, posTicker) => {
    try {
      let exitPrice = 100.0;
      try {
        const liveRes = await api.get(`/api/stock/${posTicker}/info`, { timeout: 4000 });
        if (liveRes.data?.current_price) exitPrice = liveRes.data.current_price;
      } catch {
        const pos = positions.find(p => p.id === posId);
        if (pos?.current_price) exitPrice = pos.current_price;
      }

      await api.post('/api/paper/close', { position_id: posId, current_price: exitPrice });
      toast.success(`Closed full position for ${posTicker} @ ₹${exitPrice.toFixed(2)}`);
      fetchPaperData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close position.');
    }
  };

  // Reset Account back to ₹10 Lakhs
  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset your Paper Trading account back to ₹10,00,000? All virtual positions and order history will be cleared.")) {
      try {
        await api.post('/api/paper/reset');
        toast.success("Account reset to ₹10,00,000 successfully!");
        fetchPaperData();
      } catch {
        toast.error("Failed to reset account.");
      }
    }
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1800px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      minHeight: 'calc(100vh - 120px)',
      boxSizing: 'border-box',
    }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818CF8',
          }}>
            <Wallet size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #818CF8 0%, #C084FC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}>
                1-Click Paper Trading Simulator
              </h1>
              <span style={{
                fontSize: '0.68rem',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818CF8',
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 700,
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}>
                Virtual ₹10 Lakhs Ledger
              </span>
            </div>
            <p style={{ margin: '2px 0 0', color: '#94A3B8', fontSize: '0.74rem' }}>
              Execute realistic risk-free trades, test AI models, and track your quantitative edge with live mark-to-market valuations.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={fetchPaperData}
            title="Refresh Ledger"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '7px 12px',
              color: '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#F43F5E',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset to ₹10L</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <PaperKpiCards
        account={account}
        positions={positions}
        history={history}
        analytics={analytics}
      />

      {/* Main Row: Order Execution Card + Positions Table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 380px) 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: 1-Click Order Form */}
        <PaperOrderCard
          selectedSymbol={selectedSymbol}
          onOrderPlaced={fetchPaperData}
          availableCash={account.cash_balance}
        />

        {/* Right: Active Positions Table */}
        <PaperPositionsTable
          positions={positions}
          onOpenSellModal={setSelectedSellPosition}
          onCloseFullPosition={handleCloseFullPosition}
        />
      </div>

      {/* Trade Execution Journal (History Table) */}
      <PaperTradeHistory history={history} />

      {/* Portfolio Sector Allocation & Quantitative Risk Breakdown */}
      <PaperPortfolioBreakdown
        analytics={analytics}
        positions={positions}
      />

      {/* Partial Sell Modal */}
      {selectedSellPosition && (
        <PaperSellModal
          position={selectedSellPosition}
          onClose={() => setSelectedSellPosition(null)}
          onSellExecuted={fetchPaperData}
        />
      )}
    </div>
  );
}
