/**
 * StockOracle Pro — SMC Pro event alerts.
 *
 * Pure diff over two consecutive analyzeSMC() results plus a small React hook
 * that surfaces newly detected SMC events (BOS/CHoCH breaks, liquidity
 * sweeps, FVG fills, OB invalidations) as toasts and keeps a rolling feed
 * for the detail panel.
 */

import React from 'react';
import toast from 'react-hot-toast';

function latestBreak(analysis) {
  const bos = analysis?.swings?.bos;
  return Array.isArray(bos) && bos.length ? bos[bos.length - 1] : null;
}

function lastSweep(analysis) {
  const sweeps = analysis?.liquidity?.sweeps;
  return Array.isArray(sweeps) && sweeps.length ? sweeps[sweeps.length - 1] : null;
}

function count(list) {
  return Array.isArray(list) ? list.length : 0;
}

/**
 * Diff two consecutive analyses into new events. Pure — no state.
 * @param {Object|null} previous previous analysis (or null = first run, no events)
 * @param {Object|null} next current analysis
 * @returns {Array} [{ id, kind, text, time }]
 */
export function diffSmcEvents(previous, next) {
  if (!previous || !next) return [];
  const events = [];

  const prevBreak = latestBreak(previous);
  const nextBreak = latestBreak(next);
  if (nextBreak && (!prevBreak || nextBreak.index !== prevBreak.index || nextBreak.time !== prevBreak.time)) {
    const type = String(nextBreak.type || 'BOS').toUpperCase();
    events.push({
      id: `break-${nextBreak.time ?? nextBreak.index}-${type}`,
      kind: /choch|mss/i.test(type) ? 'choch' : 'bos',
      text: `${type} (${nextBreak.direction === 'bearish' ? 'bearish' : 'bullish'}) @ ${Number(nextBreak.price)?.toFixed(2)}`,
      time: nextBreak.time,
    });
  }

  const prevSweep = lastSweep(previous);
  const nextSweep = lastSweep(next);
  if (nextSweep && (!prevSweep || nextSweep.sweptIndex !== prevSweep.sweptIndex)) {
    events.push({
      id: `sweep-${nextSweep.sweptIndex}-${nextSweep.price ?? nextSweep.time ?? ''}`,
      kind: 'sweep',
      text: `Liquidity sweep (${nextSweep.direction === 'bearish' ? 'buy-side' : 'sell-side'})`,
      time: nextSweep.time,
    });
  }

  const prevFvg = count(previous?.fvgs?.gaps);
  const nextFvg = count(next?.fvgs?.gaps);
  if (nextFvg < prevFvg) {
    events.push({
      id: `fvg-fill-${nextFvg}-${previous?.summary?.score ?? ''}`,
      kind: 'fvg_fill',
      text: `FVG filled (${prevFvg - nextFvg} gap${prevFvg - nextFvg > 1 ? 's' : ''} closed)`,
      time: next?.session?.time ?? null,
    });
  }

  const prevOb = count(previous?.orderBlocks?.blocks);
  const nextOb = count(next?.orderBlocks?.blocks);
  if (nextOb < prevOb) {
    events.push({
      id: `ob-invalidated-${nextOb}-${previous?.summary?.score ?? ''}`,
      kind: 'ob_invalidated',
      text: `Order block invalidated (${prevOb - nextOb} removed)`,
      time: next?.session?.time ?? null,
    });
  }

  return events;
}

const KIND_META = {
  bos: { icon: '📈', color: '#94A3B8' },
  choch: { icon: '⚠️', color: '#F59E0B' },
  sweep: { icon: '🎯', color: '#FBBF24' },
  fvg_fill: { icon: '🧩', color: '#93C5FD' },
  ob_invalidated: { icon: '🚫', color: '#F87171' },
};

export function smcEventMeta(kind) {
  return KIND_META[kind] || { icon: '•', color: '#94A3B8' };
}

/**
 * React hook: watch consecutive analyses and toast new SMC events.
 * Returns the rolling feed (newest first, capped) for the detail panel.
 */
export function useSmcEventAlerts({ analysis, symbol, interval, enabled = true, isReplaying = false, feedCap = 20 }) {
  const [feed, setFeed] = React.useState([]);
  const prevRef = React.useRef(null);
  const lastEmitRef = React.useRef({}); // kind → epoch ms cooldown

  React.useEffect(() => {
    if (!enabled || isReplaying) return undefined;
    const previous = prevRef.current;
    prevRef.current = analysis;
    if (!analysis) return undefined;

    let events = [];
    try {
      events = diffSmcEvents(previous, analysis);
    } catch {
      return undefined;
    }
    if (!events.length) return undefined;

    const now = Date.now();
    const COOLDOWN_MS = 20000;
    const fresh = events.filter((event) => {
      const last = lastEmitRef.current[event.kind] || 0;
      if (now - last < COOLDOWN_MS) return false;
      lastEmitRef.current[event.kind] = now;
      return true;
    });
    if (!fresh.length) return undefined;

    setFeed((current) => [...fresh.map((event) => ({ ...event, at: now, symbol, interval })), ...current].slice(0, feedCap));
    for (const event of fresh) {
      try {
        toast.success(`SMC ${event.kind.replace('_', ' ')} · ${symbol} ${interval}: ${event.text}`, {
          id: event.id,
          duration: 6000,
        });
      } catch {}
    }
    return undefined;
  }, [analysis, enabled, isReplaying, symbol, interval, feedCap]);

  return feed;
}

export default { diffSmcEvents, smcEventMeta, useSmcEventAlerts };
