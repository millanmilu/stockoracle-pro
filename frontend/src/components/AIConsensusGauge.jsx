import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import { Brain, Cpu, TrendingUp, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AIConsensusGauge({ ticker }) {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const targetSymbol = ticker || selectedSymbol;
  const isDark = useStore((s) => s.theme !== 'light');

  const [consensusData, setConsensusData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetSymbol) return;
    setLoading(true);
    api.get(`/api/stock/${targetSymbol}/ai-consensus`)
      .then((res) => {
        if (res.data && res.data.consensus_score !== undefined) {
          setConsensusData(res.data);
        }
      })
      .catch(() => setConsensusData(null))
      .finally(() => setLoading(false));
  }, [targetSymbol]);

  if (loading) {
    return (
      <div style={{
        padding: '16px',
        borderRadius: '12px',
        background: isDark ? '#0C1022' : '#FFFFFF',
        border: isDark ? '1px solid rgba(99,102,241,0.2)' : '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#818CF8',
        fontSize: '0.85rem'
      }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #818CF8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span>Evaluating 3-Engine AI Consensus for {targetSymbol}…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!consensusData) return null;

  const score = consensusData.consensus_score || 50;
  const signal = consensusData.overall_signal || 'NEUTRAL';
  const agreement = consensusData.agreement || 'Evaluating';

  const isBullish = signal.includes('BUY');
  const isBearish = signal.includes('SELL');
  const signalColor = isBullish ? '#10B981' : (isBearish ? '#EF5350' : '#F59E0B');

  const engines = consensusData.engines || {};

  return (
    <div style={{
      borderRadius: '12px',
      background: isDark ? '#0C1022' : '#FFFFFF',
      border: isDark ? '1px solid rgba(99,102,241,0.2)' : '1px solid #E2E8F0',
      padding: '18px 20px',
      marginBottom: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={18} color="#818CF8" />
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isDark ? '#F1F5F9' : '#0F172A', letterSpacing: '-0.01em' }}>
            3-Engine AI Consensus Gauge
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          borderRadius: '20px',
          background: isBullish ? 'rgba(16,185,129,0.12)' : (isBearish ? 'rgba(239,83,80,0.12)' : 'rgba(245,158,11,0.12)'),
          border: `1px solid ${signalColor}40`,
          color: signalColor,
          fontWeight: 800,
          fontSize: '0.78rem',
        }}>
          <span>{signal}</span>
          <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>({score}/100)</span>
        </div>
      </div>

      {/* Progress Consensus Meter Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
          <span>Strong Bearish (0)</span>
          <span style={{ color: signalColor, fontWeight: 700 }}>{agreement}</span>
          <span>Strong Bullish (100)</span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          borderRadius: '4px',
          background: isDark ? '#1E2338' : '#E2E8F0',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${score}%`,
            height: '100%',
            background: `linear-gradient(90deg, #EF5350 0%, #F59E0B 45%, #10B981 100%)`,
            borderRadius: '4px',
            transition: 'width 0.6s ease'
          }} />
        </div>
      </div>

      {/* 3 Engine Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {/* Engine 1: Technical */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: '#818CF8' }}>
              <TrendingUp size={13} />
              <span>Technical</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: engines.technical?.score >= 60 ? '#10B981' : (engines.technical?.score <= 40 ? '#EF5350' : '#F59E0B') }}>
              {engines.technical?.score || 50}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
            {engines.technical?.drivers?.[0] || 'Neutral momentum'}
          </div>
        </div>

        {/* Engine 2: ML Model */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: '#38BDF8' }}>
              <Cpu size={13} />
              <span>XGBoost ML</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: engines.ml?.score >= 60 ? '#10B981' : (engines.ml?.score <= 40 ? '#EF5350' : '#F59E0B') }}>
              {engines.ml?.score || 50}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
            {engines.ml?.signal ? `Forecast: ${engines.ml.signal}` : 'Probability calibrated'}
          </div>
        </div>

        {/* Engine 3: Fundamentals & Gemini */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
          border: isDark ? '1px solid #1E2338' : '1px solid #E2E8F0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: '#A78BFA' }}>
              <ShieldCheck size={13} />
              <span>Fundamentals</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: engines.fundamental?.score >= 60 ? '#10B981' : (engines.fundamental?.score <= 40 ? '#EF5350' : '#F59E0B') }}>
              {engines.fundamental?.score || 50}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
            {engines.fundamental?.reasons?.[0] || 'Valuation aligned'}
          </div>
        </div>
      </div>
    </div>
  );
}
