// Pro Terminal V2 — Fundamentals Panel

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { V2_COLORS } from '../utils/constants';
import { mockFinancialStatements, mockShareholding, mockCorporateActions } from '../data/mockFundamentals';

export default function V2Fundamentals({ fundamentals }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary, marginBottom: 12 }}>
        Fundamentals
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <MetricItem label="Market Cap" value={fundamentals.marketCap} />
        <MetricItem label="P/E" value={fundamentals.pe} />
        <MetricItem label="P/B" value={fundamentals.pb} />
        <MetricItem label="ROE" value={`${fundamentals.roe}%`} />
        <MetricItem label="ROCE" value={`${fundamentals.roce}%`} />
        <MetricItem label="Debt/Equity" value={fundamentals.debtEquity} />
        <MetricItem label="EPS" value={fundamentals.eps} />
        <MetricItem label="Dividend Yield" value={`${fundamentals.dividendYield}%`} />
      </div>

      {/* Expandable sections */}
      <FundSection
        id="income"
        title="Income Statement"
        expanded={expanded.income}
        onToggle={toggle}
      >
        <table style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr style={{ color: V2_COLORS.text.muted }}>
              <th style={{ textAlign: 'left', padding: '4px 0' }}>Period</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Revenue</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Net Profit</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>EPS</th>
            </tr>
          </thead>
          <tbody>
            {mockFinancialStatements.incomeStatement.map((row) => (
              <tr key={row.period} style={{ color: V2_COLORS.text.secondary }}>
                <td style={{ padding: '4px 0' }}>{row.period}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.revenue}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.netProfit}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.eps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FundSection>

      <FundSection
        id="balance"
        title="Balance Sheet"
        expanded={expanded.balance}
        onToggle={toggle}
      >
        <table style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr style={{ color: V2_COLORS.text.muted }}>
              <th style={{ textAlign: 'left', padding: '4px 0' }}>Period</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Total Assets</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Equity</th>
            </tr>
          </thead>
          <tbody>
            {mockFinancialStatements.balanceSheet.map((row) => (
              <tr key={row.period} style={{ color: V2_COLORS.text.secondary }}>
                <td style={{ padding: '4px 0' }}>{row.period}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.totalAssets}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.equity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FundSection>

      <FundSection
        id="cashflow"
        title="Cash Flow"
        expanded={expanded.cashflow}
        onToggle={toggle}
      >
        <table style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr style={{ color: V2_COLORS.text.muted }}>
              <th style={{ textAlign: 'left', padding: '4px 0' }}>Period</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Operating</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Investing</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Financing</th>
            </tr>
          </thead>
          <tbody>
            {mockFinancialStatements.cashFlow.map((row) => (
              <tr key={row.period} style={{ color: V2_COLORS.text.secondary }}>
                <td style={{ padding: '4px 0' }}>{row.period}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.operating}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.investing}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.financing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FundSection>

      <FundSection
        id="shareholding"
        title="Shareholding"
        expanded={expanded.shareholding}
        onToggle={toggle}
      >
        <table style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr style={{ color: V2_COLORS.text.muted }}>
              <th style={{ textAlign: 'left', padding: '4px 0' }}>Quarter</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Promoter</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>FII</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>DII</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Public</th>
            </tr>
          </thead>
          <tbody>
            {mockShareholding.map((row) => (
              <tr key={row.quarter} style={{ color: V2_COLORS.text.secondary }}>
                <td style={{ padding: '4px 0' }}>{row.quarter}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.promoter}%</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.fii}%</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.dii}%</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.public}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FundSection>

      <FundSection
        id="corporate"
        title="Corporate Actions"
        expanded={expanded.corporate}
        onToggle={toggle}
      >
        {mockCorporateActions.map((action) => (
          <div key={action.date} style={{ padding: '6px 0', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
            <div style={{ fontSize: 11, color: V2_COLORS.text.primary }}>{action.type}</div>
            <div style={{ fontSize: 10, color: V2_COLORS.text.muted }}>{action.details}</div>
            <div style={{ fontSize: 9, color: V2_COLORS.text.muted }}>{action.date}</div>
          </div>
        ))}
      </FundSection>
    </div>
  );
}

function MetricItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: V2_COLORS.text.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: V2_COLORS.text.primary }}>{value}</div>
    </div>
  );
}

function FundSection({ id, title, expanded, onToggle, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => onToggle(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '6px 0',
          fontSize: 11,
          fontWeight: 600,
          color: V2_COLORS.text.secondary,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {title}
      </button>
      {expanded && (
        <div style={{ paddingLeft: 16 }}>
          {children}
        </div>
      )}
    </div>
  );
}
