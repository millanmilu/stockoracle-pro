import React, { useMemo } from 'react';

/**
 * Sector Heat & Sentiment Distribution Bar with Interactive Filtering
 */
export default function ScreenerSectorChart({ rows = [], selectedSector = 'ALL', onSelectSector }) {
  const sectorSummary = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const sec = r.sector || 'Diversified';
      if (!map[sec]) {
        map[sec] = { sector: sec, total: 0, bullish: 0, bearish: 0, neutral: 0, totalScore: 0 };
      }
      map[sec].total += 1;
      const sig = (r.ai_signal || r.signal || '').toUpperCase();
      if (sig.includes('BUY')) map[sec].bullish += 1;
      else if (sig.includes('SELL')) map[sec].bearish += 1;
      else map[sec].neutral += 1;
      map[sec].totalScore += (r.ai_consensus_score || r.ai_score || 50);
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        avgScore: (item.totalScore / item.total).toFixed(0),
        bullishPct: ((item.bullish / item.total) * 100).toFixed(0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  if (!sectorSummary.length) return null;

  return (
    <div style={{
      background: '#090D1C',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: 12,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Sector Sentiment Breakdown ({sectorSummary.length} Sectors)
        </span>
        {selectedSector !== 'ALL' && selectedSector !== 'All' && (
          <button
            type="button"
            onClick={() => onSelectSector('ALL')}
            style={{
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6, color: '#A5B4FC', fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer'
            }}
          >
            Show All Sectors
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {sectorSummary.map((sec) => {
          const isSelected = selectedSector === sec.sector;
          const isBull = +sec.bullishPct >= 50;

          return (
            <div
              key={sec.sector}
              onClick={() => onSelectSector(isSelected ? 'ALL' : sec.sector)}
              style={{
                minWidth: 130,
                background: isSelected ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.025)',
                border: isSelected ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.74rem', color: isSelected ? '#A5B4FC' : '#E2E8F0', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sec.sector}
                </span>
                <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                  {sec.total}
                </span>
              </div>

              {/* Sentiment ratio bar */}
              <div style={{ display: 'flex', height: 4, background: '#060913', borderRadius: 2, overflow: 'hidden', margin: '5px 0' }}>
                <div style={{ width: `${(sec.bullish / sec.total) * 100}%`, background: '#10B981' }} />
                <div style={{ width: `${(sec.neutral / sec.total) * 100}%`, background: '#F59E0B' }} />
                <div style={{ width: `${(sec.bearish / sec.total) * 100}%`, background: '#EF4444' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
                <span style={{ color: isBull ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                  {sec.bullishPct}% Bull
                </span>
                <span style={{ color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                  AI {sec.avgScore}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
