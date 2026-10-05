// Pro Terminal V2 — Bottom workspace tab views
// Historical data, technical report, peer comparison, option chain,
// shareholding pattern and corporate actions — all rendered from the
// experiment's own mock/candle data.

import React from 'react';
import { V2_COLORS } from '../utils/constants';
import { formatPrice, formatPercent, formatVolume } from '../utils/formatters';
import { mockShareholding, mockCorporateActions } from '../data/mockFundamentals';
import { mockScreenerResults } from '../data/mockScreener';

const wrap = { padding: 12, height: '100%', overflowY: 'auto' };
const thStyle = {
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: V2_COLORS.text.muted,
  borderBottom: `1px solid ${V2_COLORS.bg.border}`,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '5px 8px',
  fontSize: 11,
  color: V2_COLORS.text.secondary,
  borderBottom: `1px solid ${V2_COLORS.bg.border}`,
  whiteSpace: 'nowrap',
};

function PaneTitle({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize: 11, color: V2_COLORS.text.muted, padding: 16 }}>{children}</div>;
}

// ── Historical Data ────────────────────────────────────────────────────────
export function HistoricalTable({ candles = [], symbol }) {
  const rows = candles.slice(-60).reverse();
  if (!rows.length) return <Empty>No candle data available.</Empty>;

  const fmtTime = (t) => new Date(t * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={wrap}>
      <PaneTitle>Historical Data — {symbol} (last {rows.length} candles)</PaneTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Time</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Open</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>High</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Low</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Close</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Change</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const chg = ((c.close - c.open) / c.open) * 100;
            return (
              <tr key={c.time}>
                <td style={tdStyle}>{fmtTime(c.time)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatPrice(c.open)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: V2_COLORS.positive }}>{formatPrice(c.high)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: V2_COLORS.negative }}>{formatPrice(c.low)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: V2_COLORS.text.primary }}>{formatPrice(c.close)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: chg >= 0 ? V2_COLORS.positive : V2_COLORS.negative }}>
                  {formatPercent(chg)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatVolume(c.volume)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Technicals ─────────────────────────────────────────────────────────────
export function TechnicalReport({ technical, symbol }) {
  if (!technical) return <Empty>No indicator data available.</Empty>;

  const rows = [
    { name: 'RSI (14)', value: technical.rsi != null ? technical.rsi.toFixed(2) : '—', signal: technical.rsiSignal },
    { name: 'MACD', value: technical.macd != null ? technical.macd.toFixed(2) : '—', signal: technical.macdSignal },
    { name: 'Stochastic %K', value: technical.stoch.toFixed(2), signal: technical.stochSignal },
    { name: 'ATR (14)', value: technical.atr.toFixed(2), signal: 'Volatility' },
    { name: 'EMA 20', value: technical.ema20 != null ? formatPrice(technical.ema20) : '—', signal: technical.emaSignal },
    { name: 'EMA 50', value: technical.ema50 != null ? formatPrice(technical.ema50) : '—', signal: technical.emaSignal },
    { name: 'EMA 200', value: technical.ema200 != null ? formatPrice(technical.ema200) : '—', signal: technical.emaSignal },
  ];

  const signalColor = (s) => {
    if (['Bullish', 'Oversold', 'Above EMA20'].includes(s)) return V2_COLORS.positive;
    if (['Bearish', 'Overbought', 'Below EMA20'].includes(s)) return V2_COLORS.negative;
    return V2_COLORS.text.muted;
  };

  return (
    <div style={wrap}>
      <PaneTitle>Technical Report — {symbol}</PaneTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Indicator</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...tdStyle, color: V2_COLORS.text.primary }}>{r.name}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{r.value}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: signalColor(r.signal), fontWeight: 600 }}>{r.signal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Peer Comparison ────────────────────────────────────────────────────────
export function PeerComparison({ symbol, onOpenSymbol }) {
  const peers = mockScreenerResults.filter((r) => r.symbol !== symbol).slice(0, 10);

  return (
    <div style={wrap}>
      <PaneTitle>Peer Comparison — {symbol} vs sector</PaneTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Symbol</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>LTP</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% Chg</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>P/E</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>ROE</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>RSI</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((p) => (
            <tr key={p.symbol}>
              <td style={{ ...tdStyle, color: V2_COLORS.text.primary, fontWeight: 600 }}>{p.symbol}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatPrice(p.ltp)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: p.change >= 0 ? V2_COLORS.positive : V2_COLORS.negative }}>
                {formatPercent(p.change)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{p.pe}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{p.roe}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{p.rsi}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <button
                  onClick={() => onOpenSymbol?.(p.symbol)}
                  aria-label={`Open ${p.symbol} chart`}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    color: V2_COLORS.accent.primary,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Option Chain (simulated) ───────────────────────────────────────────────
export function OptionsChain({ price = 0, symbol }) {
  if (!price) return <Empty>No price data available.</Empty>;

  const step = Math.max(5, Math.round(price * 0.01 / 5) * 5);
  const atm = Math.round(price / step) * step;
  const strikes = [];
  for (let i = -4; i <= 4; i++) strikes.push(atm + i * step);

  const timeValue = (strike) =>
    Math.max(1.5, 30 - Math.abs(strike - price) / step * 4) * (price / 1000);
  const oi = (strike) =>
    Math.round(1200 + Math.abs(strike - price) / step * -80 + (strike % (step * 3)) * 7);
  const iv = (strike) => (21 + Math.abs(strike - price) / step * 1.4).toFixed(1);

  const cell = { ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={wrap}>
      <PaneTitle>Option Chain — {symbol} (simulated)</PaneTitle>
      <div style={{ fontSize: 10, color: V2_COLORS.text.muted, marginBottom: 8, marginTop: -6 }}>
        Spot {formatPrice(price)} · ATM {atm} · step {step}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'right' }}>Call OI</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Call LTP</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Call IV</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Strike</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Put IV</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Put LTP</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Put OI</th>
          </tr>
        </thead>
        <tbody>
          {strikes.map((k) => {
            const isAtm = k === atm;
            return (
              <tr key={k} style={isAtm ? { background: 'rgba(59, 130, 246, 0.07)' } : undefined}>
                <td style={cell}>{Math.max(0, oi(k))}</td>
                <td style={{ ...cell, color: V2_COLORS.positive }}>
                  {(Math.max(0, price - k) + timeValue(k)).toFixed(2)}
                </td>
                <td style={cell}>{iv(k)}</td>
                <td style={{
                  ...cell,
                  textAlign: 'center',
                  color: isAtm ? V2_COLORS.accent.primary : V2_COLORS.text.primary,
                  fontWeight: isAtm ? 700 : 500,
                }}>{k}</td>
                <td style={cell}>{iv(k)}</td>
                <td style={{ ...cell, color: V2_COLORS.negative }}>
                  {(Math.max(0, k - price) + timeValue(k)).toFixed(2)}
                </td>
                <td style={cell}>{Math.max(0, oi(k) + 400)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Shareholding Pattern ───────────────────────────────────────────────────
export function ShareholdingTable() {
  return (
    <div style={wrap}>
      <PaneTitle>Shareholding Pattern</PaneTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Quarter</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Promoter</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>FII</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>DII</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Public</th>
          </tr>
        </thead>
        <tbody>
          {mockShareholding.map((row) => (
            <tr key={row.quarter}>
              <td style={{ ...tdStyle, color: V2_COLORS.text.primary }}>{row.quarter}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.promoter}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.fii}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.dii}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.public}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Corporate Actions ──────────────────────────────────────────────────────
export function CorporateActionsTable() {
  return (
    <div style={wrap}>
      <PaneTitle>Corporate Actions</PaneTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Details</th>
          </tr>
        </thead>
        <tbody>
          {mockCorporateActions.map((a) => (
            <tr key={`${a.date}-${a.type}`}>
              <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>{a.date}</td>
              <td style={{ ...tdStyle, color: V2_COLORS.accent.primary, fontWeight: 600 }}>{a.type}</td>
              <td style={tdStyle}>{a.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
