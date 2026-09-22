import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp, Target, ShieldAlert } from 'lucide-react';
import { analyzeSignal } from '../../utils/aiSignalEngine';
import { toChartTime } from '../../utils/chartHelpers';
import { computeAIDashboardScores } from '../../utils/aiIndicatorEngine.js';
import { useStock } from '../../hooks/useStock';

const MTF_INTERVALS = [
  { id: '5m',  label: '5m'  },
  { id: '15m', label: '15m' },
  { id: '1h',  label: '1h'  },
  { id: '4h',  label: '4h'  },
  { id: '1d',  label: '1D'  },
];

const DIR_STYLE = {
  buy: { label: 'BUY', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  sell: { label: 'SELL', color: '#EF5350', bg: 'rgba(239,83,80,0.12)', border: 'rgba(239,83,80,0.35)' },
  neutral: { label: 'HOLD', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
};

function normalizeCandles(rawCandles, isIntraday) {
  if (!Array.isArray(rawCandles)) return [];
  return rawCandles
    .map((c) => {
      const t = toChartTime(c.date || c.time, isIntraday);
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      if (!t || [open, high, low, close].some((v) => isNaN(v) || v <= 0)) return null;
      return { time: t, open, high, low, close, volume: Number(c.volume || 0) };
    })
    .filter(Boolean)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

/**
 * AIDashboard — compact rule-based AI signal strip with multi-timeframe
 * alignment (1m → 1W). Shows "AI analysis unavailable" when inputs are missing.
 *
 * ML consensus (where a trained model exists) is surfaced separately by the
 * caller via `mlConsensus`.
 */
export default function AIDashboard({
  candles = [],
  symbol = '',
  interval = '1m',
  mlConsensus = null,
}) {
  const { fetchHistory } = useStock();
  const [expanded, setExpanded] = useState(false);
  const [mtf, setMtf] = useState({});
  const [mtfLoading, setMtfLoading] = useState(false);
  const runRef = useRef(false);

  // Current timeframe signal
  const signal = useMemo(() => analyzeSignal(candles), [candles]);

  // Advanced per-engine scores (real computed values, not static docs)
  const aiScores = useMemo(() => {
    try {
      return computeAIDashboardScores(candles);
    } catch {
      return { available: false };
    }
  }, [candles]);

  // Multi-timeframe alignment: fetch each interval and compute its signal.
  useEffect(() => {
    if (!symbol || runRef.current) return;
    runRef.current = true;
    setMtfLoading(true);

    let cancelled = false;
    (async () => {
      const results = {};
      await Promise.all(MTF_INTERVALS.map(async (tf) => {
        try {
          const res = await fetchHistory(symbol, tf.id, 'ALL');
          const normalized = normalizeCandles(res?.candles || [], tf.id !== '1d');
          if (normalized.length > 0) {
            results[tf.id] = analyzeSignal(normalized);
          }
        } catch {
          /* ignore a failed timeframe */
        }
      }));
      if (!cancelled) {
        setMtf(results);
        setMtfLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [symbol, fetchHistory]);

  const sym = symbol ? symbol : '—';
  const dir = DIR_STYLE[signal.direction] || DIR_STYLE.neutral;

  // Present MTF as "1m → 1W" strip (current 1m + fetched MTF)
  const mtfEntries = [
    { label: interval === '1d' ? 'D' : 'Now', sig: signal },
    ...MTF_INTERVALS.map((tf) => ({ label: tf.label, sig: mtf[tf.id] })),
  ].filter((e) => e.sig?.available);

  const alignment = useMemo(() => {
    const entries = mtfEntries.filter((e) => e.sig && e.sig.available && e.sig.direction !== 'neutral');
    if (!entries.length) return { label: 'N/A', pct: 0, note: 'No directional timeframes' };
    const bulls = entries.filter((e) => e.sig.direction === 'buy').length;
    const bears = entries.filter((e) => e.sig.direction === 'sell').length;
    const pct = Math.round((Math.max(bulls, bears) / entries.length) * 100);
    const dir = bulls > bears ? 'Bullish' : bulls < bears ? 'Bearish' : 'Mixed';
    return {
      label: dir,
      pct,
      note: `${bulls}↑ ${bears}↓ across ${entries.length} timeframes`,
    };
  }, [mtfEntries]);

  if (!signal.available) {
    return (
      <div style={unavailableStyle}>
        <BrainCircuit size={14} color="#64748B" />
        <span>AI analysis unavailable</span>
        {signal.missing.length > 0 && <span style={{ color: '#475569', fontSize: 10 }}>({signal.missing[0]})</span>}
      </div>
    );
  }

  return (
    <div style={{ ...shell, borderColor: dir.border }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <BrainCircuit size={14} color="#38BDF8" />
          <span style={{ color: '#94A3B8', fontSize: 11, fontWeight: 700 }}>AI SIGNAL</span>
          <span style={{ color: '#64748B', fontSize: 10 }}>{sym}</span>
        </div>

        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: dir.bg,
          border: `1px solid ${dir.border}`,
          color: dir.color,
          fontWeight: 800,
          fontSize: 11,
        }}>{dir.label} {signal.probability}%</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ color: '#94A3B8', fontSize: 10 }}>MTF</span>
          <span style={{ color: alignment.label === 'Bullish' ? '#10B981' : alignment.label === 'Bearish' ? '#EF5350' : '#F59E0B', fontSize: 11, fontWeight: 800 }}>
            {alignment.label} {alignment.pct}%
          </span>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            style={{ background: 'transparent', border: 0, color: '#64748B', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Key zones strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: expanded ? 8 : 0 }}>
        <Zone label="Entry" value={signal.entry} color="#F8FAFC" />
        <Zone label="Stop" value={signal.stopLoss} color="#EF5350" icon={<ShieldAlert size={11} />} />
        <Zone label="Target" value={signal.takeProfit} color="#10B981" icon={<Target size={11} />} />
        <Zone label="R:R" value={signal.riskReward != null ? `1:${signal.riskReward}` : '—'} color="#FBBF24" />
        <Zone
          label="Confluence"
          value={`${signal.confluence.buy}B / ${signal.confluence.sell}S / ${signal.confluence.neutral}N`}
          color="#94A3B8"
        />
      </div>

      {/* Advanced engine scores — live reads from every AI study */}
      {aiScores.available && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          <AIScoreChip label="TREND" value={aiScores.trend.available ? `${aiScores.trend.score > 0 ? '+' : ''}${aiScores.trend.score}` : '—'} title={aiScores.trend.label || 'n/a'} color={aiScores.trend.score > 20 ? '#10B981' : aiScores.trend.score < -20 ? '#EF5350' : '#F59E0B'} />
          <AIScoreChip label="MOM" value={aiScores.momentum.available ? `${aiScores.momentum.score > 0 ? '+' : ''}${aiScores.momentum.score}` : '—'} title={aiScores.momentum.label || 'n/a'} color={aiScores.momentum.score > 30 ? '#10B981' : aiScores.momentum.score < -30 ? '#EF5350' : '#A855F7'} />
          <AIScoreChip label="REGIME" value={aiScores.regime.available ? aiScores.regime.label : '—'} title={aiScores.regime.playbook || ''} color={aiScores.regime.label === 'TREND' ? '#10B981' : aiScores.regime.label === 'RANGE' ? '#F59E0B' : '#38BDF8'} />
          <AIScoreChip label="EXH" value={aiScores.exhaustion.available ? `${aiScores.exhaustion.score > 0 ? '+' : ''}${aiScores.exhaustion.score}` : '—'} title={aiScores.exhaustion.label || 'n/a'} color={Math.abs(aiScores.exhaustion.score) >= 60 ? '#EF5350' : '#94A3B8'} />
          <AIScoreChip label="BRK" value={aiScores.breakout.available ? aiScores.breakout.label : '—'} title={aiScores.breakout.impulse != null ? `impulse ${aiScores.breakout.impulse}` : ''} color={aiScores.breakout.label === 'SQUEEZE' ? '#F59E0B' : '#FB923C'} />
          <AIScoreChip label="S/R" value={`${aiScores.sr.supports.length}S/${aiScores.sr.resistances.length}R`} title="AI support / resistance zones" color="#F472B6" />
          <AIScoreChip label="PAT" value={aiScores.patterns.length ? aiScores.patterns.map((p) => p.name.split(' ')[0]).join(',') : '—'} title={aiScores.patterns.map((p) => `${p.name} ${p.direction} ${p.completion}%`).join(' · ') || 'no pattern'} color="#60A5FA" />
          <AIScoreChip label="FCST" value={aiScores.forecast.available ? aiScores.forecast.direction : '—'} title={`${aiScores.forecast.bars}-bar path`} color="#FBBF24" />
        </div>
      )}

      {/* Expanded detail: MTF alignment + WHY */}
      {expanded && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* MTF strip 1m → 1W */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, marginRight: 2 }}>MTF</span>
            {mtfEntries.map((entry) => {
              const d = DIR_STYLE[entry.sig.direction] || DIR_STYLE.neutral;
              return (
                <span key={entry.label} title={`${entry.label}: ${entry.sig.probability}%`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '1px 6px', borderRadius: 3,
                  background: d.bg, border: `1px solid ${d.border}`,
                  color: d.color, fontSize: 9, fontWeight: 800,
                }}>
                  {entry.label} {entry.sig.available ? entry.sig.probability : '—'}%
                </span>
              );
            })}
            {mtfLoading && <span style={{ color: '#475569', fontSize: 9 }}>…</span>}
          </div>

          {/* WHY explanations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700 }}>WHY?</span>
            {signal.why.map((reason, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: '#38BDF8', fontSize: 10, flexShrink: 0 }}>▸</span>
                <span style={{ color: '#CBD5E1', fontSize: 10, lineHeight: 1.4 }}>{reason}</span>
              </div>
            ))}
          </div>

          {mlConsensus && (
            <div style={{ fontSize: 9, color: '#475569', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: 4 }}>
              ML consensus: {mlConsensus.label ?? 'trained model available'} (surfaced separately)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Zone({ label, value, color, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
      <span style={{ color, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {icon}{value ?? '—'}
      </span>
    </div>
  );
}

function AIScoreChip({ label, value, title, color }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 7px', borderRadius: 3,
      background: 'rgba(56,189,248,0.07)',
      border: '1px solid rgba(56,189,248,0.22)',
      fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
    </span>
  );
}

const shell = {
  display: 'flex',
  flexDirection: 'column',
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(14, 19, 34, 0.92)',
  border: '1px solid rgba(148,163,184,0.18)',
  fontFamily: 'JetBrains Mono, monospace',
  width: '100%',
  boxSizing: 'border-box',
};

const unavailableStyle = {
  ...shell,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  color: '#64748B',
  fontSize: 11,
};