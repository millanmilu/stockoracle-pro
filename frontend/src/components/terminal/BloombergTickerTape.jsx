import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { TrendingUp, TrendingDown } from 'lucide-react';

const DEFAULT_INDICES = [
  { symbol: 'NIFTY 50', price: 24852.4, change_pct: 0.42 },
  { symbol: 'SENSEX', price: 81340.2, change_pct: 0.38 },
  { symbol: 'BANK NIFTY', price: 53210.5, change_pct: 0.65 },
  { symbol: 'RELIANCE', price: 1317.0, change_pct: 0.36 },
  { symbol: 'TCS', price: 2296.2, change_pct: 0.53 },
  { symbol: 'HDFCBANK', price: 1642.5, change_pct: 0.85 },
  { symbol: 'INFY', price: 1845.0, change_pct: -0.42 },
  { symbol: 'ICICIBANK', price: 1198.0, change_pct: 1.12 },
  { symbol: 'SBIN', price: 824.5, change_pct: 0.74 },
  { symbol: 'BHARTIARTL', price: 1542.0, change_pct: 1.35 },
  { symbol: 'ITC', price: 495.2, change_pct: -0.15 },
  { symbol: 'WIPRO', price: 512.0, change_pct: 0.28 },
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
    const interval = setInterval(fetchTape, 25000);
    return () => clearInterval(interval);
  }, []);

  // Duplicate the list for seamless infinite loop
  const tapeItems = [...indices, ...indices];

  return (
    <div style={{
      height: '26px',
      background: '#03050c',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 40,
      userSelect: 'none'
    }}>
      <style>{`
        @keyframes ticker-marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .ticker-marquee-track {
          display: flex;
          align-items: center;
          white-space: nowrap;
          will-change: transform;
          animation: ticker-marquee 40s linear infinite;
        }
        .ticker-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Infinite running track */}
      <div className="ticker-marquee-track">
        {tapeItems.map((item, idx) => {
          const price = Number(item.price || 0);
          const changePct = Number(item.change_pct || 0);
          const isUp = changePct >= 0;
          return (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 16px',
                fontSize: '0.7rem',
                fontFamily: 'JetBrains Mono, monospace',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>{item.symbol}</span>
              <span style={{ fontWeight: 700, color: '#F1F5F9' }}>
                ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: isUp ? '#10B981' : '#EF4444',
                fontWeight: 700,
                fontSize: '0.64rem'
              }}>
                {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {isUp ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
