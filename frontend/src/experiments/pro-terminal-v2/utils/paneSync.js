// Pro Terminal V2 — One-way pane synchronisation.
// The main chart is the source of truth: whenever the user pans/zooms it, the
// visible logical range is pushed to every registered sub-pane so Volume /
// RSI / MACD / AI Trend stay aligned with the price chart. Sub-panes are
// display-only strips (mouse scroll/scale disabled), so there is no feedback
// loop to guard against.

export function createPaneSync() {
  const panes = new Set();
  let main = null;
  let broadcasting = false;

  return {
    setMain(chart) {
      main = chart;
    },
    addPane(chart) {
      panes.add(chart);
    },
    removePane(chart) {
      panes.delete(chart);
    },
    /** Called by the main chart on visible-range changes. */
    onMainRange(range) {
      if (broadcasting || !main || !range) return;
      broadcasting = true;
      try {
        for (const pane of panes) {
          try {
            pane.timeScale().setVisibleLogicalRange(range);
          } catch { /* pane may be mid-teardown */ }
        }
      } finally {
        broadcasting = false;
      }
    },
  };
}
