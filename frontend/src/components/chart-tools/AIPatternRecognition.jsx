import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, TrendingUp, TrendingDown, Target, ShieldCheck, 
  Layers, ArrowUpRight, ArrowDownRight, Award, Play, ExternalLink, RefreshCw 
} from 'lucide-react';
import api from '../../utils/api';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

export default function AIPatternRecognition({ symbol, candles = [], onApplyMarkers }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);
  const currentSymbol = (symbol || selectedSymbol || 'RELIANCE').toUpperCase();

  const [patternData, setPatternData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [activeTab, setActiveTab] = useState('recent'); // 'recent' | 'stats' | 'confluence'

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/stock/${currentSymbol}/patterns?period=1Y&lookback=45`);
      if (res.data) {
        setPatternData(res.data);
        if (onApplyMarkers && res.data.chart_markers) {
          onApplyMarkers(res.data.chart_markers);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pattern recognition:', err);
    } finally {
      setLoading(false);
    }
  }, [currentSymbol, onApplyMarkers]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const handle1ClickPaperTrade = (p) => {
    const isBull = p.direction === 'bullish';
    if (!isBull) {
      toast.error('Short selling is not supported in spot cash virtual account.');
      return;
    }

    // Direct 1-click execution or notification
    api.post('/api/paper/order', {
      ticker: currentSymbol,
      order_type: 'MARKET',
      action: 'BUY',
      shares: 10,
      price: p.entry_price || p.close,
      stop_loss: p.stop_loss,
      target_price: p.target_price,
      notes: `Pattern: ${p.pattern} (${p.confidence}% Conf)`,
    }).then(() => {
      toast.success(`Virtual Buy Order Placed for ${currentSymbol} on ${p.pattern} Setup! SL: ₹${p.stop_loss}, Target: ₹${p.target_price}`);
    }).catch((err) => {
      toast.error(err.response?.data?.detail || 'Failed to place pattern trade.');
    });
  };

  const {
    patterns = [],
    backtest_stats = {},
    confluence_setups = [],
    bias_score = 50,
    bias_label = 'Neutral',
    bullish = 0,
    bearish = 0,
  } = patternData || {};

  const biasColor = bias_score >= 60 ? '#10B981' : (bias_score <= 40 ? '#F43F5E' : '#F59E0B');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '12px',
      background: 'rgba(9, 12, 24, 0.95)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      borderRadius: 12,
      color: '#F8FAFC',
      fontSize: '0.78rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(168, 85, 247, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#C084FC',
          }}>
            <Zap size={14} />
          </div>
          <strong style={{ fontSize: '0.85rem', color: '#F8FAFC' }}>AI Pattern Recognition</strong>
          <span style={{ fontSize: '0.66rem', color: '#A855F7', background: 'rgba(168,85,247,0.12)', padding: '1px 6px', borderRadius: 4 }}>
            {currentSymbol}
          </span>
        </div>

        <button
          onClick={fetchPatterns}
          title="Refresh Patterns"
          style={{
            background: 'transparent', border: 'none',
            color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Pattern Bias Indicator */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 8, padding: '8px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <span style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>45D Pattern Bias</span>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: biasColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {bias_label} ({bias_score}/100)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: '0.68rem', fontWeight: 700 }}>
          <span style={{ color: '#10B981' }}>🟢 {bullish} Bullish</span>
          <span style={{ color: '#F43F5E' }}>🔴 {bearish} Bearish</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: 2, borderRadius: 6 }}>
        {[
          { id: 'recent', label: `Detections (${patterns.length})` },
          { id: 'confluence', label: `Confluence (${confluence_setups.length})` },
          { id: 'stats', label: 'Real Backtest Stats' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, padding: '4px 6px', borderRadius: 4,
              border: 'none', fontSize: '0.68rem', fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === t.id ? '#8B5CF6' : 'transparent',
              color: activeTab === t.id ? '#FFFFFF' : '#94A3B8',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Recent Detected Patterns List */}
      {activeTab === 'recent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {patterns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#64748B' }}>No patterns detected in recent candles</div>
          ) : (
            patterns.slice(0, 15).map((p) => {
              const isBull = p.direction === 'bullish';
              const col = isBull ? '#10B981' : (p.direction === 'bearish' ? '#F43F5E' : '#F59E0B');

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: `1px solid ${col}30`,
                    borderLeft: `3px solid ${col}`,
                    borderRadius: 6, padding: '8px 10px',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: col, fontSize: '0.78rem' }}>{p.pattern}</strong>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 800,
                      color: '#C084FC', background: 'rgba(168,85,247,0.12)',
                      padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {p.confidence}% Conf
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8' }}>
                    <span>{p.date} · Entry: ₹{p.entry_price?.toFixed(1)}</span>
                    <span>SL: ₹{p.stop_loss} | T: ₹{p.target_price}</span>
                  </div>

                  {/* Confluences */}
                  {p.confluences?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {p.confluences.map((c, i) => (
                        <span key={i} style={{ fontSize: '0.6rem', color: '#38BDF8', background: 'rgba(56,189,248,0.1)', padding: '1px 4px', borderRadius: 3 }}>
                          ⚡ {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 1-Click Action */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                    <button
                      onClick={() => handle1ClickPaperTrade(p)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 4, padding: '2px 8px',
                        color: '#34D399', fontSize: '0.65rem', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      <Play size={10} />
                      <span>1-Click Paper Trade</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: High Confluence Setups */}
      {activeTab === 'confluence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {confluence_setups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#64748B' }}>No multi-factor confluence patterns found</div>
          ) : (
            confluence_setups.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)',
                  border: '1px solid rgba(168,85,247,0.35)',
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: p.direction === 'bullish' ? '#34D399' : '#F87171' }}>
                    {p.pattern}
                  </strong>
                  <span style={{ fontSize: '0.65rem', color: '#FCD34D', fontWeight: 800 }}>
                    ⭐ {p.confluence_level}
                  </span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                  Date: {p.date} · Price: ₹{p.entry_price}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {p.confluences.map((c, i) => (
                    <span key={i} style={{ fontSize: '0.6rem', color: '#38BDF8', background: 'rgba(56,189,248,0.15)', padding: '2px 5px', borderRadius: 4 }}>
                      ✓ {c}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Real Per-Stock Backtest Stats Table */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.66rem', color: '#94A3B8', marginBottom: 2 }}>
            Historical 1-Year forward return stats on <strong style={{ color: '#F8FAFC' }}>{currentSymbol}</strong>:
          </div>
          {Object.values(backtest_stats).map((st) => (
            <div
              key={st.pattern}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6, padding: '6px 8px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ color: st.direction === 'bullish' ? '#34D399' : '#F87171', fontSize: '0.72rem' }}>
                  {st.pattern}
                </strong>
                <div style={{ color: '#64748B', fontSize: '0.62rem' }}>
                  {st.completed_trades} trades · Profit Factor: {st.profit_factor}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  color: st.win_rate >= 65 ? '#10B981' : '#F59E0B',
                  fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem',
                }}>
                  {st.win_rate}% Win
                </span>
                <div style={{ color: st.avg_5d_return_pct >= 0 ? '#34D399' : '#F87171', fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  {st.avg_5d_return_pct >= 0 ? '+' : ''}{st.avg_5d_return_pct}% (5D)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
