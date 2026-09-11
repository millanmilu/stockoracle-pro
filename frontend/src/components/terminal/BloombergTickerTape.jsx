import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

// No DEFAULT_INDICES — hardcoded prices must never be shown as if they were live market data.

export default function BloombergTickerTape() {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchTape = async () => {
      try {
        const { data } = await api.get('/api/terminal/ticker-tape');
        if (Array.isArray(data.indices) && data.indices.length > 0) {
          // Only accept entries that carry a real price (> 0) from the API.
          // Entries with status "STATIC" are reference values, not live — display them
          // with a visual indicator so users know they are not real-time.
          setIndices(data.indices);
          setError(false);
        } else {
          // Empty response means broker is offline; show unavailable notice.
          setIndices([]);
          setError(true);
        }
      } catch {
        setIndices([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTape();
    const interval = setInterval(fetchTape, 25000);
    return () => clearInterval(interval);
  }, []);

  // Duplicate the list for seamless infinite loop (only when we have real entries)
  const tapeItems = indices.length > 0 ? [...indices, ...indices] : [];

  if (loading) {
    return (
      <div style={{
        height: '26px',
        background: '#03050c',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 8,
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            height: 10,
            width: 80,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.06)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
      </div>
    );
  }

  if (error || indices.length === 0) {
    return (
      <div style={{
        height: '26px',
        background: '#03050c',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 6,
        fontSize: '0.68rem',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#64748B',
      }}>
        <AlertCircle size={11} />
        <span>Market data unavailable — broker connection required</span>
      </div>
    );
  }

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
          const isStatic = item.status === 'STATIC';
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
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                opacity: isStatic ? 0.6 : 1,
              }}
              title={isStatic ? 'Reference value — not real-time' : undefined}
            >
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>{item.symbol}</span>
              <span style={{ fontWeight: 700, color: isStatic ? '#64748B' : '#F1F5F9' }}>
                {price > 0
                  ? `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                  : '—'}
              </span>
              {price > 0 && (
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
              )}
              {isStatic && (
                <span style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 500 }}>REF</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

