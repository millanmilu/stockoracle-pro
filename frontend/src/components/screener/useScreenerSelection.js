import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

// Row selection, inspection and navigation helpers for AdvancedScreener.
export function useScreenerSelection(processedResults, setSelectedSymbol, setActiveView) {
  // Selection / inspection
  const [selectedTickers, setSelectedTickers] = useState(new Set());
  const [inspectedStock, setInspectedStock] = useState(null);

  // No paging: the virtualized table renders the full filtered set, so the
  // header checkbox always toggles every matching row.
  const toggleSelectAll = useCallback(() => {
    setSelectedTickers((prev) => {
      const allSelected = processedResults.every((r) => prev.has(r.ticker));
      const next = new Set(prev);
      processedResults.forEach((r) => (allSelected ? next.delete(r.ticker) : next.add(r.ticker)));
      return next;
    });
  }, [processedResults]);

  // ── Stable handler identities ──
  // ScreenerTableRow is React.memo'd, but inline arrow props changed identity on
  // every render, so every visible row re-rendered on each live tick.
  const processedResultsRef = useRef(processedResults);
  useEffect(() => { processedResultsRef.current = processedResults; }, [processedResults]);

  const toggleSelect = useCallback((sym) => {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedTickers(new Set()), []);
  const inspectStock = useCallback((stock) => setInspectedStock(stock), []);
  const navigateChart = useCallback((sym) => {
    setSelectedSymbol(sym);
    setActiveView('Live Chart');
    const row = processedResultsRef.current.find((r) => r.ticker === sym);
    if (row && (row.rsi_14 ?? 50) < 30) toast.success('Chart opened — consider enabling RSI (screen flagged RSI < 30).');
  }, [setSelectedSymbol, setActiveView]);
  const navigateFundamentals = useCallback((sym) => {
    setSelectedSymbol(sym);
    setActiveView('Fundamentals');
  }, [setSelectedSymbol, setActiveView]);

  // Selection must track the visible result set: a ticker that dropped out of
  // the screen used to stay selected, so bulk actions (watchlist, paper trades)
  // silently operated on rows the user could no longer see.
  useEffect(() => {
    setSelectedTickers((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(processedResults.map((r) => r.ticker));
      const next = new Set();
      let changed = false;
      prev.forEach((t) => { if (live.has(t)) next.add(t); else changed = true; });
      return changed ? next : prev;
    });
  }, [processedResults]);

  return {
    selectedTickers, inspectedStock, setInspectedStock,
    toggleSelectAll, toggleSelect, clearSelection, inspectStock, navigateChart, navigateFundamentals,
  };
}
