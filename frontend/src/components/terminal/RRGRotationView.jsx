import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { Activity, RefreshCw, Compass, ArrowUpRight, Zap } from 'lucide-react';
import useStore from '../../store/useStore';

export default function RRGRotationView() {
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);
  const [rrgData, setRrgData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRRG = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/market/rrg-sectors');
      setRrgData(data);
    } catch (err) {
      console.error('Failed to load RRG sector rotation', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRRG();
  }, []);

  const sectors = rrgData?.sectors || [];

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280, margin: '0 auto' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={18} color="#818CF8" />
            Relative Rotation Graphs (RRG) — Sector Rotation Matrix
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            JdK RS-Ratio vs RS-Momentum tracking institutional capital flows relative to NIFTY 50.
          </p>
        </div>
        <button onClick={fetchRRG} style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600 }}>
          <RefreshCw size={12} /> Refresh Rotation
        </button>
      </div>

      {/* 4-Quadrant Visual Scatter Chart */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 16,
        padding: '20px',
        position: 'relative',
        height: 440
      }}>
        {/* Quadrant Labels Overlay */}
        <div style={{ position: 'absolute', top: 25, right: 30, color: '#10B981', fontWeight: 800, fontSize: '0.82rem', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 4 }}>
          LEADING (Outperforming + Accelerating) ↗
        </div>
        <div style={{ position: 'absolute', top: 25, left: 30, color: '#38BDF8', fontWeight: 800, fontSize: '0.82rem', background: 'rgba(56,189,248,0.1)', padding: '3px 8px', borderRadius: 4 }}>
          ↖ IMPROVING (Recovering + Gaining Momentum)
        </div>
        <div style={{ position: 'absolute', bottom: 35, left: 30, color: '#EF5350', fontWeight: 800, fontSize: '0.82rem', background: 'rgba(239,83,80,0.1)', padding: '3px 8px', borderRadius: 4 }}>
          ↙ LAGGING (Underperforming + Decelerating)
        </div>
        <div style={{ position: 'absolute', bottom: 35, right: 30, color: '#F59E0B', fontWeight: 800, fontSize: '0.82rem', background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: 4 }}>
          WEAKENING (Outperforming but Losing Momentum) ↘
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 30, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="rs_ratio"
              name="RS-Ratio"
              domain={[96, 106]}
              stroke="#64748B"
              label={{ value: 'JdK RS-Ratio (Relative Strength vs NIFTY 50)', position: 'bottom', fill: '#94A3B8', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="rs_momentum"
              name="RS-Momentum"
              domain={[96, 106]}
              stroke="#64748B"
              label={{ value: 'JdK RS-Momentum', angle: -90, position: 'left', fill: '#94A3B8', fontSize: 11 }}
            />
            {/* Center Crosshair at (100, 100) */}
            <ReferenceLine x={100} stroke="#818CF8" strokeWidth={1.5} strokeDasharray="4 4" />
            <ReferenceLine y={100} stroke="#818CF8" strokeWidth={1.5} strokeDasharray="4 4" />

            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null;
                const pt = payload[0].payload;
                return (
                  <div style={{ background: '#0F172A', border: `1px solid ${pt.color}`, padding: '8px 12px', borderRadius: 8, color: '#F0F0FF', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 800, color: pt.color }}>{pt.symbol}</div>
                    <div>{pt.name}</div>
                    <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                      RS-Ratio: <strong>{pt.rs_ratio}</strong> | RS-Mom: <strong>{pt.rs_momentum}</strong>
                    </div>
                    <div style={{ marginTop: 2, fontSize: '0.72rem', color: '#94A3B8' }}>Top Leader: {pt.lead_stock}</div>
                  </div>
                );
              }}
            />

            <Scatter data={sectors}>
              {sectors.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Sector Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {sectors.map((s) => (
          <div
            key={s.symbol}
            style={{
              background: '#0C1022',
              border: `1px solid ${s.color}40`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#F0F0FF', fontSize: '0.9rem' }}>{s.symbol}</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{s.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                Lead Stock: <strong style={{ color: '#818CF8' }}>{s.lead_stock}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: `${s.color}20`, color: s.color
              }}>
                {s.quadrant}
              </span>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#CBD5E1', marginTop: 6 }}>
                Ratio: {s.rs_ratio}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
