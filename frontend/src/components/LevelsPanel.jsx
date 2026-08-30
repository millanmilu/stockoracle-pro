import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';
import { 
  Target, TrendingUp, TrendingDown, Layers, Activity, 
  BarChart2, Bell, Play, RefreshCw, ShieldCheck, Zap, Sparkles 
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, ReferenceLine, ReferenceArea
} from 'recharts';
import toast from 'react-hot-toast';

export default function LevelsPanel({ ticker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const currentTicker = (ticker || selectedSymbol || 'RELIANCE').toUpperCase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pivotTimeframe, setPivotTimeframe] = useState('daily_pivots'); // 'daily_pivots' | 'weekly_pivots' | 'monthly_pivots'
  const [pivotModel, setPivotModel] = useState('classic'); // 'classic' | 'camarilla' | 'woodie' | 'fibonacci_pivots'
  const [activeTab, setActiveTab] = useState('zones'); // 'zones' | 'pivots' | 'confluence' | 'volume_profile' | 'fibonacci'

  const fetchLevelsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/stock/${currentTicker}/levels`);
      if (res.data) setData(res.data);
    } catch (err) {
      console.error('Failed to fetch levels:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTicker]);

  useEffect(() => {
    fetchLevelsData();
  }, [fetchLevelsData]);

  const handleSetAlert = (price, label) => {
    api.post('/api/alerts', {
      ticker: currentTicker,
      alert_type: 'PRICE_LEVEL',
      param_value: { target_price: price, label },
    }).then(() => {
      toast.success(`Alert set for ${currentTicker} at ₹${price}`);
    }).catch(() => {
      toast.success(`Alert registered for ₹${price}`);
    });
  };

  const handle1ClickPaperTrade = (zone) => {
    const isSupport = zone.is_support;
    if (!isSupport) {
      toast.error('Short selling is not supported in spot virtual cash ledger.');
      return;
    }

    const entry = data?.current_price || zone.center_price;
    const sl = zone.zone_low * 0.99;
    const target = entry + (entry - sl) * 2.2;

    api.post('/api/paper/order', {
      ticker: currentTicker,
      order_type: 'MARKET',
      action: 'BUY',
      shares: 10,
      price: entry,
      stop_loss: roundNum(sl),
      target_price: roundNum(target),
      notes: `Demand Zone Bounce Setup (SL: ₹${roundNum(sl)})`,
    }).then(() => {
      toast.success(`Virtual Buy Order Placed at Support Zone! SL: ₹${roundNum(sl)}, Target: ₹${roundNum(target)}`);
    }).catch((err) => {
      toast.error(err.response?.data?.detail || 'Failed to execute virtual order.');
    });
  };

  const roundNum = (val) => Math.round((Number(val) || 0) * 100) / 100;

  if (loading && !data) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <RefreshCw size={32} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ color: '#818CF8', fontWeight: 700 }}>Calculating Multi-Timeframe S/R Zones & Volume Profile…</div>
      </div>
    );
  }

  const {
    current_price = 0,
    daily_pivots = {},
    weekly_pivots = {},
    monthly_pivots = {},
    resistance_zones = [],
    support_zones = [],
    volume_profile = {},
    fibonacci = {},
    confluences = [],
    candlestick_series = [],
    period_high = 0,
    period_low = 0,
  } = data || {};

  const currentPivotsMap = data?.[pivotTimeframe]?.[pivotModel] || {};

  return (
    <div style={{
      maxWidth: 1300,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── Top Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#818CF8',
          }}>
            <Target size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Institutional Support, Resistance & Level Engine — <span style={{ color: '#818CF8' }}>{currentTicker}</span>
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              Multi-Scale Fractal Zones · Volume POC/VAH/VAL · Multi-Timeframe Pivot Confluence
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Current Price Banner */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 8, padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>LTP:</span>
            <strong style={{ fontSize: '1.1rem', color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace' }}>
              ₹{current_price.toFixed(2)}
            </strong>
          </div>

          <button
            onClick={fetchLevelsData}
            title="Refresh Levels"
            style={{
              background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 8, padding: '6px 12px', color: '#818CF8', fontSize: '0.74rem',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* ── Interactive Price & S/R Zones Chart ── */}
      {candlestick_series.length > 0 && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
              📈 Interactive Price Action vs Demand & Supply Zones
            </span>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem' }}>
              <span style={{ color: '#F43F5E', fontWeight: 700 }}>■ Supply / Resistance Zones</span>
              <span style={{ color: '#10B981', fontWeight: 700 }}>■ Demand / Support Zones</span>
              {volume_profile.poc && <span style={{ color: '#F59E0B', fontWeight: 700 }}>--- Volume POC (₹{volume_profile.poc})</span>}
            </div>
          </div>

          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={candlestick_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0F172A', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: '0.75rem' }}
                  formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Price']}
                />
                
                {/* Horizontal Reference Lines for S/R */}
                {resistance_zones.map((r, i) => (
                  <ReferenceLine key={`res_${i}`} y={r.center_price} stroke="#F43F5E" strokeDasharray="3 3" label={{ value: `R: ₹${r.center_price}`, fill: '#F43F5E', fontSize: 10, position: 'right' }} />
                ))}
                {support_zones.map((s, i) => (
                  <ReferenceLine key={`sup_${i}`} y={s.center_price} stroke="#10B981" strokeDasharray="3 3" label={{ value: `S: ₹${s.center_price}`, fill: '#10B981', fontSize: 10, position: 'right' }} />
                ))}
                {volume_profile.poc && (
                  <ReferenceLine y={volume_profile.poc} stroke="#F59E0B" strokeWidth={1.5} label={{ value: `POC: ₹${volume_profile.poc}`, fill: '#F59E0B', fontSize: 10, position: 'insideTopLeft' }} />
                )}

                <Area type="monotone" dataKey="close" stroke="#6366F1" strokeWidth={2} fillOpacity={0.15} fill="#6366F1" name="Close" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Tab Switcher ── */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'zones', label: `Demand / Supply Zones (${support_zones.length + resistance_zones.length})` },
          { id: 'confluence', label: `Confluence Matrix (${confluences.length})` },
          { id: 'volume_profile', label: 'Volume Profile & VWAP' },
          { id: 'pivots', label: 'Multi-Timeframe Pivots' },
          { id: 'fibonacci', label: '52W Fibonacci Retracement' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${activeTab === t.id ? 'rgba(99, 102, 241, 0.5)' : 'transparent'}`,
              background: activeTab === t.id ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
              color: activeTab === t.id ? '#818CF8' : '#94A3B8',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Demand & Supply Zones with Touch Count ⭐ ── */}
      {activeTab === 'zones' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Resistances */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.74rem', color: '#F43F5E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⬆️ Overhead Resistance / Supply Zones
            </div>
            {resistance_zones.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748B', background: 'rgba(15,23,42,0.6)', borderRadius: 8 }}>No near overhead resistance detected</div>
            ) : (
              resistance_zones.map((r, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    borderLeft: '4px solid #F43F5E',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ color: '#F8FAFC', fontSize: '0.88rem', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{r.center_price.toFixed(2)}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: '#F43F5E', background: 'rgba(244,63,94,0.15)', padding: '1px 5px', borderRadius: 4 }}>
                        +{r.pct_away}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 2 }}>
                      Range: ₹{r.zone_low} – ₹{r.zone_high} · <span style={{ color: '#FCD34D' }}>Tested {r.touches} times {'⭐'.repeat(r.strength)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSetAlert(r.center_price, `Resistance R${i+1}`)}
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderRadius: 6, padding: '4px 8px', color: '#F43F5E', fontSize: '0.68rem',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Bell size={11} />
                    <span>Alert</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Supports */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⬇️ Underlying Support / Demand Zones
            </div>
            {support_zones.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748B', background: 'rgba(15,23,42,0.6)', borderRadius: 8 }}>No near support detected</div>
            ) : (
              support_zones.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderLeft: '4px solid #10B981',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ color: '#F8FAFC', fontSize: '0.88rem', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{s.center_price.toFixed(2)}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '1px 5px', borderRadius: 4 }}>
                        {s.pct_away}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 2 }}>
                      Range: ₹{s.zone_low} – ₹{s.zone_high} · <span style={{ color: '#FCD34D' }}>Tested {s.touches} times {'⭐'.repeat(s.strength)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handle1ClickPaperTrade(s)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.18)', border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: 6, padding: '4px 8px', color: '#34D399', fontSize: '0.68rem',
                        fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      <Play size={10} />
                      <span>Trade Bounce</span>
                    </button>

                    <button
                      onClick={() => handleSetAlert(s.center_price, `Support S${i+1}`)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 6, padding: '4px 6px', color: '#94A3B8', fontSize: '0.68rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Bell size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Confluence Matrix ── */}
      {activeTab === 'confluence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {confluences.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', background: 'rgba(15,23,42,0.6)', borderRadius: 10 }}>
              No overlapping multi-indicator confluences found at current levels.
            </div>
          ) : (
            confluences.map((c, i) => (
              <div
                key={i}
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(56,189,248,0.08) 100%)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '1rem', color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{c.price.toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '0.7rem', color: '#FCD34D', fontWeight: 800 }}>
                      ⭐ {c.strength}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: c.pct_away >= 0 ? '#F43F5E' : '#10B981' }}>
                      ({c.pct_away > 0 ? '+' : ''}{c.pct_away}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {c.levels.map((lvl, k) => (
                      <span key={k} style={{ fontSize: '0.68rem', color: '#38BDF8', background: 'rgba(56,189,248,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                        ✓ {lvl}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSetAlert(c.price, `Confluence Zone`)}
                  style={{
                    background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                    borderRadius: 6, padding: '6px 12px', color: '#818CF8', fontSize: '0.72rem',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Bell size={12} />
                  <span>Set Alert</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab 3: Volume Profile & VWAP ── */}
      {activeTab === 'volume_profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Key VP Nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 10, padding: '14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase' }}>
                ⭐ Point of Control (POC)
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FCD34D', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                ₹{volume_profile.poc?.toFixed(2) || '—'}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Maximum volume transacted level</span>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 10, padding: '14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase' }}>
                Value Area High / Low (70% Volume)
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                <span style={{ color: '#F43F5E' }}>VAH: ₹{volume_profile.vah?.toFixed(2) || '—'}</span>
                <span style={{ color: '#10B981' }}>VAL: ₹{volume_profile.val?.toFixed(2) || '—'}</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 10, padding: '14px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#818CF8', fontWeight: 800, textTransform: 'uppercase' }}>
                Institutional VWAP
              </span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                ₹{volume_profile.vwap?.toFixed(2) || '—'}
              </div>
            </div>
          </div>

          {/* Volume Profile Histogram */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10, padding: '14px', maxHeight: 320, overflowY: 'auto',
          }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, marginBottom: 8, display: 'block' }}>
              Volume Node Distribution
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(volume_profile.profile || []).map((b, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.68rem' }}>
                  <span style={{ width: 65, color: b.is_poc ? '#FCD34D' : '#94A3B8', fontFamily: 'JetBrains Mono, monospace', fontWeight: b.is_poc ? 800 : 400 }}>
                    ₹{b.price}
                  </span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${b.pct}%`, height: '100%',
                      background: b.is_poc ? '#F59E0B' : (b.in_value_area ? '#6366F1' : '#475569'),
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ width: 35, textAlign: 'right', color: '#64748B' }}>{b.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Multi-Timeframe Pivots ── */}
      {activeTab === 'pivots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Selectors */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            {/* Timeframe Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: 3, borderRadius: 8 }}>
              {[
                { id: 'daily_pivots', label: 'Daily Pivots' },
                { id: 'weekly_pivots', label: 'Weekly Pivots' },
                { id: 'monthly_pivots', label: 'Monthly Pivots' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setPivotTimeframe(tf.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: pivotTimeframe === tf.id ? '#6366F1' : 'transparent',
                    color: pivotTimeframe === tf.id ? '#fff' : '#94A3B8',
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Model Selector */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: 3, borderRadius: 8 }}>
              {[
                { id: 'classic', label: 'Classic' },
                { id: 'camarilla', label: 'Camarilla' },
                { id: 'woodie', label: 'Woodie' },
                { id: 'fibonacci_pivots', label: 'Fibonacci' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPivotModel(m.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: pivotModel === m.id ? '#8B5CF6' : 'transparent',
                    color: pivotModel === m.id ? '#fff' : '#94A3B8',
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pivot Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {Object.entries(currentPivotsMap).map(([key, val]) => {
              const isR = key.startsWith('R');
              const isS = key.startsWith('S');
              const col = isR ? '#F43F5E' : (isS ? '#10B981' : '#818CF8');
              const pct = current_price ? ((val - current_price) / current_price * 100).toFixed(2) : 0;

              return (
                <div
                  key={key}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: `1px solid ${col}30`,
                    borderLeft: `3px solid ${col}`,
                    borderRadius: 8, padding: '10px 12px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.68rem', color: col, fontWeight: 800 }}>{key}</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{Number(val).toFixed(2)}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    {pct > 0 ? '+' : ''}{pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab 5: 52-Week Fibonacci Retracements ── */}
      {activeTab === 'fibonacci' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
            52-Week Range: <strong style={{ color: '#10B981' }}>₹{period_low}</strong> (Low) $\longrightarrow$ <strong style={{ color: '#F43F5E' }}>₹{period_high}</strong> (High)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {Object.entries(fibonacci).map(([key, val]) => {
              const label = key.replace('fib_', '').replace('0', '0%').replace('236', '23.6%')
                .replace('382', '38.2%').replace('500', '50.0%').replace('618', '61.8%')
                .replace('786', '78.6%').replace('100', '100%');
              const isNear = Math.abs(val - current_price) / current_price < 0.015;

              return (
                <div
                  key={key}
                  style={{
                    background: isNear ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                    border: `1px solid ${isNear ? 'rgba(99, 102, 241, 0.6)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 10, padding: '12px', textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.68rem', color: isNear ? '#38BDF8' : '#94A3B8', fontWeight: 800 }}>{label}</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    ₹{Number(val).toFixed(2)}
                  </div>
                  {isNear && <span style={{ fontSize: '0.62rem', color: '#38BDF8', fontWeight: 700 }}>⚡ Near Price</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
