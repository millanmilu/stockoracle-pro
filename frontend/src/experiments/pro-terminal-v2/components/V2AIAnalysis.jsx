// Pro Terminal V2 — AI Analysis Panel

import React from 'react';
import { V2_COLORS } from '../utils/constants';

export default function V2AIAnalysis({ aiAnalysis }) {
  if (!aiAnalysis) return null;

  const isBullish = aiAnalysis.direction === 'Bullish';
  const directionColor = isBullish ? V2_COLORS.positive : aiAnalysis.direction === 'Bearish' ? V2_COLORS.negative : V2_COLORS.warning;

  return (
    <div style={{ padding: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary }}>AI ANALYSIS</div>
        <div style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          color: directionColor,
          background: `${directionColor}15`,
        }}>
          {aiAnalysis.direction} {aiAnalysis.confidence}%
        </div>
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <AIBar label="Trend" value={aiAnalysis.trend} />
        <AIBar label="Momentum" value={aiAnalysis.momentum} />
        <AIBar label="Breakout" value={aiAnalysis.breakout} />
        <AIBar label="Volatility" value={aiAnalysis.volatility} />
        <AIBar label="Volume" value={aiAnalysis.volume} />
        <AIBar label="Structure" value={aiAnalysis.structure} />
        <AIBar label="Confidence" value={aiAnalysis.confidence} />
      </div>

      {/* AI Indicators */}
      <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.secondary, marginBottom: 8 }}>
        AI Indicators
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        {['AI Trend', 'AI Momentum', 'AI Breakout', 'AI S/R', 'AI Volatility', 'AI Regime', 'AI Pattern'].map((name) => (
          <div key={name} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            background: V2_COLORS.bg.tertiary,
            borderRadius: 4,
            fontSize: 11,
          }}>
            <span style={{ color: V2_COLORS.text.secondary }}>{name}</span>
            <span style={{ color: V2_COLORS.text.muted, fontSize: 10 }}>Active</span>
          </div>
        ))}
      </div>

      {/* Key levels */}
      <div style={{ fontSize: 11, fontWeight: 600, color: V2_COLORS.text.secondary, marginBottom: 8 }}>
        Key Levels
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <LevelItem label="Support" value={aiAnalysis.support} color={V2_COLORS.positive} />
        <LevelItem label="Resistance" value={aiAnalysis.resistance} color={V2_COLORS.negative} />
        <LevelItem label="Target" value={aiAnalysis.target} color={V2_COLORS.accent.primary} />
      </div>

      {/* Risk/Reward */}
      <div style={{ marginTop: 12, padding: '8px', background: V2_COLORS.bg.tertiary, borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: V2_COLORS.text.muted }}>Risk/Reward</span>
          <span style={{ color: V2_COLORS.text.primary, fontWeight: 600 }}>{aiAnalysis.riskReward}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
          <span style={{ color: V2_COLORS.text.muted }}>Regime</span>
          <span style={{ color: V2_COLORS.accent.primary, fontWeight: 600 }}>{aiAnalysis.regime}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
          <span style={{ color: V2_COLORS.text.muted }}>Pattern</span>
          <span style={{ color: V2_COLORS.text.secondary, fontWeight: 600 }}>{aiAnalysis.pattern}</span>
        </div>
      </div>
    </div>
  );
}

function AIBar({ label, value }) {
  const color = value >= 70 ? V2_COLORS.positive : value >= 40 ? V2_COLORS.warning : V2_COLORS.negative;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: V2_COLORS.text.secondary }}>{label}</span>
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: V2_COLORS.bg.tertiary, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

function LevelItem({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: V2_COLORS.text.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color }}>₹{value}</div>
    </div>
  );
}
