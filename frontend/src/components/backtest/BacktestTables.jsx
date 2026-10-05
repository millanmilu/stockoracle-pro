import React from 'react';
import { Download } from 'lucide-react';
import { MONTHS } from './backtestConstants';

export function MonthlyHeatmapTab({ data }) {
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px', overflowX: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 700 }}>
                  Hedge-Fund Style Monthly Returns Heatmap (%)
                </span>
                <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
                  Green = Profit · Red = Loss
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', minWidth: 650 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left' }}>Year</th>
                    {MONTHS.map(m => (
                      <th key={m} style={{ padding: '8px 4px', textAlign: 'center' }}>{m}</th>
                    ))}
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800 }}>Full Year</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.monthly_matrix || {}).sort((a, b) => b[0] - a[0]).map(([yr, monthData]) => {
                    const yrTotal = monthData['Year'];
                    return (
                      <tr key={yr} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 800, color: '#F8FAFC' }}>{yr}</td>
                        {MONTHS.map(m => {
                          const val = monthData[m];
                          const hasVal = val !== undefined && val !== null;
                          const isPos = val > 0;
                          const isZero = val === 0;
                          const bg = !hasVal ? 'transparent' : isZero ? 'rgba(255,255,255,0.03)' : isPos ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)';
                          const fg = !hasVal ? '#475569' : isZero ? '#94A3B8' : isPos ? '#34D399' : '#F87171';
                          return (
                            <td key={m} style={{
                              padding: '8px 4px', textAlign: 'center', background: bg, color: fg,
                              fontWeight: hasVal ? 700 : 400, fontFamily: 'JetBrains Mono, monospace'
                            }}>
                              {hasVal ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : '—'}
                            </td>
                          );
                        })}
                        <td style={{
                          padding: '8px 6px', textAlign: 'right', fontWeight: 800,
                          color: yrTotal >= 0 ? '#34D399' : '#F87171',
                          background: yrTotal >= 0 ? 'rgba(16,185,129,0.22)' : 'rgba(244,63,94,0.22)',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}>
                          {yrTotal !== undefined ? `${yrTotal >= 0 ? '+' : ''}${yrTotal.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

  );
}

export function TradeJournalTab({
  data, currSymbol, filteredTrades, journalFilter, setJournalFilter,
  journalSearch, setJournalSearch, handleExportCSV,
}) {
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12
            }}>
              {/* Journal Filter Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['ALL', 'WIN', 'LOSS'].map(f => (
                      <button
                        key={f}
                        onClick={() => setJournalFilter(f)}
                        style={{
                          padding: '3px 9px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700,
                          border: `1px solid ${journalFilter === f ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          background: journalFilter === f ? 'rgba(99,102,241,0.2)' : 'transparent',
                          color: journalFilter === f ? '#818CF8' : '#94A3B8', cursor: 'pointer'
                        }}>
                        {f === 'ALL' ? `All (${data.total_trades})` : f === 'WIN' ? `Wins (${data.winning_trades})` : `Losses (${data.losing_trades})`}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search date / exit reason..."
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, padding: '4px 8px', fontSize: '0.7rem', color: '#F8FAFC', width: 170
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    Showing: <strong style={{ color: '#F8FAFC' }}>{filteredTrades.length}</strong> trades
                  </span>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
                      borderRadius: 6, padding: '4px 10px', fontSize: '0.68rem', color: '#818CF8',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}>
                    <Download size={12} />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Journal Table */}
              <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                      {['#', 'Entry Date', 'Exit Date', 'Entry Px', 'Exit Px', 'Hold Days', 'P&L', 'P&L %', 'Exit Reason', 'Result'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((t, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '7px 8px', color: '#64748B' }}>{t.trade_id || idx + 1}</td>
                        <td style={{ padding: '7px 8px' }}>{t.entry_date}</td>
                        <td style={{ padding: '7px 8px' }}>{t.exit_date}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'JetBrains Mono, monospace' }}>{currSymbol}{t.entry_price}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'JetBrains Mono, monospace' }}>{currSymbol}{t.exit_price}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center' }}>{t.holding_days}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: t.pnl >= 0 ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                          {t.pnl >= 0 ? '+' : ''}{currSymbol}{t.pnl.toFixed(0)}
                        </td>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: t.pnl_pct >= 0 ? '#10B981' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                          {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                        </td>
                        <td style={{ padding: '7px 8px', color: '#94A3B8', fontSize: '0.66rem' }}>{t.exit_reason}</td>
                        <td style={{ padding: '7px 8px' }}>
                          <span style={{
                            fontSize: '0.64rem', fontWeight: 800,
                            color: t.result === 'WIN' ? '#34D399' : '#F87171',
                            background: t.result === 'WIN' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                            padding: '2px 6px', borderRadius: 4
                          }}>
                            {t.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

  );
}
