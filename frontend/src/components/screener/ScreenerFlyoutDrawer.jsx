import React, { useState, useEffect } from 'react';
import { 
  X, ExternalLink, TrendingUp, TrendingDown, DollarSign, 
  ShieldAlert, Bell, Sparkles, Activity, Layers, ArrowUpRight
} from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ScreenerFlyoutDrawer({ 
  stock, 
  onClose, 
  onNavigateChart, 
  onNavigateFundamentals 
}) {
  const [stockInfo, setStockInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paperShares, setPaperShares] = useState(10);
  const [paperLoading, setPaperLoading] = useState(false);

  useEffect(() => {
    if (!stock?.ticker) return;
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/stock/${stock.ticker}/info`);
        setStockInfo(data);
      } catch (e) {
        // Fallback to row stock data
        setStockInfo(stock);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [stock?.ticker]);

  if (!stock) return null;

  const isPositive = (stock.change_1d_pct ?? stock.change ?? 0) >= 0;
  const currPrice = stockInfo?.current_price || stockInfo?.price || stock.close_price || stock.price || 0;

  const handleQuickPaperTrade = async (side = 'BUY') => {
    setPaperLoading(true);
    try {
      await api.post('/api/paper/order', {
        ticker: stock.ticker,
        side: side,
        quantity: parseInt(paperShares, 10),
        order_type: 'MARKET',
      });
      toast.success(`Paper ${side} order placed for ${paperShares} shares of ${stock.ticker}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Paper trade failed');
    } finally {
      setPaperLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    try {
      await api.post('/api/alerts', {
        ticker: stock.ticker,
        target_price: currPrice * 1.05,
        condition: 'ABOVE',
      });
      toast.success(`Alert set for ${stock.ticker} at ₹${(currPrice * 1.05).toFixed(2)} (+5%)`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create alert');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '420px',
      maxWidth: '90vw',
      background: '#090D1C',
      borderLeft: '1px solid rgba(99,102,241,0.3)',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.7)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideLeft 0.2s ease-out'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0C1124'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF' }}>{stock.ticker}</span>
            <span style={{
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(99,102,241,0.15)', color: '#818CF8',
              fontSize: '0.65rem', fontWeight: 700
            }}>
              {stock.market_cap_cat || 'NSE'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
            {stock.name || stockInfo?.companyName || stock.ticker} • {stock.sector}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#94A3B8', cursor: 'pointer', padding: '6px', display: 'flex'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Price & 1D Change Card */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Current Price</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F1F5F9', fontFamily: 'JetBrains Mono, monospace' }}>
              ₹{Number(currPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: 8,
            background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: isPositive ? '#10B981' : '#EF4444',
            border: isPositive ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 800,
            fontSize: '0.9rem'
          }}>
            {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {isPositive ? '+' : ''}{(stock.change_1d_pct ?? stock.change ?? 0).toFixed(2)}%
          </div>
        </div>

        {/* AI Signal Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 10,
          padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: '#A855F7', fontWeight: 800 }}>
              <Sparkles size={14} /> AI QUANT SIGNAL
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 12,
              background: '#10B981', color: '#FFF', fontSize: '0.68rem', fontWeight: 800
            }}>
              {stock.ai_signal || 'BUY'} ({stock.ai_consensus_score || 78}/100)
            </span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#CBD5E1', lineHeight: '1.4' }}>
            Strong multi-factor alignment: ROCE at <strong>{stock.roce_pct || 18}%</strong> with RSI(14) at <strong>{stock.rsi_14 || 52}</strong> indicating favorable risk/reward setup.
          </div>
        </div>

        {/* Fundamental & Technical Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>ROCE %</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10B981', marginTop: 2 }}>{stock.roce_pct != null ? `${stock.roce_pct}%` : '—'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>P/E RATIO</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8', marginTop: 2 }}>{stock.pe_ratio != null ? `${stock.pe_ratio}x` : '—'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>DEBT / EQUITY</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F59E0B', marginTop: 2 }}>{stock.debt_to_equity != null ? stock.debt_to_equity : '—'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>RSI (14-DAY)</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#818CF8', marginTop: 2 }}>{stock.rsi_14 != null ? stock.rsi_14 : '—'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>20D VOL SURGE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#A855F7', marginTop: 2 }}>{stock.volume_ratio_20d != null ? `${stock.volume_ratio_20d}x` : '—'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>MARKET CAP</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#CBD5E1', marginTop: 2 }}>₹{Number(stock.market_cap_cr || 0).toLocaleString('en-IN')} Cr</div>
          </div>
        </div>

        {/* Quick Paper Trade Section */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: '0.74rem', color: '#F1F5F9', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={14} color="#10B981" /> Quick Paper Trade
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Qty:</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={paperShares}
              onChange={(e) => setPaperShares(e.target.value)}
              style={{
                width: '70px',
                background: '#060913',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                padding: '4px 8px',
                color: '#F1F5F9',
                fontSize: '0.78rem'
              }}
            />
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              ≈ ₹{(currPrice * (parseInt(paperShares, 10) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={() => handleQuickPaperTrade('BUY')}
              disabled={paperLoading}
              style={{
                padding: '7px 12px',
                borderRadius: 6,
                background: '#10B981',
                color: '#FFF',
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s'
              }}
            >
              Buy Market
            </button>
            <button
              onClick={() => handleQuickPaperTrade('SELL')}
              disabled={paperLoading}
              style={{
                padding: '7px 12px',
                borderRadius: 6,
                background: '#EF4444',
                color: '#FFF',
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s'
              }}
            >
              Sell Market
            </button>
          </div>
        </div>

        {/* Alert Action */}
        <button
          onClick={handleCreateAlert}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#F59E0B',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <Bell size={14} /> Set Price Alert (+5% Target)
        </button>

      </div>

      {/* Bottom Nav Links */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: '#0C1124',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10
      }}>
        <button
          onClick={() => onNavigateChart(stock.ticker)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.3)',
            color: '#38BDF8',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Open Chart <ArrowUpRight size={13} />
        </button>
        <button
          onClick={() => onNavigateFundamentals(stock.ticker)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#818CF8',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Fundamentals <ArrowUpRight size={13} />
        </button>
      </div>

    </div>
  );
}
