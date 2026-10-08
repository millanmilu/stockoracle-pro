import React from 'react';
import toast from 'react-hot-toast';
import { smcEventMeta } from '../../utils/smc/smcAlerts';

/**
 * SmcProDetailPanel — expandable institutional view behind the SMC Pro card:
 * MTF confluence breakdown, per-component score bars, active zone tables,
 * baseline backtest stats, live SMC event feed and key-level export.
 */

const FONT = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif";

const SCORE_KEYS = [
  ['htfAlignment', 'MTF align'],
  ['liquiditySweep', 'Sweep'],
  ['structure', 'Structure'],
  ['displacement', 'Displacement'],
  ['fvg', 'FVG'],
  ['orderBlock', 'OB'],
  ['premiumDiscount', 'Prem/Disc'],
  ['session', 'Session'],
  ['volumeVolatility', 'Volume'],
];

function fmtPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

function Section({ title, children, accent = '#9ECBFF' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.53rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function ScoreBars({ score, weights }) {
  if (!score) return <div style={{ color: '#64748B', fontSize: '0.55rem' }}>No analysis yet</div>;
  const total = Math.max(1, Object.values(weights || {}).reduce((s, w) => s + Number(w || 0), 0));
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      {SCORE_KEYS.map(([key, label]) => {
        const weight = Number(weights?.[key] || 0);
        const raw = Number(score.components?.[key] ?? 0);
        const contribution = Math.round((raw * weight * 100) / total);
        const color = raw >= 0.75 ? '#34D399' : raw >= 0.4 ? '#FBBF24' : '#475569';
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 30px', gap: 6, alignItems: 'center', fontSize: '0.54rem' }}>
            <span style={{ color: '#8AA0C2' }}>{label}</span>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(raw * 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
            </div>
            <span style={{ color: '#CBD5E1', textAlign: 'right' }}>+{contribution}</span>
          </div>
        );
      })}
    </div>
  );
}

function MtfSection({ mtf }) {
  if (!mtf) return null;
  const tf = (factor) => mtf.timeframes?.find((t) => t.factor === factor);
  const rows = [
    ['1× (chart)', tf(1)],
    ['4× (struct)', tf(4)],
    ['16× (HTF)', tf(16)],
  ];
  const zone = mtf.priceInHtfZone;
  return (
    <Section title="MTF confluence">
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 40px', gap: '2px 8px', fontSize: '0.55rem' }}>
        {rows.map(([label, frame]) => (
          <React.Fragment key={label}>
            <span style={{ color: '#8AA0C2' }}>{label}</span>
            <span style={{
              color: frame?.bias === 'bullish' ? '#34D399' : frame?.bias === 'bearish' ? '#F87171' : '#64748B',
              fontWeight: 700,
            }}>
              {frame?.bias || 'neutral'}
            </span>
            <span style={{ color: '#64748B', textAlign: 'right' }}>{frame?.confidence ? `${frame.confidence}%` : '—'}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <span style={{ fontSize: '0.54rem', color: '#8AA0C2' }}>Alignment</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, Number(mtf.alignmentScore) || 0))}%`,
            height: '100%',
            borderRadius: 3,
            background: (mtf.alignmentScore || 0) >= 70 ? '#34D399' : (mtf.alignmentScore || 0) >= 40 ? '#FBBF24' : '#475569',
          }} />
        </div>
        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#E2E8F0' }}>{Math.round(mtf.alignmentScore || 0)}</span>
      </div>
      {mtf.structure && (
        <div style={{ fontSize: '0.54rem', color: '#8AA0C2', marginTop: 4 }}>
          HTF {mtf.structure.type} · <span style={{ color: mtf.structure.direction === 'bullish' ? '#34D399' : '#F87171', fontWeight: 700 }}>{mtf.structure.direction}</span>
          {mtf.premiumDiscount && ` · range ${fmtPrice(mtf.premiumDiscount.swingLow)}–${fmtPrice(mtf.premiumDiscount.swingHigh)}`}
        </div>
      )}
      {zone && (
        <div style={{ fontSize: '0.54rem', color: zone.direction === 'bullish' ? '#34D399' : '#F87171', marginTop: 2 }}>
          Price in HTF {zone.kind === 'ob' ? 'order block' : 'FVG'} ({fmtPrice(zone.bottom)}–{fmtPrice(zone.top)})
        </div>
      )}
    </Section>
  );
}

function zoneKind(zone) {
  const type = `${zone?.kind || ''} ${zone?.type || ''} ${zone?.rawType || ''}`;
  if (/order.?block|\bob\b/i.test(type)) return 'OB';
  if (/fair.?value.?gap|\bfvg\b|imbalance/i.test(type)) return 'FVG';
  return null;
}

function isTradeZone(zone) {
  return zoneKind(zone) !== null && Number.isFinite(Number(zone?.top)) && Number.isFinite(Number(zone?.bottom));
}

function ZonesTable({ analysis }) {
  const zones = (analysis?.mitigatedZones || []).filter(isTradeZone).slice(0, 6);
  if (!zones.length) return <div style={{ color: '#64748B', fontSize: '0.55rem' }}>No active zones</div>;
  return (
    <Section title="Active zones (top 6)">
      <div style={{ display: 'grid', gridTemplateColumns: '34px 42px 1fr 44px 40px', gap: '1px 6px', fontSize: '0.53rem' }}>
        <span style={{ color: '#5A6B84', fontWeight: 700 }}>Kind</span>
        <span style={{ color: '#5A6B84', fontWeight: 700 }}>Dir</span>
        <span style={{ color: '#5A6B84', fontWeight: 700 }}>Range</span>
        <span style={{ color: '#5A6B84', fontWeight: 700 }}>State</span>
        <span style={{ color: '#5A6B84', fontWeight: 700, textAlign: 'right' }}>Dist ATR</span>
        {zones.map((z, i) => {
          const dir = /bear|supply/i.test(`${z.direction} ${z.type} ${z.kind}`) ? 'bearish' : 'bullish';
          return (
            <React.Fragment key={`${z.time}-${z.top}-${i}`}>
              <span style={{ color: zoneKind(z) === 'OB' ? '#A5B4FC' : '#93C5FD' }}>{zoneKind(z)}</span>
              <span style={{ color: dir === 'bullish' ? '#34D399' : '#F87171' }}>{dir === 'bullish' ? 'Bull' : 'Bear'}</span>
              <span style={{ color: '#CBD5E1' }}>{fmtPrice(z.bottom)}–{fmtPrice(z.top)}</span>
              <span style={{ color: z.state === 'active' ? '#34D399' : z.state === 'partial' ? '#FBBF24' : '#94A3B8' }}>{z.state || 'active'}</span>
              <span style={{ color: '#64748B', textAlign: 'right' }}>{Number.isFinite(Number(z.distanceAtr)) ? Number(z.distanceAtr).toFixed(1) : '—'}</span>
            </React.Fragment>
          );
        })}
      </div>
    </Section>
  );
}

function BacktestSection({ backtest }) {
  if (!backtest) return <Section title="Baseline backtest"><span style={{ color: '#64748B', fontSize: '0.55rem' }}>Not enough candles (80+ needed)</span></Section>;
  const wr = Math.round(backtest.winRate * 100);
  return (
    <Section title="Baseline backtest (1.5R template)">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: '0.55rem' }}>
        <div>
          <div style={{ color: '#64748B' }}>Trades</div>
          <div style={{ color: '#E2E8F0', fontWeight: 700 }}>{backtest.trades}</div>
        </div>
        <div>
          <div style={{ color: '#64748B' }}>Win rate</div>
          <div style={{ color: wr >= 50 ? '#34D399' : '#FBBF24', fontWeight: 700 }}>{wr}%</div>
        </div>
        <div>
          <div style={{ color: '#64748B' }}>Avg R</div>
          <div style={{ color: backtest.avgR >= 0 ? '#34D399' : '#F87171', fontWeight: 700 }}>{backtest.avgR >= 0 ? '+' : ''}{backtest.avgR.toFixed(2)}R</div>
        </div>
        <div>
          <div style={{ color: '#64748B' }}>W / L streak</div>
          <div style={{ color: '#CBD5E1', fontWeight: 700 }}>{backtest.maxWinStreak} / {backtest.maxLossStreak}</div>
        </div>
      </div>
      <div style={{ fontSize: '0.5rem', color: '#5A6B84', marginTop: 3 }}>
        Structure-entry template on {backtest.trades} historical bars · open: {backtest.open} · not the live confluence setup
      </div>
    </Section>
  );
}

function EventsSection({ events }) {
  return (
    <Section title="SMC event feed">
      {!events.length ? (
        <div style={{ color: '#64748B', fontSize: '0.55rem' }}>No events since toggle-on</div>
      ) : (
        <div style={{ display: 'grid', gap: 2, maxHeight: 96, overflowY: 'auto' }}>
          {events.slice(0, 8).map((event) => {
            const meta = smcEventMeta(event.kind);
            return (
              <div key={`${event.id}-${event.at}`} style={{ fontSize: '0.53rem', display: 'flex', gap: 5 }}>
                <span>{meta.icon}</span>
                <span style={{ color: meta.color, fontWeight: 700 }}>{event.kind.replace('_', ' ')}</span>
                <span style={{ color: '#94A3B8' }}>{event.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function exportLevels(setup, backtest, symbol, interval) {
  if (!setup) return null;
  return {
    symbol,
    interval,
    direction: setup.direction,
    confirmed: !!setup.confirmed,
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    takeProfits: setup.takeProfits,
    risk: setup.risk,
    riskReward: setup.riskReward,
    backtest: backtest ? { trades: backtest.trades, winRate: Number(backtest.winRate.toFixed(3)), avgR: Number(backtest.avgR.toFixed(3)) } : null,
  };
}

export default function SmcProDetailPanel({ analysis, setup, backtest, events, symbol, interval, open, onClose }) {
  if (!open) return null;
  const weights = analysis?.settings?.score?.weights || analysis?.settings?.weights || {};

  const copyLevels = async () => {
    const payload = exportLevels(setup, backtest, symbol, interval);
    if (!payload) { toast.error('No setup levels to export yet'); return; }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success('SMC setup levels copied as JSON');
    } catch {
      toast.error('Clipboard blocked — export unavailable');
    }
  };

  const copyZones = async () => {
    const zones = (analysis?.mitigatedZones || []).filter(isTradeZone);
    if (!zones.length) { toast.error('No zones to export'); return; }
    const header = 'kind,direction,top,bottom,state,entryTime';
    const rows = zones.map((z) => [
      zoneKind(z),
      /bear|supply/i.test(`${z.direction} ${z.type} ${z.kind}`) ? 'bearish' : 'bullish',
      z.top, z.bottom, z.state || 'active', z.time ?? '',
    ].join(','));
    try {
      await navigator.clipboard.writeText([header, ...rows].join('\n'));
      toast.success(`${zones.length} zones copied as CSV`);
    } catch {
      toast.error('Clipboard blocked — export unavailable');
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        left: 12,
        zIndex: 45,
        width: 246,
        maxHeight: 'calc(100% - 24px)',
        overflowY: 'auto',
        padding: '8px 10px',
        borderRadius: 10,
        background: 'linear-gradient(180deg, rgba(10,15,24,0.96), rgba(15,21,34,0.92))',
        border: '1px solid rgba(96,165,250,0.32)',
        boxShadow: '0 10px 26px rgba(2,6,23,0.42)',
        backdropFilter: 'blur(8px)',
        color: '#E5F1FF',
        fontFamily: FONT,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.11em', color: '#9ECBFF', textTransform: 'uppercase' }}>
          SMC Pro · Detail
        </span>
        <button
          type="button"
          aria-label="Close SMC Pro detail panel"
          onClick={onClose}
          style={{ border: 0, background: 'transparent', color: '#8AA0C2', padding: 0, fontSize: 12, lineHeight: 1, cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <MtfSection mtf={analysis?.mtf} />
      <Section title="Score breakdown">
        <ScoreBars score={analysis?.score} weights={weights} />
      </Section>
      <ZonesTable analysis={analysis} />
      <BacktestSection backtest={backtest} />
      <EventsSection events={events} />

      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          type="button"
          onClick={copyLevels}
          style={{ flex: 1, border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.12)', color: '#9ECBFF', fontSize: '0.53rem', fontWeight: 700, padding: '4px 6px', borderRadius: 6, cursor: 'pointer' }}
        >
          Copy levels JSON
        </button>
        <button
          type="button"
          onClick={copyZones}
          style={{ flex: 1, border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.1)', color: '#B9C6DB', fontSize: '0.53rem', fontWeight: 700, padding: '4px 6px', borderRadius: 6, cursor: 'pointer' }}
        >
          Copy zones CSV
        </button>
      </div>
    </div>
  );
}
