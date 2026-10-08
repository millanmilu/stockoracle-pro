import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { analyzeSMC } from '../../utils/smc/engine/smcEngine';
import { detectSession } from '../../utils/smc/engine/sessionDetector';
import { loadSmcDisplay, subscribeSmcDisplay } from '../../utils/smcDisplayPrefs';
import { placeTags } from '../../utils/smc/selection/smcLabels';
import { selectVisibleSMC } from '../../utils/smc/selection/smcSelect';
import { snapshotSMCCandles } from '../../utils/smc/engine/smcSnapshot';
import { cloneSetup, advanceSetup } from '../../utils/smc/engine/setupLifecycle';
import { backtestSetup } from '../../utils/smc/engine/setupBacktest';
import { useSmcEventAlerts } from '../../utils/smc/smcAlerts';
import { SmcProSummaryCard } from './ChartFloaters';
import SmcProDetailPanel from './SmcProDetailPanel';

// --- SmcProLayer: SMART SMC visualization (detection ≠ rendering) ---
//
// The engine may detect hundreds of objects; this layer paints ONLY what
// selectVisibleSMC() releases for the active display mode (smart/minimal/
// full/debug). Rules enforced here:
//   - no full-width lines: BOS segments run break-bar → +14 bars; liquidity/
//     setup rails run anchor-bar → live edge (never from bar zero)
//   - every tag passes through the collision placer (priority wins, losers
//     shift then drop — never stacked)
//   - candles stay dominant: thin lines, translucent fills, compact tags
// Click-through SVG above canvas (z 30, under drawings); repaints on candles,
// visible-range change and resize; analysis uses a shared candle snapshot.

const FONT = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif";
const KZ_H = 22;

const ZONE_STYLE = {
  ob: {
    bullish: { fill: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.42)', text: '#34D399' },
    bearish: { fill: 'rgba(239,83,80,0.08)', border: 'rgba(239,83,80,0.42)', text: '#F87171' },
  },
  fvg: {
    bullish: { fill: 'rgba(96,165,250,0.065)', border: 'rgba(96,165,250,0.34)', text: '#93C5FD' },
    bearish: { fill: 'rgba(96,165,250,0.065)', border: 'rgba(96,165,250,0.34)', text: '#93C5FD' },
  },
};

function compactSMCLabel(label, fallback = 'SMC') {
  const t = String(label || fallback || 'SMC');
  if (/bullish_ob|demand/i.test(t)) return 'Bull OB';
  if (/bearish_ob|supply/i.test(t)) return 'Bear OB';
  if (/fvg/i.test(t)) return 'FVG';
  if (/bos/i.test(t)) return 'BOS';
  if (/choch|mss/i.test(t)) return 'CHoCH';
  const compact = t.replace(/[^A-Za-z0-9 ]+/g, '').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
  return compact.length > 9 ? compact.slice(0, 9) : compact || fallback;
}

function shortZoneLabel(z) {
  return compactSMCLabel(z?.label || z?.rawType || z?.kind || '');
}

export default function SmcProLayer({ chartCanvasRef, candles, symbol, interval, active, indicatorOverrides = {}, activeCandleRef, isReplaying }) {
  const [prefs, setPrefs] = useState(() => loadSmcDisplay());
  const [setup, setSetup] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(() => snapshotSMCCandles(candles));
  useEffect(() => subscribeSmcDisplay(setPrefs), []);
  useEffect(() => {
    if (!active || isReplaying) return undefined;
    const sample = () => setSnapshot((previous) => snapshotSMCCandles(candles, activeCandleRef?.current, previous));
    sample();
    // Local, bounded refresh: no per-tick subscription on the parent chart.
    const timer = setInterval(sample, 1000);
    return () => clearInterval(timer);
  }, [active, candles, activeCandleRef, isReplaying]);
  const snapshotCandles = useMemo(() => (
    isReplaying || snapshot.source !== candles ? snapshotSMCCandles(candles).candles : snapshot.candles
  ), [candles, isReplaying, snapshot]);
  const analysis = useMemo(() => {
    if (!active || snapshotCandles.length < 20) return null;
    try {
      const obPoolSize = prefs.mode === 'debug' ? 50 : Math.max(8, (Number(prefs.maxOb) || 1) * 4);
      const fvgPoolSize = prefs.mode === 'debug' ? 50 : Math.max(8, (Number(prefs.maxFvg) || 1) * 4);
      const rawWindow = Number(indicatorOverrides.windowSize);
      const rawLookback = Number(indicatorOverrides.lookback);
      const windowSize = Number.isFinite(rawWindow) ? Math.max(2, Math.min(20, Math.floor(rawWindow))) : null;
      const lookback = Number.isFinite(rawLookback) ? Math.max(20, Math.min(500, Math.floor(rawLookback))) : null;
      const structure = windowSize == null ? {} : { windowSize };
      const liquidity = windowSize == null && lookback == null ? {} : {
        ...(windowSize == null ? {} : { windowSize }),
        ...(lookback == null ? {} : { lookback }),
      };
      const orderBlocks = {
        minDisplacement: prefs.minObDisplacement,
        maxActiveOBs: obPoolSize,
        ...(lookback == null ? {} : { lookback }),
      };
      return analyzeSMC(snapshotCandles, {
        structure,
        liquidity,
        orderBlocks,
        imbalance: { minGapAtr: prefs.minFvgAtr, maxGaps: fvgPoolSize },
      });
    } catch {
      return null;
    }
  }, [active, snapshotCandles, indicatorOverrides.windowSize, indicatorOverrides.lookback, prefs.mode, prefs.maxOb, prefs.maxFvg, prefs.minObDisplacement, prefs.minFvgAtr]);
  // Baseline backtest on the same snapshot — bounded template replay,
  // recomputed with the analysis cadence (1s max, only while active).
  const backtest = useMemo(() => {
    if (!active || snapshotCandles.length < 80) return null;
    try {
      return backtestSetup(snapshotCandles, { maxTrades: 120, horizon: 120 });
    } catch {
      return null;
    }
  }, [active, snapshotCandles]);
  // SMC event alerts: BOS/CHoCH breaks, sweeps, FVG fills, OB invalidations.
  const eventFeed = useSmcEventAlerts({ analysis, symbol, interval, enabled: active, isReplaying });
  if (!active) return null;
  return (
    <>
      <SmcProDrawingLayer chartCanvasRef={chartCanvasRef} candles={snapshotCandles}
        symbol={symbol} interval={interval} active={active} analysis={analysis} prefs={prefs}
        onSetupChange={setSetup} />
      {prefs.scoreCard !== false && (
        <SmcProSummaryCard summary={analysis} setup={setup} backtest={backtest}
          detailOpen={detailOpen} onToggleDetail={() => setDetailOpen((v) => !v)} />
      )}
      <SmcProDetailPanel analysis={analysis} setup={setup} backtest={backtest} events={eventFeed}
        symbol={symbol} interval={interval} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
}

function SmcProDrawingLayer({ chartCanvasRef, candles, symbol, interval, active, analysis, prefs, onSetupChange }) {
  const wrapRef = useRef(null);
  const [, bumpRepaint] = useReducer((t) => (t + 1) % 1000000, 0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [visibleBars, setVisibleBars] = useState(0);
  const [lockedSetup, setLockedSetup] = useState(null);
  const lockedSetupRef = useRef(null);
  const closedBarRef = useRef(null);

  useEffect(() => {
    bumpRepaint();
  }, [symbol, interval]);

  useEffect(() => {
    if (!active) return undefined;
    let unsub = null;
    try {
      const chart = chartCanvasRef?.current?.getChart?.();
      const handler = () => {
        bumpRepaint();
        const range = chart?.timeScale?.()?.getVisibleLogicalRange?.();
        if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
          setVisibleBars(Math.max(0, range.to - range.from + 1));
        }
      };
      chart?.timeScale()?.subscribeVisibleLogicalRangeChange(handler);
      handler();
      unsub = () => {
        try { chart?.timeScale()?.unsubscribeVisibleLogicalRangeChange(handler); } catch {}
      };
    } catch {}
    const el = wrapRef.current;
    let ro = null;
    try {
      if (el && typeof ResizeObserver !== 'undefined') {
        const measure = () => {
          const r = el.getBoundingClientRect();
          setSize((prev) => (Math.abs(prev.w - r.width) > 1 || Math.abs(prev.h - r.height) > 1
            ? { w: r.width, h: r.height } : prev));
        };
        measure();
        ro = new ResizeObserver(measure);
        ro.observe(el);
      }
    } catch {}
    return () => {
      try { unsub?.(); } catch {}
      try { ro?.disconnect(); } catch {}
    };
  }, [active, chartCanvasRef, symbol, interval]);

  const lastBar = Array.isArray(candles) && candles.length ? candles[candles.length - 1] : null;

  const selection = useMemo(() => {
    if (!active || !analysis) return null;
    try {
      const mode = prefs.mode || 'smart';
      const settings = mode === 'debug'
        ? { mode, minScore: 0, visibleBars }
        : {
          mode,
          maxOb: prefs.maxOb, maxFvg: prefs.maxFvg,
          maxLiquidity: prefs.maxLiquidity, maxStructure: prefs.maxStructure,
          minScore: mode === 'full' ? 0 : prefs.minScore,
          visibleBars,
        };
      return selectVisibleSMC({
        candles, analysis, symbol, interval, settings,
      });
    } catch {
      return null;
    }
  }, [active, candles, symbol, interval, analysis, prefs.mode, prefs.maxOb, prefs.maxFvg, prefs.maxLiquidity, prefs.maxStructure, prefs.minScore, visibleBars]);

  useEffect(() => {
    const latest = candles?.at?.(-1);
    if (!active || !latest || !Array.isArray(candles) || !candles.length) {
      lockedSetupRef.current = null;
      closedBarRef.current = null;
      setLockedSetup(null);
      onSetupChange?.(null);
      return;
    }

    const locked = lockedSetupRef.current;
    if (locked) {
      const { exit, setup: updated } = advanceSetup(locked, candles, selection?.setup);
      if (exit) {
        closedBarRef.current = latest.time;
        lockedSetupRef.current = null;
        setLockedSetup(null);
        onSetupChange?.(null);
      } else {
        if (updated !== locked.setup) {
          locked.setup = updated;
          setLockedSetup(updated);
        }
        onSetupChange?.(locked.setup);
      }
      return;
    }

    // Once a setup exits, wait for the next candle before accepting a new one.
    // This prevents a live wick from closing one setup and opening another on
    // the same bar with freshly recalculated levels.
    if (closedBarRef.current === latest.time) {
      onSetupChange?.(null);
      return;
    }

    const candidate = selection?.setup;
    if (!candidate || !Array.isArray(candidate.takeProfits) || candidate.takeProfits.length < 1) {
      onSetupChange?.(null);
      return;
    }

    const frozen = cloneSetup(candidate);
    lockedSetupRef.current = {
      setup: frozen,
      baseline: { time: latest.time, high: latest.high, low: latest.low },
    };
    setLockedSetup(frozen);
    onSetupChange?.(frozen);
  }, [active, candles, onSetupChange, selection]);

  const renderSetup = closedBarRef.current === lastBar?.time
    ? null
    : (lockedSetup || selection?.setup || null);
  const renderSelection = selection ? { ...selection, setup: renderSetup } : selection;

  if (!active || !analysis || !renderSelection || size.w <= 0) {
    return <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }} />;
  }

  let chart = null;
  let series = null;
  try {
    chart = chartCanvasRef?.current?.getChart?.();
    series = chartCanvasRef?.current?.getCandleSeries?.();
  } catch {}
  if (!chart || !series) {
    return <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }} />;
  }

  const { w, h } = size;
  const plotH = prefs.killzones ? Math.max(0, h - KZ_H) : h;
  const plotW = (() => {
    try {
      const width = chart.timeScale()?.width?.();
      return Number.isFinite(width) && width > 0 ? Math.min(width, w) : Math.max(0, w - 56);
    } catch {
      return Math.max(0, w - 56);
    }
  })();
  const lastTime = lastBar?.time;
  const xOf = (t) => {
    try {
      const x = chart.timeScale().timeToCoordinate(t);
      return Number.isFinite(x) ? x : null;
    } catch { return null; }
  };
  const rawYOf = (p) => {
    try {
      const y = series.priceToCoordinate(Number(p));
      return Number.isFinite(y) ? y : null;
    } catch { return null; }
  };
  const yOf = (p) => {
    const y = rawYOf(p);
    return y != null && y >= 4 && y <= plotH - 4 ? y : null;
  };

  const rects = [];
  const lines = [];
  const rawTags = [];

  // ---- Active zones (rectangles only; never render zone price rails) ----
  if (prefs.zones) {
    for (const z of renderSelection.zones) {
      const rawX1 = xOf(z.createdTime);
      const rawX2 = xOf(lastTime);
      const x1 = Math.max(0, rawX1 ?? 0);
      const x2 = Math.min(plotW, rawX2 ?? plotW);
      const ry1 = rawYOf(z.top);
      const ry2 = rawYOf(z.bottom);
      if (ry1 == null || ry2 == null || x2 <= x1) continue;
      const topY = Math.min(ry1, ry2);
      const botY = Math.max(ry1, ry2);
      if (botY < 0 || topY > plotH) continue;
      const y1 = Math.max(0, topY);
      const y2 = Math.min(plotH, botY);
      const st = (ZONE_STYLE[z.kind] || ZONE_STYLE.fvg)[z.direction === 'bearish' ? 'bearish' : 'bullish'];
      const faded = z.state === 'partial' || z.state === 'tested';
      rects.push({
        key: z.uid, x: x1, y: y1,
        w: Math.max(2, x2 - x1), h: Math.max(2, y2 - y1),
        fill: st.fill, border: st.border, opacity: faded ? 0.55 : 1,
      });
      const lx = x1 + 7;
      const zoneHeight = y2 - y1;
      if (lx < plotW - 45 && zoneHeight >= 14) {
        rawTags.push({
          x: lx, y: y1 + 11,
          text: shortZoneLabel(z),
          color: st.text,
          anchor: 'start', kind: z.kind, key: `zt-${z.uid}`,
          width: Math.max(34, shortZoneLabel(z).length * 5.7 + 14), height: 16,
        });
      }
    }
  }

  // ---- Major active liquidity (short rails); sweeps use compact markers ----
  if (prefs.liquidity) {
    for (const l of renderSelection.levels) {
      const y = yOf(l.price);
      if (y == null) continue;
      const x2 = plotW - 3;
      const swept = l.state === 'swept';
      const color = swept ? '#FBBF24' : (l.color || '#787B86');
      const x1 = swept ? Math.max(0, x2 - 34) : Math.max(0, x2 - 150);
      lines.push({
        key: `liq-${l.uid}`, x1, x2, y, color, dashed: !swept, width: swept ? 1.8 : 1.1,
      });
      const label = swept ? 'SWEEP' : /pdh|pwh|bsl/i.test(`${l.rawType} ${l.label}`) ? 'BSL' : 'SSL';
      rawTags.push({
        x: Math.max(0, x1 - (swept ? 42 : 38)), y: y - 1,
        text: label, color, anchor: 'start',
        kind: swept ? 'sweep' : 'liquidity', key: `liq-tag-${l.uid}`, width: label.length * 5.7 + 14,
      });
    }
  }

  // ---- Confirmed structure: short local markers, MSS/CHoCH ranked highest ----
  if (prefs.structure) {
    for (const e of renderSelection.events) {
      if (e.kind === 'break') {
        const y = yOf(e.price);
        const rawX = xOf(e.createdTime);
        if (y == null || rawX == null || rawX < -40 || rawX > plotW - 16) continue;
        const x1 = Math.min(plotW - 70, Math.max(0, rawX));
        const x2 = Math.min(plotW - 3, x1 + (/mss|choch/i.test(e.breakType) ? 66 : 48));
        const important = /mss|choch/i.test(e.breakType);
        const color = e.color || (important ? '#F59E0B' : '#94A3B8');
        lines.push({
          key: `br-${e.uid}`, x1, x2, y,
          color, dashed: !important, width: important ? 1.8 : 1.1,
        });
        const label = compactSMCLabel(e.breakType || 'BOS', 'BOS');
        rawTags.push({
          x: Math.min(plotW - 48, x2 + 4), y: y - 1, text: label,
          color, anchor: 'start', kind: important ? 'mss' : 'structure', key: `bt-${e.uid}`,
        });
      } else {
        const x = xOf(e.createdTime);
        const y = yOf(e.price);
        if (x == null || y == null || x < 4 || x > plotW - 48) continue;
        const label = compactSMCLabel(e.label || e.swingType || '', '');
        if (label) rawTags.push({
          x: Math.min(plotW - 48, x + 4), y: y - 1, text: label,
          color: '#AAB4C3', anchor: 'start', kind: 'swing', key: `sw-${e.uid}`,
        });
      }
    }
  }

  // ---- Setup is primary: compact, separated labels + short aligned rails ----
  if (prefs.setup && renderSelection.setup) {
    const s = renderSelection.setup;
    const x2 = plotW - 4;
    const x1 = Math.max(0, x2 - 42);
    const rails = [
      { p: s.entry, c: '#60A5FA', tag: `${s.confirmed ? '' : 'PLAN '}ENTRY ${fmtPx(s.entry)}` },
      { p: s.stopLoss, c: '#F87171', tag: `${s.confirmed ? '' : 'PLAN '}SL ${fmtPx(s.stopLoss)}` },
      ...s.takeProfits.slice(0, 3).map((tp, i) => ({
        p: tp, c: '#34D399', tag: `${s.confirmed ? '' : 'PLAN '}TP${i + 1} ${fmtPx(tp)}`,
      })),
    ];
    for (const r of rails) {
      const y = yOf(r.p);
      if (y == null) continue;
      lines.push({ key: `sp-${r.tag}`, x1, x2, y, color: r.c, dashed: r.c !== '#60A5FA', width: 1.35 });
      rawTags.push({
        x: Math.max(2, x1 - 114), y: y - 1, text: r.tag, color: r.c,
        anchor: 'start', kind: 'setupLevel', key: `setup-tag-${r.tag}`,
        width: Math.min(110, r.tag.length * 5.7 + 14),
      });
    }
  }

  const visibleRange = chart.timeScale()?.getVisibleLogicalRange?.();
  const candleAreas = [];
  if (visibleRange) {
    const from = Math.max(0, Math.floor(visibleRange.from));
    const to = Math.min(candles.length - 1, Math.ceil(visibleRange.to));
    for (let i = from; i <= to; i++) {
      const c = candles[i];
      const x = xOf(c?.time);
      const yHigh = rawYOf(c?.high);
      const yLow = rawYOf(c?.low);
      if (x == null || yHigh == null || yLow == null) continue;
      candleAreas.push({ left: x - 3, right: x + 3, top: Math.min(yHigh, yLow) - 2, bottom: Math.max(yHigh, yLow) + 2 });
    }
  }
  const tags = placeTags(rawTags, {
    bounds: { left: 2, right: plotW - 2, top: 8, bottom: plotH - 4 },
    reserved: [...candleAreas, { left: 8, right: Math.min(220, plotW - 4), top: 8, bottom: 136 }],
  });

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }}>
        {rects.map((r) => (
          <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} rx={3}
            fill={r.fill} stroke={r.border} strokeWidth={1} opacity={r.opacity} />
        ))}
        {lines.map((l) => (
          <line key={l.key} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y}
            stroke={l.color} strokeWidth={l.width || 1.2} strokeDasharray={l.dashed ? '5 4' : undefined} opacity={0.85} />
        ))}
        {tags.map((t) => {
          const label = String(t.text || '');
          const maxWidth = t.kind === 'setupLevel' ? 126 : 82;
          const width = Math.max(34, Math.min(maxWidth, label.length * 5.7 + 14));
          const x = t.anchor === 'start' ? t.x - 2 : t.x - width / 2;
          const arrow = t.anchor === 'start' ? [x + width, t.y - 7, x + width + 6, t.y - 1, x + width, t.y + 5] : [x, t.y - 7, x - 6, t.y - 1, x, t.y + 5];
          return (
            <g key={t.key}>
              <polygon points={arrow.join(' ')} fill="rgba(7,11,20,0.9)" stroke={t.color} strokeWidth={0.8} />
              <rect x={x} y={t.y - 10} width={width} height={16} rx={5}
                fill="rgba(7,11,20,0.9)" stroke={t.color} strokeWidth={0.85} />
              <text x={t.anchor === 'start' ? x + 8 : x + width / 2} y={t.y + 2} textAnchor={t.anchor === 'start' ? 'start' : 'middle'}
                fontFamily={FONT} fontSize={8.6} fontWeight={800} letterSpacing={0.2} fill={t.color} opacity={0.98}>
                {label}
              </text>
            </g>
          );
        })}
        {prefs.killzones && <Killzones candles={candles} visibleRange={visibleRange} xOf={xOf} plotW={plotW} h={h} />}
        {renderSelection.mode === 'debug' && <DebugPanel debug={renderSelection.debug} w={w} />}
      </svg>
    </div>
  );
}

function fmtPx(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '—';
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toPrecision(4);
}

const SESSION_META = {
  asian: { id: 'asia', label: 'Asia', fill: 'rgba(245,158,11,0.10)', text: '#F59E0B' },
  london: { id: 'london', label: 'London', fill: 'rgba(59,130,246,0.12)', text: '#60A5FA' },
  newYork: { id: 'ny', label: 'New York', fill: 'rgba(168,85,247,0.12)', text: '#C084FC' },
};

function Killzones({ candles, visibleRange, xOf, plotW, h }) {
  const out = [];
  try {
    if (!Array.isArray(candles) || candles.length < 2 || typeof candles[0]?.time !== 'number') return null;
    const from = visibleRange ? Math.max(0, Math.floor(visibleRange.from) - 2) : Math.max(0, candles.length - 300);
    const to = visibleRange ? Math.min(candles.length - 1, Math.ceil(visibleRange.to) + 2) : candles.length - 1;
    let halfBar = 3;
    if (to > from) {
      const xa = xOf(candles[from]?.time);
      const xb = xOf(candles[to]?.time);
      if (xa != null && xb != null && to > from) {
        halfBar = Math.max(1, Math.min(24, Math.abs(xb - xa) / (2 * (to - from))));
      }
    }
    let run = null;
    const flush = () => {
      if (!run) return;
      const x0 = xOf(run.startTime);
      const x1 = xOf(run.endTime);
      if (x0 != null && x1 != null) {
        const left = Math.max(0, Math.min(x0, x1) - halfBar);
        const right = Math.min(plotW, Math.max(x0, x1) + halfBar);
        const bw = right - left;
        if (bw >= 12) {
          out.push({ key: `kz-${run.startTime}-${run.meta.id}`, x: left, w: bw, s: run.meta });
        }
      }
      run = null;
    };
    for (let i = from; i <= to; i++) {
      const c = candles[i];
      if (!c || typeof c.time !== 'number') { flush(); continue; }
      const sess = detectSession(c);
      const meta = SESSION_META[sess] || null;
      const gapBreak = run && (c.time - run.endTime > 6 * 3600);
      if (!meta) {
        flush();
      } else if (!run || run.sess !== sess || gapBreak) {
        flush();
        run = { sess, meta, startTime: c.time, endTime: c.time };
      } else {
        run.endTime = c.time;
      }
    }
    flush();
  } catch {}
  if (!out.length) return null;
  const y = h - KZ_H;
  return (
    <g fontFamily={FONT}>
      {out.map((b) => (
        <g key={b.key}>
          <rect x={b.x} y={y} width={b.w} height={KZ_H} fill={b.s.fill} />
          {b.w > 44 && (
            <text x={b.x + b.w / 2} y={y + 14.5} textAnchor="middle"
              fontSize={10} fontWeight={700} fill={b.s.text} opacity={0.9}>
              {b.s.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function DebugPanel({ debug, w }) {
  const d = debug || {};
  const det = d.detected || {};
  const vis = d.visible || {};
  const rows = [
    `BOS/CHoCH: ${det.breaks ?? 0} → ${vis.breaks ?? 0}`,
    `Swings: ${det.swings ?? 0} → ${vis.swings ?? 0}`,
    `FVG: ${det.fvg ?? 0} → ${vis.fvg ?? 0}`,
    `OB: ${det.ob ?? 0} → ${vis.ob ?? 0}`,
    `Liquidity: ${det.liq ?? 0} → ${vis.liq ?? 0}`,
    `Merged: ${d.merged ?? 0} · setup ${d.setupSuppressed ? 'suppressed' : 'shown'}`,
  ];
  const bw = 208;
  const bh = 16 + rows.length * 15;
  return (
    <g fontFamily={FONT}>
      <rect x={w - bw - 8} y={8} width={bw} height={bh} rx={6}
        fill="rgba(8,13,24,0.88)" stroke="rgba(245,158,11,0.6)" strokeWidth={1} />
      <text x={w - bw} y={24} fontSize={10} fontWeight={700} fill="#F59E0B">SMC DEBUG detected → visible</text>
      {rows.map((r, i) => (
        <text key={i} x={w - bw} y={39 + i * 15} fontSize={10} fill="#D1D4DC">{r}</text>
      ))}
    </g>
  );
}
