import React from 'react';
import useStore from '../../store/useStore';

/**
 * LivePriceBadge — isolates the per-tick zustand subscription so the main
 * LiveChartView tree does NOT re-render on every tick (BTC aggTrade dozens/sec).
 * Only this tiny badge re-renders; the chart itself updates imperatively via
 * updateActiveCandle + rAF-coalesced ticks (render-free hot path).
 */
const LivePriceBadge = React.memo(function LivePriceBadge({ symbol, fallbackClose, children }) {
  const tick = useStore(s => s.livePrices?.[symbol]);
  const price = tick?.price ?? fallbackClose ?? null;
  const changePct = tick?.change_pct ?? null;
  const isLive = tick?.is_live ?? false;
  return children({ price, changePct, isLive, tick });
});

export default LivePriceBadge;
