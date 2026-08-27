import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

const DEFAULT_INDICES = [
  { symbol: 'NIFTY 50', price: 24852.4, change_pct: 0.42 },
  { symbol: 'SENSEX', price: 81340.2, change_pct: 0.38 },
  { symbol: 'BANK NIFTY', price: 53210.5, change_pct: 0.65 },
  { symbol: 'INDIA VIX', price: 12.84, change_pct: -3.20 },
  { symbol: 'USD / INR', price: 83.92, change_pct: -0.05 },
  { symbol: 'BRENT CRUDE', price: 78.45, change_pct: -1.15 },
];

export default function BloombergTickerTape() {
  const [indices, setIndices] = useState(DEFAULT_INDICES);

  useEffect(() => {
    const fetchTape = async () => {
      try {
        const { data } = await api.get('/api/terminal/ticker-tape');
        if (Array.isArray(data.indices) && data.indices.length > 0) {
          // Merge with defaults to avoid null/zero prices
          const merged = data.indices.map((item, i) => {
            const def = DEFAULT_INDICES.find(d => d.symbol === item.symbol) || DEFAULT_INDICES[i] || {};
            return {
              ...def,
              ...item,
              price: item.price != null && item.price > 0 ? item.price : def.price,
              change_pct: item.change_pct != null ? item.change_pct : def.change_pct,
            };
          });
          setIndices(merged);
        } else {
          setIndices(DEFAULT_INDICES);
        }
      } catch {
        setIndices(DEFAULT_INDICES);
      }
    };
    fetchTape();
    const interval = setInterval(fetchTape, 20000); // 20s refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      height: '30px',
      background: '#04060E',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      padding: '0 12px',
      gap: '20px',
      fontSize: '0.74rem',
      fontFamily: 'JetBrains Mono, monospace',
      zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#818CF8', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <Activity size={12} color="#10B981" /> NSE/GLOBAL TAPE
      </div>

      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        {indices.map((item, idx) => {
          const price = Number(item.price || 0);
          const changePct = Number(item.change_pct || 0);
          const isUp = changePct >= 0;
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#E2E8F0' }}>
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>{item.symbol}</span>
              <span style={{ fontWeight: 700 }}>
                {price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                color: isUp ? '#10B981' : '#EF5350',
                fontWeight: 700,
                fontSize: '0.68rem'
              }}>
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {isUp ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
