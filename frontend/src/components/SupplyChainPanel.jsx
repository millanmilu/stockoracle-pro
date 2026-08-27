import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';

// ── Correlation Badge ─────────────────────────────────────────────────────────
function CorrBadge({ corr }) {
  const abs = Math.abs(corr);
  const color = abs >= 0.7 ? '#6366F1' : abs >= 0.4 ? '#F59E0B' : '#6B7280';
  const label = abs >= 0.7 ? 'Strong' : abs >= 0.4 ? 'Moderate' : 'Weak';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: Math.max(6, abs * 40), height: 6, background: color,
        borderRadius: 3, transition: 'width 0.6s ease' }} />
      <span style={{ fontSize: '0.72rem', color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
        {corr >= 0 ? '+' : ''}{corr.toFixed(3)}
      </span>
      <span style={{ fontSize: '0.68rem', color: '#4B5563' }}>({label})</span>
    </div>
  );
}

// ── Network Graph (SVG-based) ─────────────────────────────────────────────────
function NetworkGraph({ center, upstream, downstream, onNodeClick }) {
  const W = 700, H = 380;
  const CX = W / 2, CY = H / 2;

  // Positions: center, upstream left arc, downstream right arc
  const upPositions = upstream.map((_, i) => {
    const angle = (-60 + (120 / Math.max(upstream.length - 1, 1)) * i) * (Math.PI / 180);
    const r = 160;
    return { x: CX - r * Math.cos(angle + Math.PI / 2), y: CY + r * Math.sin(angle) - 40 };
  });

  const downPositions = downstream.map((_, i) => {
    const angle = (-60 + (120 / Math.max(downstream.length - 1, 1)) * i) * (Math.PI / 180);
    const r = 160;
    return { x: CX + r * Math.cos(angle + Math.PI / 2), y: CY + r * Math.sin(angle) - 40 };
  });

  const NodeCircle = ({ x, y, item, color, isCenter }) => {
    const [hov, setHov] = useState(false);
    const r = isCenter ? 36 : 28;
    const changeColor = (item.change_pct ?? 0) >= 0 ? '#10B981' : '#F43F5E';

    return (
      <g
        onClick={() => !isCenter && onNodeClick(item.ticker || center)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ cursor: isCenter ? 'default' : 'pointer', transition: 'all 0.2s' }}
      >
        {/* Glow ring on hover */}
        {hov && <circle cx={x} cy={y} r={r + 8} fill={`${color}20`} />}
        {/* Node circle */}
        <circle cx={x} cy={y} r={r} fill={`${color}18`} stroke={color} strokeWidth={isCenter ? 2.5 : 1.5} />
        {/* Ticker */}
        <text x={x} y={y - (isCenter ? 4 : 3)} textAnchor="middle" fontSize={isCenter ? 13 : 10}
          fontWeight="800" fill={color} fontFamily="'JetBrains Mono', monospace">
          {item.ticker || center}
        </text>
        {/* Price change */}
        {!isCenter && item.change_pct != null && (
          <text x={x} y={y + 11} textAnchor="middle" fontSize={8}
            fontWeight="700" fill={changeColor} fontFamily="'JetBrains Mono', monospace">
            {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(1)}%
          </text>
        )}
        {isCenter && (
          <text x={x} y={y + 14} textAnchor="middle" fontSize={10}
            fill="#9CA3AF" fontFamily="Inter">
            ★ Focus
          </text>
        )}
      </g>
    );
  };

  const EdgeLine = ({ x1, y1, x2, y2, corr, color }) => {
    const abs = Math.abs(corr);
    const strokeW = 0.5 + abs * 2.5;
    return (
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={`${color}60`} strokeWidth={strokeW}
        strokeDasharray={abs < 0.3 ? '4 4' : 'none'} />
    );
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
        {/* Background */}
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0C1022" />
            <stop offset="100%" stopColor="#04050E" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} rx={16} fill="url(#bgGrad)" />

        {/* "Upstream" label */}
        <text x={80} y={30} fontSize={10} fill="#4B5563" fontFamily="Inter" fontWeight="600">
          ← UPSTREAM (Suppliers)
        </text>
        <text x={W - 160} y={30} fontSize={10} fill="#4B5563" fontFamily="Inter" fontWeight="600">
          DOWNSTREAM (Customers) →
        </text>

        {/* Edges from center to upstream */}
        {upstream.map((item, i) => (
          <EdgeLine key={`up-${i}`}
            x1={CX} y1={CY}
            x2={upPositions[i]?.x ?? CX} y2={upPositions[i]?.y ?? CY}
            corr={item.correlation ?? 0} color="#8B5CF6" />
        ))}

        {/* Edges from center to downstream */}
        {downstream.map((item, i) => (
          <EdgeLine key={`down-${i}`}
            x1={CX} y1={CY}
            x2={downPositions[i]?.x ?? CX} y2={downPositions[i]?.y ?? CY}
            corr={item.correlation ?? 0} color="#06B6D4" />
        ))}

        {/* Upstream nodes */}
        {upstream.map((item, i) => (
          <NodeCircle key={`up-node-${i}`}
            x={upPositions[i]?.x ?? 0} y={upPositions[i]?.y ?? 0}
            item={item} color="#8B5CF6" isCenter={false} />
        ))}

        {/* Downstream nodes */}
        {downstream.map((item, i) => (
          <NodeCircle key={`down-node-${i}`}
            x={downPositions[i]?.x ?? 0} y={downPositions[i]?.y ?? 0}
            item={item} color="#06B6D4" isCenter={false} />
        ))}

        {/* Center node */}
        <NodeCircle x={CX} y={CY} item={{ ticker: center }} color="#6366F1" isCenter={true} />

        {/* Legend */}
        <circle cx={20} cy={H - 16} r={5} fill="none" stroke="#8B5CF6" strokeWidth={1.5} />
        <text x={30} y={H - 12} fontSize={9} fill="#6B7280" fontFamily="Inter">Upstream</text>
        <circle cx={95} cy={H - 16} r={5} fill="none" stroke="#06B6D4" strokeWidth={1.5} />
        <text x={105} y={H - 12} fontSize={9} fill="#6B7280" fontFamily="Inter">Downstream</text>
        <text x={165} y={H - 12} fontSize={9} fill="#4B5563" fontFamily="Inter">— line thickness = correlation strength</text>
      </svg>
    </div>
  );
}

// ── Correlation Table ─────────────────────────────────────────────────────────
function CorrelationTable({ upstream, downstream, onSelect }) {
  const all = [
    ...upstream.map(i => ({ ...i, direction: 'Upstream' })),
    ...downstream.map(i => ({ ...i, direction: 'Downstream' })),
  ].sort((a, b) => Math.abs(b.correlation ?? 0) - Math.abs(a.correlation ?? 0));

  return (
    <table className="screener-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Company</th>
          <th>Direction</th>
          <th>Relationship</th>
          <th>Price</th>
          <th>Change%</th>
          <th>Correlation</th>
          <th>Impact</th>
        </tr>
      </thead>
      <tbody>
        {all.map(item => {
          const changeUp = (item.change_pct ?? 0) >= 0;
          const impactColor = item.impact_score >= 70 ? '#6366F1' : item.impact_score >= 40 ? '#F59E0B' : '#6B7280';
          return (
            <tr key={item.ticker} onClick={() => onSelect(item.ticker)} style={{ cursor: 'pointer' }}>
              <td><span className="ticker-badge">{item.ticker}</span></td>
              <td style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>{item.name}</td>
              <td>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600,
                  color: item.direction === 'Upstream' ? '#8B5CF6' : '#06B6D4',
                  background: item.direction === 'Upstream' ? '#8B5CF618' : '#06B6D418',
                  border: `1px solid ${item.direction === 'Upstream' ? '#8B5CF640' : '#06B6D440'}`,
                  borderRadius: 6, padding: '2px 8px'
                }}>{item.direction}</span>
              </td>
              <td style={{ color: '#6B7280', fontSize: '0.78rem', maxWidth: 200,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.relationship}
              </td>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>
                {item.price ? `₹${item.price.toFixed(2)}` : '—'}
              </td>
              <td style={{
                color: changeUp ? '#10B981' : '#F43F5E', fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem'
              }}>
                {item.change_pct != null ? `${changeUp ? '+' : ''}${item.change_pct.toFixed(2)}%` : '—'}
              </td>
              <td><CorrBadge corr={item.correlation ?? 0} /></td>
              <td>
                <span style={{ fontWeight: 800, color: impactColor, fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.impact_score}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function SupplyChainPanel() {
  const { selectedSymbol, setSelectedSymbol, setActiveView } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((ticker) => {
    setLoading(true);
    setError(null);
    api.get(`/api/stock/${ticker}/supply-chain`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load supply chain data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(selectedSymbol); }, [selectedSymbol, load]);

  const handleNodeClick = (ticker) => {
    setSelectedSymbol(ticker);
    setActiveView('Live Chart');
  };

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spinner" />
      <p style={{ color: '#6366F1', fontSize: '0.9rem' }}>
        Building supply chain network & computing price correlations…
      </p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#F43F5E', marginBottom: 12 }}>{error}</div>
      <button onClick={() => load(selectedSymbol)} style={{
        background: '#6366F1', color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600
      }}>Retry</button>
    </div>
  );

  const { ticker, sector, upstream = [], downstream = [] } = data || {};

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>
            Supply Chain Analysis
          </h2>
          <p style={{ margin: '3px 0 0', color: '#94A3B8', fontSize: '0.8rem' }}>
            <span style={{ color: '#F0F0FF', fontWeight: 700 }}>{ticker}</span>
            {' · '}
            <span style={{ color: '#6366F1' }}>{sector}</span>
            {' · Upstream suppliers & downstream customers with price correlations'}
          </p>
        </div>
        <button onClick={() => load(selectedSymbol)} style={{
          background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
          color: '#8B5CF6', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 600
        }}>↺ Refresh</button>
      </div>

      {/* Network Graph */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1022, #10142a)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16,
        padding: 16, overflow: 'hidden'
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 8 }}>
          Network Graph — Click a node to view its chart
        </div>
        <NetworkGraph
          center={ticker}
          upstream={upstream}
          downstream={downstream}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { color: '#8B5CF6', label: 'Upstream (Suppliers / Peers)' },
          { color: '#6366F1', label: `${ticker} (Focus Stock)` },
          { color: '#06B6D4', label: 'Downstream (Customers / Partners)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: l.color, borderRadius: '50%' }} />
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Correlation Table */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1022, #10142a)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Price Correlation Table — sorted by correlation strength
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <CorrelationTable
            upstream={upstream}
            downstream={downstream}
            onSelect={(t) => { setSelectedSymbol(t); setActiveView('Live Chart'); }}
          />
        </div>
      </div>

      <div style={{ fontSize: '0.72rem', color: '#374151', textAlign: 'center' }}>
        ⚠️ Supply chain relationships are based on publicly available annual reports and sector analysis.
        Correlations computed on 3-month rolling daily returns. Not financial advice.
      </div>
    </div>
  );
}
