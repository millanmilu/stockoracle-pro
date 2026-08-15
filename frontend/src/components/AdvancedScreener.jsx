import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import useStore from '../store/useStore';

const SECTORS = ['All', 'Banking', 'IT', 'Energy', 'FMCG', 'Telecom', 'Infrastructure', 'Auto', 'Pharma', 'Metals', 'Other'];
const SIGNALS = ['All', 'buy', 'hold', 'sell'];

const PRESETS = [
  { id: 'all', label: 'All Stocks', icon: '🌐' },
  { id: 'bullish', label: '🚀 Bullish Breakout', icon: '🚀' },
  { id: 'oversold', label: '💎 Oversold Bargains', icon: '💎' },
  { id: 'volume', label: '🔥 Volume Surge', icon: '🔥' },
  { id: 'momentum', label: '🎯 52W High Momentum', icon: '🎯' },
];

function SortHeader({ field, label, sortBy, sortDir, onClick }) {
  const active = sortBy === field;
  return (
    <th onClick={() => onClick(field)} style={{
      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      color: active ? '#6366F1' : '#6B7280',
      transition: 'color 0.2s'
    }}>
      {label}
      <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>
        {active ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
      </span>
    </th>
  );
}

function RsiBar({ rsi }) {
  if (rsi == null) return <span style={{ color: '#4B5563' }}>—</span>;
  const color = rsi < 35 ? '#F43F5E' : rsi > 70 ? '#10B981' : '#F59E0B';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 36, height: 6, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, rsi))}%`, height: '100%', background: color, borderRadius: 3,
          transition: 'width 0.6s ease'
        }} />
      </div>
      <span style={{ fontSize: '0.78rem', color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{rsi.toFixed(0)}</span>
    </div>
  );
}

function VolumeChip({ ratio }) {
  if (ratio == null) return <span style={{ color: '#4B5563' }}>—</span>;
  const isSpike = ratio >= 1.5;
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
      color: isSpike ? '#F59E0B' : '#6B7280',
      background: isSpike ? '#F59E0B18' : 'transparent',
      border: isSpike ? '1px solid #F59E0B40' : '1px solid transparent',
      borderRadius: 6, padding: '2px 6px'
    }}>
      {ratio.toFixed(2)}x {isSpike && '🔥'}
    </span>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.04)',
      border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
      color: active ? '#fff' : '#9CA3AF',
      borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
      fontSize: '0.78rem', fontWeight: active ? 700 : 500,
      transition: 'all 0.2s'
    }}>{children}</button>
  );
}

export default function AdvancedScreener() {
  const { setSelectedSymbol, setActiveView } = useStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [preset, setPreset] = useState('all');
  const [sector, setSector] = useState('All');
  const [signal, setSignal] = useState('All');
  const [minRsi, setMinRsi] = useState(0);
  const [maxRsi, setMaxRsi] = useState(100);
  const [volumeSpike, setVolumeSpike] = useState(false);
  const [near52High, setNear52High] = useState(false);
  const [near52Low, setNear52Low] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState('ai_score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      ...(sector !== 'All' && { sector }),
      ...(signal !== 'All' && { signal }),
      min_rsi: minRsi,
      max_rsi: maxRsi,
      volume_spike: volumeSpike,
      near_52w_high: near52High,
      near_52w_low: near52Low,
      min_score: minScore,
      sort_by: sortBy,
      sort_dir: sortDir,
    });
    api.get(`/api/screener/advanced?${params}`)
      .then(r => { setRows(r.data); setPage(1); })
      .catch(() => setError('Failed to load screener data.'))
      .finally(() => setLoading(false));
  }, [sector, signal, minRsi, maxRsi, volumeSpike, near52High, near52Low, minScore, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Preset Handlers
  const applyPreset = (presetId) => {
    setPreset(presetId);
    setSector('All');
    setSearch('');
    if (presetId === 'all') {
      setSignal('All'); setMinRsi(0); setMaxRsi(100);
      setVolumeSpike(false); setNear52High(false); setNear52Low(false); setMinScore(0);
    } else if (presetId === 'bullish') {
      setSignal('buy'); setMinRsi(50); setMaxRsi(100);
      setVolumeSpike(true); setNear52High(false); setNear52Low(false); setMinScore(50);
    } else if (presetId === 'oversold') {
      setSignal('All'); setMinRsi(0); setMaxRsi(38);
      setVolumeSpike(false); setNear52High(false); setNear52Low(false); setMinScore(40);
    } else if (presetId === 'volume') {
      setSignal('All'); setMinRsi(0); setMaxRsi(100);
      setVolumeSpike(true); setNear52High(false); setNear52Low(false); setMinScore(0);
    } else if (presetId === 'momentum') {
      setSignal('All'); setMinRsi(55); setMaxRsi(100);
      setVolumeSpike(false); setNear52High(true); setNear52Low(false); setMinScore(0);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const handleSelect = (ticker) => {
    setSelectedSymbol(ticker);
    setActiveView('Live Chart');
  };

  const exportCsv = () => {
    const header = 'Ticker,Name,Sector,Price,Change%,Trend,AI Score,Signal,Target 7D,Stop Loss,RSI,Volume Ratio\n';
    const lines = rows.map(r =>
      `${r.ticker},${r.name},${r.sector},${r.price},${r.change},${r.trend || ''},${r.ai_score},${r.signal},${r.target_price_7d || ''},${r.stop_loss || ''},${r.rsi ?? ''},${r.volume_ratio ?? ''}`
    ).join('\n');
    const blob = new Blob([header + lines], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stockoracle_screener.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Metrics KPI Calculation
  const stats = useMemo(() => {
    const total = rows.length;
    const bullish = rows.filter(r => r.signal === 'buy' || r.trend === 'BULLISH').length;
    const volumeSurges = rows.filter(r => (r.volume_ratio || 0) >= 1.5).length;
    const oversold = rows.filter(r => (r.rsi || 50) < 38).length;
    const avgScore = total ? (rows.reduce((acc, r) => acc + (r.ai_score || 0), 0) / total).toFixed(0) : 0;
    return { total, bullish, volumeSurges, oversold, avgScore };
  }, [rows]);

  const filtered = rows.filter(r => {
    const q = (search || '').trim().toUpperCase();
    if (!q) return true;
    const matchTicker = r.ticker ? String(r.ticker).toUpperCase().includes(q) : false;
    const matchName = r.name ? String(r.name).toUpperCase().includes(q) : false;
    return matchTicker || matchName;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #06B6D4, #6366F1)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>
            Advanced AI Stock Screener
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
            Scanning 30+ Nifty 50 stocks with RSI, Volume Spikes, Trend Crossovers & Target Levels
          </p>
        </div>
        <button onClick={exportCsv} style={{
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#10B981', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 600
        }}>⬇ Export CSV</button>
      </div>

      {/* KPI Cards Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'TOTAL STOCKS SCANNED', value: stats.total, color: '#6366F1', icon: '📊' },
          { label: 'BULLISH CANDIDATES', value: stats.bullish, color: '#10B981', icon: '🚀' },
          { label: 'VOLUME BREAKOUTS', value: stats.volumeSurges, color: '#F59E0B', icon: '🔥' },
          { label: 'OVERSOLD BARGAINS', value: stats.oversold, color: '#06B6D4', icon: '💎' },
          { label: 'AVG AI CONFIDENCE', value: `${stats.avgScore}/100`, color: '#A855F7', icon: '🤖' },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: 'linear-gradient(135deg, #0C1022, #10142a)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#6B7280', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: kpi.color, fontFamily: 'JetBrains Mono, monospace' }}>{kpi.value}</div>
            </div>
            <span style={{ fontSize: '1.4rem' }}>{kpi.icon}</span>
          </div>
        ))}
      </div>

      {/* 1-Click Screener Presets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#6B7280', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', marginRight: 4 }}>QUICK PRESETS:</span>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              border: preset === p.id ? '1px solid #A855F7' : '1px solid rgba(255,255,255,0.08)',
              background: preset === p.id ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.03)',
              color: preset === p.id ? '#C084FC' : '#9CA3AF',
              transition: 'all 0.2s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter Panel */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1022, #10142a)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '18px 22px',
        display: 'flex', flexDirection: 'column', gap: 14
      }}>
        {/* Row 1: Sector Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700, marginRight: 4 }}>SECTOR</span>
          {SECTORS.map(s => (
            <FilterPill key={s} active={sector === s} onClick={() => setSector(s)}>{s}</FilterPill>
          ))}
        </div>

        {/* Row 2: Signal filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700, marginRight: 4 }}>SIGNAL</span>
          {SIGNALS.map(s => (
            <FilterPill key={s} active={signal === s} onClick={() => setSignal(s)}>
              {s === 'All' ? 'All Signals' : (s ? s.toUpperCase() : '')}
            </FilterPill>
          ))}
        </div>

        {/* Row 3: RSI range + toggles + search */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6B7280', fontSize: '0.74rem', fontWeight: 600 }}>RSI</span>
            <input type="number" min={0} max={100} value={minRsi}
              onChange={e => setMinRsi(+e.target.value)} style={{
                width: 52, padding: '5px 8px', background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 8, color: '#F0F0FF', fontSize: '0.8rem', textAlign: 'center'
              }} />
            <span style={{ color: '#6B7280' }}>–</span>
            <input type="number" min={0} max={100} value={maxRsi}
              onChange={e => setMaxRsi(+e.target.value)} style={{
                width: 52, padding: '5px 8px', background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 8, color: '#F0F0FF', fontSize: '0.8rem', textAlign: 'center'
              }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6B7280', fontSize: '0.74rem', fontWeight: 600 }}>MIN SCORE</span>
            <input type="number" min={0} max={100} value={minScore}
              onChange={e => setMinScore(+e.target.value)} style={{
                width: 56, padding: '5px 8px', background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 8, color: '#F0F0FF', fontSize: '0.8rem', textAlign: 'center'
              }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={volumeSpike} onChange={e => setVolumeSpike(e.target.checked)} />
            <span style={{ color: '#F59E0B', fontSize: '0.78rem', fontWeight: 600 }}>🔥 Volume Spike</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={near52High} onChange={e => setNear52High(e.target.checked)} />
            <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: 600 }}>⬆ Near 52W High</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={near52Low} onChange={e => setNear52Low(e.target.checked)} />
            <span style={{ color: '#F43F5E', fontSize: '0.78rem', fontWeight: 600 }}>⬇ Near 52W Low</span>
          </label>

          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <input type="text" placeholder="Search ticker or name…" value={search}
              onChange={e => setSearch(e.target.value)} style={{
                padding: '6px 14px 6px 30px', background: '#1a1a2e',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10,
                color: '#F0F0FF', fontSize: '0.82rem', width: 210, outline: 'none'
              }} />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4B5563', fontSize: '0.75rem' }}>🔍</span>
          </div>
        </div>
      </div>

      {/* Results count & Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#6B7280', fontSize: '0.82rem' }}>
          Showing <strong style={{ color: '#9CA3AF' }}>{filtered.length}</strong> stocks
        </span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.2)', color: '#9CA3AF',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>‹</button>
            <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.2)', color: '#9CA3AF',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>›</button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
        <div style={{ overflowX: 'auto', background: 'linear-gradient(135deg, #0C1022, #10142a)',
          border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, overflow: 'hidden' }}>
          <table className="screener-table" style={{ borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company</th>
                <th>Sector</th>
                <SortHeader field="price" label="Price" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                <SortHeader field="change" label="Change%" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                <th>Trend</th>
                <SortHeader field="ai_score" label="AI Score" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                <th>Signal</th>
                <SortHeader field="predicted_pct" label="7D Return" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                <th>7D Target / Stop</th>
                <SortHeader field="rsi" label="RSI" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
                <SortHeader field="volume_ratio" label="Vol Ratio" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={12}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-text">No stocks match your filters</div>
                  </div>
                </td></tr>
              )}
              {paginated.map(r => {
                const changeUp = r.change >= 0;
                const scoreColor = r.ai_score >= 70 ? '#10B981' : r.ai_score >= 50 ? '#F59E0B' : '#F43F5E';
                const predUp = (r.predicted_pct ?? 0) >= 0;
                const signalColors = { buy: '#10B981', sell: '#F43F5E', hold: '#F59E0B' };
                const sigColor = signalColors[r.signal] || '#6B7280';
                const isBullTrend = r.trend === 'BULLISH';

                return (
                  <tr key={r.ticker} onClick={() => handleSelect(r.ticker)}
                    style={{ cursor: 'pointer' }}>
                    <td><span className="ticker-badge">{r.ticker}</span></td>
                    <td style={{ color: '#9CA3AF', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.7rem', color: '#6366F1',
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 6, padding: '2px 8px' }}>{r.sector}</span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>₹{r.price?.toFixed(2) ?? '—'}</td>
                    <td style={{ color: changeUp ? '#10B981' : '#F43F5E', fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace' }}>
                      {changeUp ? '+' : ''}{r.change?.toFixed(2)}%
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800,
                        color: isBullTrend ? '#10B981' : '#F43F5E',
                        background: isBullTrend ? '#10B98115' : '#F43F5E15',
                        border: `1px solid ${isBullTrend ? '#10B98135' : '#F43F5E35'}`,
                        borderRadius: 6, padding: '2px 6px'
                      }}>
                        {isBullTrend ? 'BULLISH 📈' : 'BEARISH 📉'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: scoreColor,
                        fontFamily: 'JetBrains Mono, monospace' }}>{r.ai_score}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: sigColor,
                        background: `${sigColor}18`, border: `1px solid ${sigColor}40`,
                        borderRadius: 6, padding: '3px 9px', textTransform: 'uppercase' }}>
                        {r.signal}
                      </span>
                    </td>
                    <td style={{ color: predUp ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                      {r.predicted_pct != null ? `${predUp ? '+' : ''}${r.predicted_pct.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem' }}>
                      <div style={{ color: '#10B981', fontWeight: 700 }}>🎯 ₹{r.target_price_7d || '—'}</div>
                      <div style={{ color: '#F43F5E', fontSize: '0.68rem' }}>🛡️ ₹{r.stop_loss || '—'}</div>
                    </td>
                    <td><RsiBar rsi={r.rsi} /></td>
                    <td><VolumeChip ratio={r.volume_ratio} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
