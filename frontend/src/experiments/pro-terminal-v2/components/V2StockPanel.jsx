// Pro Terminal V2 — Right Stock Panel

import React from 'react';
import { V2_COLORS } from '../utils/constants';
import { formatPrice, formatChange, formatPercent } from '../utils/formatters';

const TABS = ['Overview', 'Fundamentals', 'Technical', 'News'];

export default function V2StockPanel({
  symbol,
  currentPrice,
  priceChange,
  priceChangePct,
  fundamentals,
  activeTab,
  onTabChange,
}) {
  return (
    <div style={{
      width: 280,
      background: V2_COLORS.bg.secondary,
      borderLeft: `1px solid ${V2_COLORS.bg.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: V2_COLORS.text.primary }}>{symbol}</div>
            <div style={{ fontSize: 10, color: V2_COLORS.text.muted }}>NSE</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: V2_COLORS.positive,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}>BUY</button>
            <button style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: V2_COLORS.negative,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}>SELL</button>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: V2_COLORS.text.primary }}>
            {formatPrice(currentPrice)}
          </div>
          <div style={{ fontSize: 12, color: priceChange >= 0 ? V2_COLORS.positive : V2_COLORS.negative }}>
            {formatChange(priceChange)} ({formatPercent(priceChangePct)})
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab.toLowerCase())}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: 10,
              fontWeight: 600,
              color: activeTab === tab.toLowerCase() ? V2_COLORS.accent.primary : V2_COLORS.text.muted,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.toLowerCase() ? `2px solid ${V2_COLORS.accent.primary}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {activeTab === 'overview' && <OverviewContent fundamentals={fundamentals} />}
        {activeTab === 'fundamentals' && <FundamentalsContent fundamentals={fundamentals} />}
        {activeTab === 'technical' && <TechnicalContent />}
        {activeTab === 'news' && <NewsContent />}
      </div>
    </div>
  );
}

function OverviewContent({ fundamentals }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.secondary, marginBottom: 8 }}>
        {fundamentals.name}
      </div>
      <div style={{ fontSize: 10, color: V2_COLORS.text.muted, marginBottom: 12 }}>
        Industry: {fundamentals.industry}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <InfoItem label="Market Cap" value={fundamentals.marketCap} />
        <InfoItem label="P/E" value={fundamentals.pe} />
        <InfoItem label="P/B" value={fundamentals.pb} />
        <InfoItem label="ROE" value={`${fundamentals.roe}%`} />
        <InfoItem label="ROCE" value={`${fundamentals.roce}%`} />
        <InfoItem label="Debt/Equity" value={fundamentals.debtEquity} />
        <InfoItem label="EPS" value={fundamentals.eps} />
        <InfoItem label="Div Yield" value={`${fundamentals.dividendYield}%`} />
      </div>
    </div>
  );
}

function FundamentalsContent({ fundamentals }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.secondary, marginBottom: 8 }}>
        Financial Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <InfoItem label="Revenue" value={fundamentals.revenue} />
        <InfoItem label="Net Profit" value={fundamentals.netProfit} />
        <InfoItem label="Op Margin" value={`${fundamentals.operatingMargin}%`} />
        <InfoItem label="Net Margin" value={`${fundamentals.netMargin}%`} />
        <InfoItem label="Book Value" value={fundamentals.bookValue} />
        <InfoItem label="Face Value" value={fundamentals.faceValue} />
      </div>
    </div>
  );
}

function TechnicalContent() {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.secondary, marginBottom: 8 }}>
        Technical Indicators
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <InfoItem label="RSI (14)" value="58.2" />
        <InfoItem label="MACD" value="+12.4" />
        <InfoItem label="EMA 20" value="2,865.30" />
        <InfoItem label="EMA 50" value="2,842.10" />
        <InfoItem label="EMA 200" value="2,780.50" />
        <InfoItem label="ADX" value="24.5" />
        <InfoItem label="ATR" value="18.2" />
        <InfoItem label="Stochastic" value="65.4" />
      </div>
    </div>
  );
}

function NewsContent() {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.secondary, marginBottom: 8 }}>
        Latest News
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { headline: 'Company announces major investment...', source: 'ET', time: '2h ago', sentiment: 'positive' },
          { headline: 'Shares gain on strong outlook...', source: 'MC', time: '5h ago', sentiment: 'positive' },
          { headline: 'Analysts revise expectations...', source: 'Mint', time: '1d ago', sentiment: 'neutral' },
        ].map((item, i) => (
          <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
            <div style={{ fontSize: 11, color: V2_COLORS.text.primary, marginBottom: 2 }}>{item.headline}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
              <span style={{ color: V2_COLORS.text.muted }}>{item.source}</span>
              <span style={{ color: V2_COLORS.text.muted }}>{item.time}</span>
              <span style={{
                padding: '1px 4px',
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 600,
                color: item.sentiment === 'positive' ? V2_COLORS.positive : item.sentiment === 'negative' ? V2_COLORS.negative : V2_COLORS.neutral,
                background: item.sentiment === 'positive' ? 'rgba(16,185,129,0.1)' : item.sentiment === 'negative' ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)',
              }}>{item.sentiment}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: V2_COLORS.text.muted, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: V2_COLORS.text.primary }}>{value}</div>
    </div>
  );
}
