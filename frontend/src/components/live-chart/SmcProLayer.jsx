import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { analyzeSMC } from '../../utils/smc/engine/smcEngine';
import { loadSmcDisplay, subscribeSmcDisplay } from '../../utils/smcDisplayPrefs';
import { placeTags } from '../../utils/smc/selection/smcLabels';
import { selectVisibleSMC } from '../../utils/smc/selection/smcSelect';

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
// visible-range change and resize; analysis memoized on a bar signature.

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

export default function SmcProLayer({ chartCanvasRef, candles, symbol, interval, active }) {
  const wrapRef = useRef(null);
  const [prefs, setPrefs] = useState(() => loadSmcDisplay());
  const [, bumpRepaint] = useReducer((t) => (t + 1) % 1000000, 0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [visibleBars, setVisibleBars] = useState(0);

  useEffect(() => subscribeSmcDisplay(setPrefs), []);
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
  const lastCloseBucket = lastBar && Number.isFinite(Number(lastBar.close))
    ? Math.round(Number(lastBar.close) / Math.max(1, Number(lastBar.close) * 0.0005))
    : 0;
  const barSig = active
    ? `${Array.isArray(candles) ? candles.length : 0}|${lastBar?.time ?? ''}|${lastCloseBucket}`
    : 'off';

  const analysis = useMemo(() => {
    if (!active || !Array.isArray(candles) || candles.length < 20) return null;
    try {
      return analyzeSMC(candles);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barSig]);

  const selection = useMemo(() => {
    if (!active || !analysis) return null;
    try {
      return selectVisibleSMC({
        candles, analysis, symbol, interval,
        settings: {
          mode: prefs.mode || 'smart',
          maxOb: prefs.maxOb, maxFvg: prefs.maxFvg,
          maxLiquidity: prefs.maxLiquidity, maxStructure: prefs.maxStructure,
          minScore: prefs.minScore,
          visibleBars,
        },
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barSig, analysis, prefs.mode, prefs.maxOb, prefs.maxFvg, prefs.maxLiquidity, prefs.maxStructure, prefs.minScore, visibleBars]);

  if (!active || !analysis || !selection || size.w <= 0) {
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
  const yOf = (p) => {
    try {
      const y = series.priceToCoordinate(Number(p));
      return Number.isFinite(y) && y >= -50 && y <= plotH + 50 ? y : null;
    } catch { return null; }
  };

  const rects = [];
  const lines = [];
  const rawTags = [];

  // ---- Active zones (rectangles only; never render zone price rails) ----
  if (prefs.zones) {
    for (const z of selection.zones) {
      const rawX1 = xOf(z.createdTime);
      const rawX2 = xOf(lastTime);
      const x1 = Math.max(0, rawX1 ?? 0);
      const x2 = Math.min(plotW, rawX2 ?? plotW);
      const y1 = yOf(z.top);
      const y2 = yOf(z.bottom);
      if (y1 == null || y2 == null || x2 <= x1) continue;
      const st = (ZONE_STYLE[z.kind] || ZONE_STYLE.fvg)[z.direction === 'bearish' ? 'bearish' : 'bullish'];
      const faded = z.state === 'partial' || z.state === 'tested';
      rects.push({
        key: z.uid, x: x1, y: Math.min(y1, y2),
        w: Math.max(2, x2 - x1), h: Math.max(2, Math.abs(y2 - y1)),
        fill: st.fill, border: st.border, opacity: faded ? 0.55 : 1,
      });
      const lx = x1 + 7;
      const zoneHeight = Math.abs(y2 - y1);
      if (lx < plotW - 45 && zoneHeight >= 14) {
        rawTags.push({
          x: lx, y: Math.min(y1, y2) + 11,
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
    for (const l of selection.levels) {
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
    for (const e of selection.events) {
      if (e.kind === 'break') {
        const y = yOf(e.price);
        const rawX = xOf(e.createdTime);
        if (y == null) continue;
        const x1 = Math.min(plotW - 70, Math.max(0, rawX ?? plotW - 72));
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
        if (x == null || y == null) continue;
        const label = compactSMCLabel(e.label || e.swingType || '', '');
        if (label) rawTags.push({
          x: Math.min(plotW - 48, x + 4), y: y - 1, text: label,
          color: '#AAB4C3', anchor: 'start', kind: 'swing', key: `sw-${e.uid}`,
        });
      }
    }
  }

  // ---- Setup is primary: compact, separated labels + short aligned rails ----
  if (selection.setup) {
    const s = selection.setup;
    const x2 = plotW - 4;
    const x1 = Math.max(0, x2 - 42);
    const rails = [
      { p: s.entry, c: '#60A5FA', tag: `ENTRY ${fmtPx(s.entry)}` },
      { p: s.stopLoss, c: '#F87171', tag: `SL ${fmtPx(s.stopLoss)}` },
      ...s.takeProfits.slice(0, 2).map((tp, i) => ({ p: tp, c: '#34D399', tag: `TP${i + 1} ${fmtPx(tp)}` })),
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
      const yHigh = yOf(c?.high);
      const yLow = yOf(c?.low);
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
          const width = Math.max(34, Math.min(82, label.length * 5.7 + 14));
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
        {prefs.killzones && <Killzones xOf={xOf} w={w} h={h} />}
        {selection.mode === 'debug' && <DebugPanel debug={selection.debug} w={w} />}
      </svg>
    </div>
  );
}

function fmtPx(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '—';
  return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toFixed(2);
}

const SESSIONS = [
  { id: 'asia', label: 'Asia', startUTC: 0, endUTC: 7, fill: 'rgba(245,158,11,0.10)', text: '#F59E0B' },
  { id: 'london', label: 'London', startUTC: 7, endUTC: 12, fill: 'rgba(59,130,246,0.12)', text: '#60A5FA' },
  { id: 'ny', label: 'New York', startUTC: 12, endUTC: 21, fill: 'rgba(168,85,247,0.12)', text: '#C084FC' },
];

function Killzones({ xOf, w, h }) {
  const out = [];
  try {
    const nowUTC = Math.floor(Date.now() / 1000);
    const dayUTC = 86400;
    const todayStart = nowUTC - (nowUTC % dayUTC);
    for (let d = 13; d >= 0; d--) {
      const ds = todayStart - d * dayUTC;
      for (const s of SESSIONS) {
        let x0 = xOf(ds + s.startUTC * 3600);
        let x1 = xOf(ds + s.endUTC * 3600);
        // TradingView-style viewport clamping (same as zone rects): a session
        // touching the loaded window still paints — null means off-window on
        // that side (past data not backfilled yet, or the live session still
        // running into the future), NOT a reason to drop the whole block.
        // Both null = fully outside the data range → skip.
        if (x0 == null && x1 == null) continue;
        if (x0 == null) x0 = 0;
        if (x1 == null) x1 = w;
        const bx = Math.max(0, Math.min(x0, x1));
        const bw = Math.min(w, Math.max(x0, x1)) - bx;
        if (bw < 14) continue;
        out.push({ key: `kz-${ds}-${s.id}`, x: bx, w: bw, s });
      }
    }
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
