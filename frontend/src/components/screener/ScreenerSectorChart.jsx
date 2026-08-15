import React, { useMemo } from 'react';

/**
 * Sector Heat & Signal Distribution Bar
 * @param {{ rows: Array<Object>, selectedSector: string, onSelectSector: (sector: string) => void }} props
 */
export default function ScreenerSectorChart({ rows, selectedSector, onSelectSector }) {
  const sectorSummary = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const sec = r.sector || 'Other';
      if (!map[sec]) {
        map[sec] = { sector: sec, total: 0, bullish: 0, bearish: 0, neutral: 0, avgScore: 0 };
      }
      map[sec].total += 1;
      if (r.signal === 'buy' || r.trend === 'BULLISH') map[sec].bullish += 1;
      else if (r.signal === 'sell' || r.trend === 'BEARISH') map[sec].bearish += 1;
      else map[sec].neutral += 1;
      map[sec].avgScore += r.ai_score || 0;
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        avgScore: (item.avgScore / item.total).toFixed(0),
        bullishPct: ((item.bullish / item.total) * 100).toFixed(0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  if (!sectorSummary.length) return null;

  return (
    <div className="screener-sector-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.74rem', color: '#6B7280', fontWeight: 700, letterSpacing: '0.06em' }}>
          SECTOR SENTIMENT & DISTRIBUTION ({sectorSummary.length} SECTORS)
        </span>
        {selectedSector !== 'All' && (
          <button
            type="button"
            className="screener-btn-reset"
            onClick={() => onSelectSector('All')}
          >
            Show All Sectors
          </button>
        )}
      </div>

      <div className="screener-sector-chips-grid">
        {sectorSummary.map((sec) => {
          const isSelected = selectedSector === sec.sector;
          const isBullHeavy = +sec.bullishPct >= 50;

          return (
            <div
              key={sec.sector}
              className={`screener-sector-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectSector(isSelected ? 'All' : sec.sector)}
              title={`${sec.sector}: ${sec.bullish} Bullish, ${sec.bearish} Bearish (Avg AI: ${sec.avgScore})`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: isSelected ? '#C084FC' : '#E2E8F0' }}>
                  {sec.sector}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace' }}>
                  {sec.total} stocks
                </span>
              </div>

              {/* Sentiment ratio bar */}
              <div style={{ display: 'flex', height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden', margin: '6px 0 4px' }}>
                <div style={{ width: `${(sec.bullish / sec.total) * 100}%`, background: '#10B981' }} />
                <div style={{ width: `${(sec.neutral / sec.total) * 100}%`, background: '#F59E0B' }} />
                <div style={{ width: `${(sec.bearish / sec.total) * 100}%`, background: '#F43F5E' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem' }}>
                <span style={{ color: isBullHeavy ? '#10B981' : '#F59E0B', fontWeight: 600 }}>
                  {sec.bullishPct}% Bullish
                </span>
                <span style={{ color: '#818CF8', fontFamily: 'JetBrains Mono, monospace' }}>
                  AI: {sec.avgScore}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
