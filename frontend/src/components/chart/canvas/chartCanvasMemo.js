// Memoized: parent (LiveChartView) no longer re-renders per tick, but this
// guards the canvas tree (legend/overlays) against any residual prop churn.
// livePrice is throttled upstream (2s) for paper P&L lines; candles identity
// only changes on bucket rollover / history load, so shallow array compare is
// sufficient and cheap.
function chartCanvasPropsEqual(prev, next) {
  if (prev.candles !== next.candles) {
    if (!Array.isArray(prev.candles) || !Array.isArray(next.candles)) return false;
    if (prev.candles.length !== next.candles.length) return false;
    const a = prev.candles;
    const b = next.candles;
    if (a.length === 0) return true;
    // Compare first/last bar identity + close — full deep compare on 7k rows
    // per render would defeat the memo.
    const firstA = a[0]; const firstB = b[0];
    const lastA = a[a.length - 1]; const lastB = b[b.length - 1];
    if (firstA?.time !== firstB?.time || lastA?.time !== lastB?.time) return false;
    if (Number(lastA?.close) !== Number(lastB?.close)) return false;
    // Also check a few bars near the live edge — live ticks update the last
    // few candles, and a shallow first/last compare could miss those changes.
    const checkCount = Math.min(5, a.length);
    for (let i = 1; i <= checkCount; i++) {
      const idxA = a.length - i;
      const idxB = b.length - i;
      if (idxA < 0 || idxB < 0) break;
      if (a[idxA]?.time !== b[idxB]?.time) return false;
      if (Number(a[idxA]?.close) !== Number(b[idxB]?.close)) return false;
    }
  }
  const keys = ['interval', 'selectedSymbol', 'chartType', 'priceScaleMode', 'invertScale', 'showVolume', 'timezone', 'livePrice', 'liveChange', 'paperPosition'];
  for (const k of keys) {
    if (k === 'paperPosition') {
      const pa = prev.paperPosition; const pb = next.paperPosition;
      if (pa === pb) continue;
      if (!pa || !pb) return false;
      if (pa.ticker !== pb.ticker || Number(pa.current_price) !== Number(pb.current_price) || pa.shares !== pb.shares) return false;
      continue;
    }
    if (prev[k] !== next[k]) return false;
  }
  if (prev.activeIndicators !== next.activeIndicators || prev.hiddenIndicators !== next.hiddenIndicators || prev.indicatorOverrides !== next.indicatorOverrides || prev.customIndicators !== next.customIndicators) return false;
  // Callbacks are stable useCallbacks in the parent; ref-compare them.
  if (prev.onVisibleRangeChange !== next.onVisibleRangeChange) return false;
  if (prev.onCrosshairMove !== next.onCrosshairMove) return false;
  if (prev.onChartClick !== next.onChartClick) return false;
  if (prev.onNeedOlderData !== next.onNeedOlderData) return false;
  if (prev.onToggleHideIndicator !== next.onToggleHideIndicator) return false;
  if (prev.onRemoveIndicator !== next.onRemoveIndicator) return false;
  return true;
}

export { chartCanvasPropsEqual };
