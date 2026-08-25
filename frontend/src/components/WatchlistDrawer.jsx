import React, { useState, useMemo } from 'react';
import useStore from '../store/useStore';
import { 
  Search, SlidersHorizontal, Settings, Plus, 
  ChevronRight, X, Maximize2, Minimize2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const WATCHLIST_PRESETS = {
  mywatchlist: [
    { symbol: 'TRIDENT',   name: 'Trident Ltd',          price: 24.34,   change: -0.84,  pct: -3.34, segment: 'NSE' },
    { symbol: 'PARAS',     name: 'Paras Defence',        price: 1377.50, change: 35.30,  pct: 2.63,  segment: 'NSE' },
    { symbol: 'JSL',       name: 'Jindal Stainless',     price: 737.85,  change: 2.45,   pct: 0.33,  segment: 'NSE' },
    { symbol: 'USHAMART',  name: 'Usha Martin',          price: 487.95,  change: -9.40,  pct: -1.89, segment: 'NSE' },
    { symbol: 'ONGC',      name: 'ONGC Corp',            price: 236.40,  change: -3.50,  pct: -1.46, segment: 'NSE' },
    { symbol: 'KALYANKJIL',name: 'Kalyan Jewellers',     price: 635.00,  change: -4.60,  pct: -0.72, segment: 'NSE FO' },
  ],
  nifty50: [
    { symbol: 'RELIANCE',   name: 'Reliance Industries', price: 2954.20, change: 18.50,  pct: 0.63,  segment: 'NSE' },
    { symbol: 'TCS',        name: 'Tata Consultancy',    price: 3940.10, change: -12.40, pct: -0.31, segment: 'NSE' },
    { symbol: 'HDFCBANK',   name: 'HDFC Bank Ltd',       price: 1912.45, change: 8.60,   pct: 0.45,  segment: 'NSE' },
    { symbol: 'INFY',       name: 'Infosys Ltd',         price: 1564.00, change: -6.20,  pct: -0.39, segment: 'NSE' },
    { symbol: 'ICICIBANK',  name: 'ICICI Bank Ltd',      price: 1388.90, change: 14.20,  pct: 1.03,  segment: 'NSE' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors',         price: 984.30,  change: 22.10,  pct: 2.30,  segment: 'NSE' },
    { symbol: 'SBIN',       name: 'State Bank of India', price: 852.10,  change: -2.30,  pct: -0.27, segment: 'NSE' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel',       price: 1884.00, change: 11.50,  pct: 0.61,  segment: 'NSE' },
    { symbol: 'ITC',        name: 'ITC Ltd',             price: 432.80,  change: 1.20,   pct: 0.28,  segment: 'NSE' },
  ],
  budget: [
    { symbol: 'IRFC',      name: 'Indian Railway Finance', price: 178.40, change: 4.20,  pct: 2.41, segment: 'NSE' },
    { symbol: 'RVNL',      name: 'Rail Vikas Nigam',       price: 520.10, change: -8.40, pct: -1.59, segment: 'NSE' },
    { symbol: 'BEL',       name: 'Bharat Electronics',     price: 295.60, change: 6.80,  pct: 2.35, segment: 'NSE' },
    { symbol: 'HAL',       name: 'Hindustan Aeronautics',  price: 4620.00,change: 45.00, pct: 0.98, segment: 'NSE' },
  ],
  later: [
    { symbol: 'ZOMATO',    name: 'Zomato Ltd',           price: 242.10,  change: 5.40,   pct: 2.28, segment: 'NSE' },
    { symbol: 'JIOFIN',    name: 'Jio Financial',        price: 324.50,  change: -1.10,  pct: -0.34, segment: 'NSE' },
    { symbol: 'PAYTM',     name: 'One97 Communications', price: 685.20,  change: 12.00,  pct: 1.78, segment: 'NSE' },
  ]
};

export default function WatchlistDrawer({ onClose }) {
  const { selectedSymbol, setSelectedSymbol, theme } = useStore();
  const [activeTab, setActiveTab] = useState('mywatchlist');
  const [filterQuery, setFilterQuery] = useState('');

  const isDark = theme !== 'light';

  const currentList = useMemo(() => {
    const list = WATCHLIST_PRESETS[activeTab] || WATCHLIST_PRESETS.mywatchlist;
    if (!filterQuery || !filterQuery.trim()) return list;
    const q = String(filterQuery || '').toUpperCase().trim();
    return list.filter(item => {
      const matchSymbol = item.symbol ? String(item.symbol).toUpperCase().includes(q) : false;
      const matchName = item.name ? String(item.name).toUpperCase().includes(q) : false;
      return matchSymbol || matchName;
    });
  }, [activeTab, filterQuery]);

  const tabs = [
    { id: 'mywatchlist', label: 'mywatchlist' },
    { id: 'nifty50',     label: 'NIFTY 50' },
    { id: 'budget',      label: 'BUDGET' },
    { id: 'later',       label: 'LATER' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className="watchlist-mobile-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 25,
        }}
      />
      <div className="watchlist-drawer-container" style={{
        width: 'min(85vw, 280px)',
        height: '100%',
        backgroundColor: isDark ? '#0A0D1A' : '#FFFFFF',
        borderRight: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        zIndex: 30,
      }}>
      {/* ── Top Header ── */}
      <div style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isDark ? '#F0F0FF' : '#0F172A' }}>
          Watchlist
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            title="Watchlist Settings"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94A3B8' : '#64748B', padding: 2 }}
          >
            <Settings size={14} />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              title="Close Watchlist"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94A3B8' : '#64748B', padding: 2 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs Bar (mywatchlist, BUDGET, LATER, +) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '2px',
        borderBottom: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 10px',
                border: 'none',
                background: 'none',
                color: isActive ? '#3B82F6' : (isDark ? '#94A3B8' : '#64748B'),
                fontSize: '0.74rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }}
            >
              {tab.label}
            </button>
          );
        })}
        <button
          onClick={() => toast.success('Custom Watchlist Created')}
          title="Add New Watchlist Tab"
          style={{
            background: 'none',
            border: 'none',
            color: '#3B82F6',
            padding: '6px 8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          +
        </button>
      </div>

      {/* ── Search & Filter in Watchlist ── */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: isDark ? '#121626' : '#F1F5F9',
          border: isDark ? '1px solid #232942' : '1px solid #CBD5E1',
          borderRadius: '6px',
          padding: '4px 8px',
          gap: '6px',
        }}>
          <Search size={12} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isDark ? '#F0F0FF' : '#0F172A',
              fontSize: '0.75rem',
              width: '100%',
            }}
          />
        </div>
        <button
          style={{
            background: isDark ? '#121626' : '#F1F5F9',
            border: isDark ? '1px solid #232942' : '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '5px',
            cursor: 'pointer',
            color: isDark ? '#94A3B8' : '#64748B',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SlidersHorizontal size={12} />
        </button>
      </div>

      {/* ── Stock List ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {currentList.map((stock) => {
          const isSelected = selectedSymbol === stock.symbol;
          const isUp = stock.change >= 0;
          return (
            <div
              key={stock.symbol}
              onClick={() => setSelectedSymbol(stock.symbol)}
              style={{
                padding: '9px 12px',
                borderBottom: isDark ? '1px solid #14192B' : '1px solid #F1F5F9',
                backgroundColor: isSelected ? (isDark ? 'rgba(59,130,246,0.14)' : '#EFF6FF') : 'transparent',
                borderLeft: isSelected ? '3px solid #3B82F6' : '3px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Left Symbol & Segment */}
              <div>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  color: isSelected ? '#3B82F6' : (isDark ? '#F0F0FF' : '#0F172A'),
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {stock.symbol}
                </div>
                <div style={{ fontSize: '0.64rem', color: isDark ? '#94A3B8' : '#64748B', marginTop: '1px' }}>
                  {stock.segment}
                </div>
              </div>

              {/* Right Price & Change */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  color: isUp ? '#10B981' : '#EF5350',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {isUp ? '▲' : '▼'}
                </div>
                <div style={{
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  color: isUp ? '#10B981' : '#EF5350',
                  marginTop: '1px',
                }}>
                  {isUp ? '+' : ''}{stock.change.toFixed(2)} ({isUp ? '+' : ''}{stock.pct.toFixed(2)}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Quick List Banner ── */}
      <div 
        onClick={() => toast.success('Option Chain Loaded')}
        style={{
          padding: '10px 14px',
          borderTop: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: '#3B82F6',
          fontSize: '0.72rem',
          fontWeight: 700,
          backgroundColor: isDark ? '#0A0D1A' : '#FAFAFA',
        }}
      >
        <span>OPTIONS QUICK LIST</span>
        <ChevronRight size={14} />
      </div>
    </div>
    </>
  );
}
