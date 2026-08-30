import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import { 
  Zap, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, 
  Layers, Play, LineChart, Award, Target, HelpCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PatternsPanel({ ticker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);
  const setActiveView = useStore((s) => s.setActiveView);

  const currentTicker = (ticker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1Y');
  const [activeTab, setActiveTab] = useState('detections'); // 'detections' | 'backtest' | 'confluence'

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/stock/${currentTicker}/patterns?period=${period}&lookback=45`);
      if (res.data) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTicker, period]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const handle1ClickPaperTrade = (p) => {
    if (p.direction !== 'bullish') {
      toast.error('Spot virtual trading only supports BUY orders.');
      return;
    }

    api.post('/api/paper/order', {
      ticker: currentTicker,
      order_type: 'MARKET',
      action: 'BUY',
      shares: 10,
      price: p.entry_price || p.close,
      stop_loss: p.stop_loss,
      target_price: p.target_price,
      notes: `Pattern: ${p.pattern} (${p.confidence}% Conf)`,
    }).then(() => {
      toast.success(`Virtual Buy Order Placed for ${currentTicker} on ${p.pattern} Setup! SL: ₹${p.stop_loss}, Target: ₹${p.target_price}`);
    }).catch((err) => {
      toast.error(err.response?.data?.detail || 'Failed to execute pattern order.');
    });
  };

  const handleOpenChart = () => {
    setSelectedSymbol(currentTicker);
    setActiveView('Live Chart');
  };

  if (loading && !data) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <RefreshCw size={32} color="#8B5CF6" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ color: '#C084FC', fontWeight: 700 }}>Scanning Institutional Candlestick & Structural Patterns…</div>
      </div>
    );
  }

  const {
    patterns = [],
    backtest_stats = {},
    confluence_setups = [],
    bias_score = 50,
    bias_label = 'Neutral',
    bullish = 0,
    bearish = 0,
    neutral = 0,
  } = data || {};

  const biasColor = bias_score >= 60 ? '#10B981' : (bias_score <= 40 ? '#F43F5E' : '#F59E0B');

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── Top Header & Controls ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        borderRadius: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#C084FC',
          }}>
            <Zap size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              AI Pattern Recognition & Backtest Engine — <span style={{ color: '#C084FC' }}>{currentTicker}</span>
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              Deterministic Signal Quality · True Historical Forward Returns · Confluence Filters
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Period Selector */}
          <div style={{ display: 'flex', gap: 3, background: 'rgba(15, 23, 42, 0.6)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
            {['1M', '3M', '6M', '1Y'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  background: period === p ? 'linear-gradient(135deg,#8B5CF6,#6366F1)' : 'transparent',
                  border: 'none', color: period === p ? '#fff' : '#94A3B8',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={fetchPatterns}
            title="Refresh Analysis"
            style={{
              background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 8, padding: '6px 12px', color: '#C084FC', fontSize: '0.74rem',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Scan</span>
          </button>
        </div>
      </div>

      {/* ── Pattern Bias & Overview Card ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
      }}>
        {/* Bias Score Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
            Overall Pattern Bias
          </span>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, color: biasColor,
            fontFamily: 'JetBrains Mono, monospace', marginTop: 4,
          }}>
            {bias_label} ({bias_score}/100)
          </div>
          <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${bias_score}%`, height: '100%', background: biasColor, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        {/* Signals Distribution */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
            Detected Formations ({patterns.length})
          </span>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.85rem', fontWeight: 800 }}>
            <span style={{ color: '#10B981' }}>🟢 {bullish} Bullish</span>
            <span style={{ color: '#F43F5E' }}>🔴 {bearish} Bearish</span>
            <span style={{ color: '#F59E0B' }}>🟡 {neutral} Neutral</span>
          </div>
        </div>

        {/* Confluence Formations */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <span style={{ fontSize: '0.68rem', color: '#C084FC', fontWeight: 700, textTransform: 'uppercase' }}>
            High-Probability Confluences
          </span>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8',
            fontFamily: 'JetBrains Mono, monospace', marginTop: 4,
          }}>
            {confluence_setups.length} Setups
          </div>
          <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
            Volume Surge + RSI + Support alignments
          </span>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
        {[
          { id: 'detections', label: `Detections & Entry/SL Levels (${patterns.length})` },
          { id: 'confluence', label: `Multi-Signal Confluence Setups (${confluence_setups.length})` },
          { id: 'backtest', label: 'Per-Stock Historical Backtest Performance' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${activeTab === t.id ? 'rgba(168, 85, 247, 0.5)' : 'transparent'}`,
              background: activeTab === t.id ? 'rgba(168, 85, 247, 0.18)' : 'transparent',
              color: activeTab === t.id ? '#C084FC' : '#94A3B8',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Detections & Actions ── */}
      {activeTab === 'detections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {patterns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No candlestick patterns detected in the selected timeframe</div>
          ) : (
            patterns.map((p) => {
              const isBull = p.direction === 'bullish';
              const col = isBull ? '#10B981' : (p.direction === 'bearish' ? '#F43F5E' : '#F59E0B');

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: `1px solid ${col}30`,
                    borderLeft: `4px solid ${col}`,
                    borderRadius: 10, padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: col, fontSize: '0.92rem' }}>{p.pattern}</strong>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800,
                        color: '#C084FC', background: 'rgba(168,85,247,0.12)',
                        border: '1px solid rgba(168,85,247,0.3)',
                        padding: '2px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace'
                      }}>
                        {p.confidence}% Deterministic Conf
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 4 }}>
                      Date: <strong style={{ color: '#F8FAFC' }}>{p.date}</strong> &nbsp;|&nbsp;
                      Entry: <strong style={{ color: '#F8FAFC' }}>₹{p.entry_price?.toFixed(2)}</strong> &nbsp;|&nbsp;
                      Stop Loss: <strong style={{ color: '#F43F5E' }}>₹{p.stop_loss}</strong> &nbsp;|&nbsp;
                      Target (2:1): <strong style={{ color: '#10B981' }}>₹{p.target_price}</strong>
                    </div>

                    {p.confluences?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {p.confluences.map((c, i) => (
                          <span key={i} style={{ fontSize: '0.65rem', color: '#38BDF8', background: 'rgba(56,189,248,0.12)', padding: '2px 6px', borderRadius: 4 }}>
                            ⚡ {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => handle1ClickPaperTrade(p)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: 8, padding: '7px 12px',
                        color: '#34D399', fontSize: '0.72rem', fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Play size={12} />
                      <span>Paper Trade</span>
                    </button>

                    <button
                      onClick={handleOpenChart}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8, padding: '7px 10px',
                        color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <LineChart size={12} />
                      <span>Chart</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab 2: High Confluence Setups ── */}
      {activeTab === 'confluence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {confluence_setups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No confluence setups found in this period</div>
          ) : (
            confluence_setups.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)',
                  border: '1px solid rgba(168,85,247,0.35)',
                  borderRadius: 10, padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: p.direction === 'bullish' ? '#34D399' : '#F87171', fontSize: '0.95rem' }}>
                    {p.pattern}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#FCD34D', fontWeight: 800 }}>
                    ⭐ {p.confluence_level} ({p.confidence}% Conf)
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: 4 }}>
                  Date: {p.date} · Entry: ₹{p.entry_price} · Stop Loss: ₹{p.stop_loss} · Target: ₹{p.target_price}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {p.confluences.map((c, i) => (
                    <span key={i} style={{ fontSize: '0.68rem', color: '#38BDF8', background: 'rgba(56,189,248,0.18)', padding: '2px 8px', borderRadius: 4 }}>
                      ✓ {c}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab 3: Real Per-Stock Historical Backtest Performance ── */}
      {activeTab === 'backtest' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12, padding: '16px',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: 12 }}>
            Empirical 1-Year Forward-Return Backtest on <strong style={{ color: '#F8FAFC' }}>{currentTicker}</strong> (Measured across all completed historical occurrences):
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px' }}>Pattern</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Occurrences</th>
                  <th style={{ padding: '8px 10px' }}>True Win Rate</th>
                  <th style={{ padding: '8px 10px' }}>Avg 5D Return</th>
                  <th style={{ padding: '8px 10px' }}>Profit Factor</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(backtest_stats).map((st) => (
                  <tr key={st.pattern} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px', fontWeight: 800, color: '#F8FAFC' }}>{st.pattern}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800,
                        color: st.direction === 'bullish' ? '#34D399' : '#F87171'
                      }}>
                        {st.direction.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'JetBrains Mono, monospace' }}>{st.completed_trades} trades</td>
                    <td style={{ padding: '10px', fontWeight: 800, color: st.win_rate >= 65 ? '#10B981' : '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                      {st.win_rate}%
                    </td>
                    <td style={{ padding: '10px', fontWeight: 800, color: st.avg_5d_return_pct >= 0 ? '#34D399' : '#F87171', fontFamily: 'JetBrains Mono, monospace' }}>
                      {st.avg_5d_return_pct >= 0 ? '+' : ''}{st.avg_5d_return_pct}%
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'JetBrains Mono, monospace' }}>{st.profit_factor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
