import React, { useState } from 'react';
import useStore from '../store/useStore';
import { fmt } from '../utils/formatters';
import { PlusCircle, Trash2, TrendingUp, TrendingDown, Wallet, BarChart2 } from 'lucide-react';

export default function Portfolio() {
  const { portfolio, addPosition, removePosition, livePrices, selectedSymbol } = useStore();
  const [form, setForm] = useState({ ticker: selectedSymbol, quantity: '', buyPrice: '' });
  const [formError, setFormError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    const qty   = parseFloat(form.quantity);
    const price = parseFloat(form.buyPrice);
    if (!form.ticker.trim() || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      setFormError('Please enter a valid ticker, quantity, and buy price.');
      return;
    }
    addPosition({ ticker: form.ticker.trim().toUpperCase(), quantity: qty, buyPrice: price });
    setForm({ ticker: '', quantity: '', buyPrice: '' });
    setFormError('');
  };

  // Compute portfolio totals
  let totalInvested = 0;
  let totalCurrent  = 0;

  const enriched = portfolio.map((pos) => {
    const liveData = livePrices[pos.ticker];
    const currentPrice = liveData?.price ?? pos.buyPrice;
    const invested  = pos.quantity * pos.buyPrice;
    const current   = pos.quantity * currentPrice;
    const pnl       = current - invested;
    const pnlPct    = (pnl / invested) * 100;
    totalInvested  += invested;
    totalCurrent   += current;
    return { ...pos, currentPrice, invested, current, pnl, pnlPct };
  });

  const totalPnL    = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#fff' }}>📊 Portfolio</h1>

      {/* Summary cards */}
      {portfolio.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Total Invested', value: fmt.price(totalInvested), icon: <Wallet size={18} />, color: '#0ea5e9' },
            { label: 'Current Value', value: fmt.price(totalCurrent),   icon: <BarChart2 size={18} />, color: '#a78bfa' },
            {
              label: 'Total P&L',
              value: `${totalPnL >= 0 ? '+' : ''}${fmt.price(totalPnL)} (${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%)`,
              icon: totalPnL >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />,
              color: totalPnL >= 0 ? '#10B981' : '#F43F5E',
            },
          ].map((card) => (
            <div key={card.label} style={{
              background: 'var(--card-bg, #1e1e1e)', border: '1px solid var(--border, #333)', borderRadius: 12,
              padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: card.color }}>
                {card.icon}
                <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: card.color, fontFamily: 'JetBrains Mono, monospace' }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add position form */}
      <div style={{ background: 'var(--card-bg, #1e1e1e)', border: '1px solid var(--border, #333)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text, #fff)', fontSize: '0.95rem' }}>Add Position</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[
            { label: 'Ticker', key: 'ticker', placeholder: 'RELIANCE', type: 'text' },
            { label: 'Quantity', key: 'quantity', placeholder: '10', type: 'number' },
            { label: 'Buy Price (₹)', key: 'buyPrice', placeholder: '1420.00', type: 'number' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
              <label style={{ fontSize: '0.78rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{
                  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #333)',
                  background: 'var(--bg, #121212)', color: 'var(--text, #fff)', fontSize: '0.9rem',
                }}
              />
            </div>
          ))}
          <button type="submit" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
            borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', alignSelf: 'flex-end',
          }}>
            <PlusCircle size={16} /> Add
          </button>
        </form>
        {formError && <p style={{ color: '#F43F5E', fontSize: '0.82rem', marginTop: 8 }}>{formError}</p>}
      </div>

      {/* Holdings table */}
      {enriched.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#555', padding: 48, background: 'var(--card-bg, #1e1e1e)', borderRadius: 12, border: '1px solid var(--border, #333)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📭</div>
          <div>No positions yet. Add your first holding above.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--card-bg, #1e1e1e)', borderRadius: 12, border: '1px solid var(--border, #333)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, #333)' }}>
                {['Ticker', 'Qty', 'Buy Price', 'Current', 'Invested', 'Value', 'P&L', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem' }}>
                      {pos.ticker}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#ccc', fontFamily: 'JetBrains Mono, monospace' }}>{pos.quantity}</td>
                  <td style={{ padding: '12px 16px', color: '#888', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(pos.buyPrice)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>{fmt.price(pos.currentPrice)}</td>
                  <td style={{ padding: '12px 16px', color: '#888', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(pos.invested)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>{fmt.price(pos.current)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: pos.pnl >= 0 ? '#10B981' : '#F43F5E' }}>
                    {pos.pnl >= 0 ? '+' : ''}{fmt.price(pos.pnl)}{' '}
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%)</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => removePosition(pos.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F43F5E', opacity: 0.7 }} title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: '#555', fontSize: '0.78rem', textAlign: 'center' }}>
        Current prices update live via WebSocket. Portfolio data is saved locally in your browser.
      </p>
    </div>
  );
}
