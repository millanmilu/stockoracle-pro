import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { BarChart2, RefreshCw, X, Shield, Target } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';

export default function VolumeProfileModal({ ticker: propTicker, onClose }) {
  const { selectedSymbol } = useStore();
  const ticker = propTicker || selectedSymbol;
  const [vpData, setVpData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVP = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/stock/${ticker}/volume-profile`);
        setVpData(data);
      } catch (err) {
        console.error('Failed to load volume profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVP();
  }, [ticker]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(4, 6, 14, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20
    }} onClick={onClose}>
      <div style={{
        background: '#0C1022', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16,
        width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={20} color="#818CF8" />
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#F0F0FF', fontWeight: 800 }}>
              Volume Profile (VPVR) & Institutional POC — {ticker}
            </h2>
          </div>
          {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#818CF8' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 10px' }} />
            <div>Calculating Point of Control (POC) and Value Area...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', padding: '12px 14px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>POINT OF CONTROL (POC)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>₹{vpData?.poc_price}</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px 14px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>VALUE AREA HIGH (VAH)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>₹{vpData?.vah_price}</div>
              </div>
              <div style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.2)', padding: '12px 14px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>VALUE AREA LOW (VAL)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#EF5350', fontFamily: 'JetBrains Mono, monospace' }}>₹{vpData?.val_price}</div>
              </div>
            </div>

            {/* Horizontal Volume Profile Chart */}
            <div style={{ height: 320, width: '100%', background: '#060913', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vpData?.profile || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" stroke="#64748B" fontSize={10} />
                  <YAxis dataKey="price_level" type="category" stroke="#64748B" fontSize={10} width={60} />
                  <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF' }} />
                  <Bar dataKey="buy_volume" stackId="a" fill="#10B981" name="Buyer Volume" />
                  <Bar dataKey="sell_volume" stackId="a" fill="#EF5350" name="Seller Volume" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
