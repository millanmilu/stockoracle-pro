import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { COLS_KEY } from './screenerLocal';
import { groupColumnsWithTicker } from './screenerColumns';

const loadColConfig = () => {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { order: parsed.order || {}, hidden: parsed.hidden || {}, widths: parsed.widths || {} };
      }
    }
  } catch (_) {}
  return { order: {}, hidden: {}, widths: {} };
};

// Column layout (order + visibility + widths) + CSV export for AdvancedScreener.
export function useScreenerColumns(columnGroup, processedResults) {
  // Column layout (order + visibility + widths), remembered per group
  const [colConfig, setColConfig] = useState(() => loadColConfig());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const persistCols = useCallback((next) => {
    setColConfig(next);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch (_) {}
  }, []);
  const groupAllCols = useMemo(() => groupColumnsWithTicker(columnGroup), [columnGroup]);
  const groupOrderedCols = useMemo(() => {
    const order = colConfig.order[columnGroup] || [];
    const known = new Set(groupAllCols.map((c) => c.key));
    const ordered = order.filter((k) => known.has(k)).map((k) => groupAllCols.find((c) => c.key === k));
    const rest = groupAllCols.filter((c) => !order.includes(c.key));
    return [...ordered, ...rest];
  }, [groupAllCols, colConfig.order, columnGroup]);
  const groupHidden = colConfig.hidden[columnGroup] || [];
  const groupVisibleKeys = groupHidden.length ? groupOrderedCols.map((c) => c.key).filter((k) => !groupHidden.includes(k)) : null;
  const toggleColumn = useCallback((key) => {
    const cur = colConfig.hidden[columnGroup] || [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    persistCols({ ...colConfig, hidden: { ...colConfig.hidden, [columnGroup]: next } });
  }, [persistCols, colConfig, columnGroup]);
  const moveColumn = useCallback((key, dir) => {
    const base = (colConfig.order[columnGroup] && colConfig.order[columnGroup].length
      ? colConfig.order[columnGroup]
      : groupAllCols.map((c) => c.key));
    const from = base.indexOf(key);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= base.length) return;
    const next = [...base];
    next.splice(from, 1);
    next.splice(to, 0, key);
    persistCols({ ...colConfig, order: { ...colConfig.order, [columnGroup]: next } });
  }, [persistCols, colConfig, columnGroup, groupAllCols]);
  // Transient, during the drag: state only. Persisting on every mousemove meant
  // ~60 synchronous localStorage writes per second while resizing a column.
  const resizeColumn = useCallback((key, width) => {
    setColConfig((prev) => ({ ...prev, widths: { ...prev.widths, [key]: width } }));
  }, []);
  // Committed once, on mouseup.
  const commitColumnWidth = useCallback((key, width) => {
    setColConfig((prev) => {
      const next = { ...prev, widths: { ...prev.widths, [key]: width } };
      try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, []);
  const resetWidths = useCallback(() => {
    persistCols({ ...colConfig, widths: {} });
    toast.success('Column widths reset.');
  }, [persistCols, colConfig]);

  // The exact columns the user currently sees (group order + visibility).
  // Exporting a hardcoded list while claiming "visible columns" made the CSV
  // disagree with the table.
  const exportColumns = useMemo(() => {
    const order = colConfig.order[columnGroup] || [];
    const ordered = order.length
      ? [...groupAllCols].sort((a, b) => {
          const ia = order.indexOf(a.key);
          const ib = order.indexOf(b.key);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        })
      : groupAllCols;
    return groupVisibleKeys ? ordered.filter((c) => groupVisibleKeys.includes(c.key)) : ordered;
  }, [groupAllCols, groupVisibleKeys, colConfig.order, columnGroup]);

  const handleExportCsv = (dataToExport = processedResults) => {
    if (dataToExport.length === 0) { toast.error('No data to export.'); return; }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Rank', ...exportColumns.map((c) => c.label)];
    const rows = [headers.map(esc).join(',')];
    dataToExport.forEach((r, i) => {
      // Raw values (not display-formatted) so the file stays analysable;
      // missing values are left blank rather than invented.
      const cells = exportColumns.map((c) => {
        const v = r[c.key];
        return v === null || v === undefined ? '' : v;
      });
      rows.push([r._rank ?? i + 1, ...cells].map(esc).join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `StockOracle_Screener_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${dataToExport.length} stocks × ${exportColumns.length} visible columns.`);
  };

  return {
    colConfig, groupOrderedCols, groupHidden, groupVisibleKeys,
    toggleColumn, moveColumn, resizeColumn, commitColumnWidth, resetWidths,
    showColumnMenu, setShowColumnMenu, handleExportCsv,
  };
}
