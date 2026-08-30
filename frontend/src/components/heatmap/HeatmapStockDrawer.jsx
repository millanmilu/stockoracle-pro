import React from 'react';
import { 
  X, LineChart, BookOpen, ShoppingCart, TrendingUp, TrendingDown, 
  Sparkles, ShieldAlert, CheckCircle2, ChevronRight, Activity, Percent
} from 'lucide-react';
import useStore from '../../store/useStore';

export default function HeatmapStockDrawer({ stock, onClose }) {
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);
  const addToast = useStore((s) => s.addToast);

  if (!stock) return null;

  const handleOpenChart = () => {
    setSelectedSymbol(stock.ticker);
    setActiveView('Live Chart');
    onClose();
  };

  const handleOpenFundamentals = () => {
    setSelectedSymbol(stock.ticker);
    setActiveView('Research');
    onClose();
  };

  const handleQuickPaperTrade = (side) => {
    // Quick notification & navigation to Paper Trading
    setSelectedSymbol(stock.ticker);
    if (addToast) {
      addToast({
        type: 'info',
        title: `Paper Trade — ${stock.ticker}`,
        message: `Prepared ${side} order for ${stock.ticker} at ₹${stock.price?.toFixed(2) || '—'}`,
      });
    }
    setActiveView('Paper Trading');
    onClose();
  };

  const isPositive = (stock.change_pct ?? stock.change_1d_pct ?? 0) >= 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: 420,
        background: 'linear-gradient(180deg, #0B0F19 0%, #111827 100%)',
        borderLeft: '1px solid rgba(99, 102, 241, 0.25)',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        background: 'rgba(15, 23, 42, 0.6)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#F8FAFC',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {stock.ticker}
            </h2>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818CF8',
            }}>
              {stock.sector}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: '0.8rem' }}>
            {stock.name}
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94A3B8',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.12)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.06)'}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Real-time Price Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>LTP / Close</span>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#F8FAFC',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              ₹{stock.price ? stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
            borderRadius: 8,
            padding: '6px 12px',
          }}>
            {isPositive ? <TrendingUp size={16} color="#10B981" /> : <TrendingDown size={16} color="#F43F5E" />}
            <span style={{
              fontSize: '0.92rem',
              fontWeight: 800,
              color: isPositive ? '#34D399' : '#F87171',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {isPositive ? '+' : ''}{(stock.change_pct ?? stock.change_1d_pct ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Returns Matrix */}
        <div>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Performance Returns
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
            {[
              { label: '1D', val: stock.change_1d_pct ?? stock.change_pct },
              { label: '1W', val: stock.change_1w_pct },
              { label: '1M', val: stock.change_1m_pct },
              { label: '1Y', val: stock.change_1y_pct },
            ].map((r) => {
              const pos = (r.val ?? 0) >= 0;
              return (
                <div key={r.label} style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 10,
                  padding: '10px 8px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{r.label}</div>
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: pos ? '#34D399' : '#F87171',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginTop: 2,
                  }}>
                    {r.val != null ? `${pos ? '+' : ''}${r.val.toFixed(1)}%` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical & Momentum Indicators */}
        <div>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Technical & Momentum
          </span>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 8,
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>RSI (14)</span>
              <div style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: stock.rsi_14 > 70 ? '#C084FC' : (stock.rsi_14 < 30 ? '#38BDF8' : '#F8FAFC'),
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {(stock.rsi_14 || 50).toFixed(1)}
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>20D Volume Surge</span>
              <div style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: stock.volume_ratio_20d > 1.5 ? '#FB923C' : '#F8FAFC',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {(stock.volume_ratio_20d || 1).toFixed(2)}x
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Dist to 52W High</span>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#F87171', fontFamily: 'JetBrains Mono, monospace' }}>
                {(stock.distance_52w_high_pct || 0).toFixed(1)}%
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Dist to 52W Low</span>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#34D399', fontFamily: 'JetBrains Mono, monospace' }}>
                +{(stock.distance_52w_low_pct || 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Valuation Multiples */}
        <div>
          <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Valuation Multiples
          </span>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 8,
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>P/E Ratio</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {stock.pe_ratio ? stock.pe_ratio.toFixed(1) : '—'}
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>P/B Ratio</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                {stock.pb_ratio ? stock.pb_ratio.toFixed(1) : '—'}
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>ROCE %</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34D399', fontFamily: 'JetBrains Mono, monospace' }}>
                {stock.roce_pct ? `${stock.roce_pct.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Quant Score Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 14,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} color="#818CF8" />
            <div>
              <span style={{ fontSize: '0.72rem', color: '#A5B4FC', fontWeight: 700 }}>AI Quant Consensus</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF' }}>
                {stock.ai_signal || 'NEUTRAL'}
              </div>
            </div>
          </div>

          <div style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#818CF8',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {(stock.ai_consensus_score || 50).toFixed(0)}/100
          </div>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={handleOpenChart}
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
              border: 'none',
              borderRadius: 10,
              padding: '11px 16px',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <LineChart size={16} />
            <span>Open Chart</span>
          </button>

          <button
            onClick={handleOpenFundamentals}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 10,
              padding: '11px 16px',
              color: '#F8FAFC',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.14)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
          >
            <BookOpen size={16} />
            <span>Fundamentals</span>
          </button>
        </div>

        {/* Paper Trade Button */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => handleQuickPaperTrade('BUY')}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#10B981',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <ShoppingCart size={15} />
            <span>Paper Buy</span>
          </button>

          <button
            onClick={() => handleQuickPaperTrade('SELL')}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#F43F5E',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <ShoppingCart size={15} />
            <span>Paper Sell</span>
          </button>
        </div>
      </div>
    </div>
  );
}
