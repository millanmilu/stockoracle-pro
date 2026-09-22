import React, { useEffect, useRef } from 'react';
import { computeVolumeProfile } from '../../utils/volumeProfile';

/**
 * StockOracle Pro — Visible-Range Volume Profile (TradingView VPVR parity).
 *
 * Full-pane canvas overlay (pointer-transparent) that paints, for the
 * currently visible bars only:
 *   - horizontal volume rows docked right (up/down split, teal/red),
 *   - POC / VAH / VAL dashed levels across the pane with price tags,
 *   - a soft value-area band.
 *
 * Self-updating: a single RAF loop re-reads the visible logical range and
 * redraws only when range, size, data or settings change (plus a slow
 * refresh so manual price-scale drags settle). All data comes from props —
 * pass the replay-capped candles and the profile follows replay for free.
 */

const UP = [38, 166, 154];
const DOWN = [239, 83, 80];
const INK = 'JetBrains Mono, monospace';

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function paint(canvas, series, profile, W, H, { panelWidth, showLevels, rightMargin = 0 }) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!profile || !profile.rows.length) return;

  const effectiveW = Math.max(100, W - rightMargin);
  const maxVol = Math.max(...profile.rows.map((r) => r.volume), 1e-9);
  const barArea = Math.max(40, Math.min(panelWidth, effectiveW * 0.32));
  const x0 = effectiveW - barArea;
  const toY = (p) => {
    try {
      const y = series.priceToCoordinate(Number(p));
      return y == null || Number.isNaN(y) ? null : y;
    } catch {
      return null;
    }
  };

  // Value-area band across the pane (clipped to chart plot width).
  if (showLevels) {
    const yVAH = toY(profile.vah);
    const yVAL = toY(profile.val);
    if (yVAH != null && yVAL != null) {
      ctx.fillStyle = 'rgba(41,98,255,0.055)';
      ctx.fillRect(0, Math.min(yVAH, yVAL), effectiveW, Math.abs(yVAL - yVAH));
    }
  }

  // Rows (right-docked histogram, up/down split).
  profile.rows.forEach((row) => {
    const yT = toY(row.high);
    const yB = toY(row.low);
    if (yT == null || yB == null) return;
    const h = Math.max(1, yB - yT - 0.6);
    if (h <= 0 || row.volume <= 0) return;
    const inVA = row.low >= profile.val - 1e-9 && row.high <= profile.vah + 1e-9;
    const alpha = inVA ? 0.85 : 0.32;
    const total = (row.volume / maxVol) * (barArea - 8);
    const upW = (row.upVolume / maxVol) * (barArea - 8);
    const y = yT + 0.3;
    if (total > 0.5) {
      ctx.fillStyle = rgba(DOWN, alpha);
      ctx.fillRect(x0 + (barArea - 8 - total), y, Math.max(0, total - upW), h);
      ctx.fillStyle = rgba(UP, alpha);
      ctx.fillRect(x0 + (barArea - 8 - upW), y, upW, h);
    }
  });

  // POC / VAH / VAL levels + tags.
  if (showLevels) {
    const levelsToDraw = [
      { price: profile.vah, color: '#EF5350', tag: 'VAH' },
      { price: profile.poc.price, color: '#2962FF', tag: 'POC' },
      { price: profile.val, color: '#26A69A', tag: 'VAL' },
    ];
    ctx.font = `700 10px ${INK}`;
    ctx.textBaseline = 'middle';
    for (const lv of levelsToDraw) {
      const y = toY(lv.price);
      if (y == null || y < -20 || y > H + 20) continue;
      ctx.strokeStyle = lv.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(effectiveW, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = `${lv.tag} ${Number(lv.price).toFixed(2)}`;
      const tw = ctx.measureText(label).width;
      const bx = effectiveW - tw - 12;
      const by = Math.max(8, Math.min(H - 20, y - 9));
      ctx.fillStyle = 'rgba(15,19,29,0.92)';
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw + 10, 18, 3);
      else ctx.rect(bx, by, tw + 10, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lv.color;
      ctx.fillText(label, bx + 5, by + 9);
    }
  }
}

export default function VolumeProfileOverlay({
  chartRef = null,
  candleRef = null,
  candles = [],
  active = false,
  hidden = false,
  rows = 24,
  valueAreaPercent = 70,
  panelWidth = 170,
  showLevels = true,
  isMobile = false,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ raf: null, lastKey: '', lastDraw: 0 });
  const liveRef = useRef({});
  // Live mirror so the RAF loop never acts on stale props.
  liveRef.current = { chartRef, candleRef, candles, active, hidden, rows, valueAreaPercent, panelWidth, showLevels, isMobile };

  useEffect(() => {
    const st = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const clear = () => {
      try {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      } catch (_) {}
    };

    const tick = () => {
      st.raf = requestAnimationFrame(tick);
      const v = liveRef.current;
      const chart = v.chartRef?.current;
      const series = v.candleRef?.current;
      const host = canvas.parentElement;
      const W = host ? host.clientWidth : 0;
      const H = host ? host.clientHeight : 0;
      if (!chart || !series || !v.active || v.hidden || !Array.isArray(v.candles) || v.candles.length === 0 || W <= 0 || H <= 0) {
        if (st.lastKey !== 'off') {
          st.lastKey = 'off';
          clear();
        }
        return;
      }
      // Calculate rightMargin so histogram and levels don't paint over the price scale.
      const chartCanvas = host ? host.querySelector('canvas') : null;
      const chartW = chartCanvas ? chartCanvas.clientWidth : 0;
      const rightMargin = (chartW > 0 && chartW < W) ? (W - chartW) : 55;
      const panelW = v.isMobile ? Math.min(100, v.panelWidth || 120) : (v.panelWidth || 170);

      let from = 0;
      let to = v.candles.length - 1;
      try {
        const r = chart.timeScale().getVisibleLogicalRange();
        if (r) {
          from = Math.max(0, Math.floor(r.from));
          to = Math.min(v.candles.length - 1, Math.ceil(r.to));
        }
      } catch (_) {}
      if (to < from) return;
      const last = v.candles[v.candles.length - 1];
      const key = `${from}|${to}|${W}|${H}|${rightMargin}|${v.candles.length}|${last?.time}|${Number(last?.close)}|${v.rows}|${v.valueAreaPercent}`;
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (key === st.lastKey && now - st.lastDraw < 800) return; // settled — slow refresh only
      st.lastKey = key;
      st.lastDraw = now;
      try {
        const profile = computeVolumeProfile(v.candles.slice(from, to + 1), {
          rows: v.rows,
          valueAreaPercent: v.valueAreaPercent,
        });
        paint(canvas, series, profile, W, H, {
          panelWidth: panelW,
          showLevels: v.showLevels,
          rightMargin,
        });
      } catch (_) {}
    };

    st.raf = requestAnimationFrame(tick);
    return () => {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    />
  );
}
