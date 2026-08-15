import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useStore from '../store/useStore';
import {
  PRESETS,
  DEFAULT_FILTERS,
  DEFAULT_PAGE_SIZE,
  THRESHOLDS
} from '../constants/screenerConfig';

import ScreenerHeader from './screener/ScreenerHeader';
import ScreenerKpiCards from './screener/ScreenerKpiCards';
import ScreenerPresets from './screener/ScreenerPresets';
import ScreenerFilters from './screener/ScreenerFilters';
import ScreenerTable from './screener/ScreenerTable';
import ScreenerCardGrid from './screener/ScreenerCardGrid';
import ScreenerSectorChart from './screener/ScreenerSectorChart';
import ScreenerPagination from './screener/ScreenerPagination';
import './screener/Screener.css';

/**
 * Advanced AI Stock Screener Orchestrator Component
 */
export default function AdvancedScreener() {
  const { setSelectedSymbol, setActiveView } = useStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Mode: 'table' | 'cards' | 'sectors'
  const [viewMode, setViewMode] = useState('table');

  // Auto Refresh State (every 30s)
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshTimer, setAutoRefreshTimer] = useState(30);
  const timerRef = useRef(null);

  // Filter States
  const [preset, setPreset] = useState(DEFAULT_FILTERS.preset);
  const [sector, setSector] = useState(DEFAULT_FILTERS.sector);
  const [signal, setSignal] = useState(DEFAULT_FILTERS.signal);
  const [minRsi, setMinRsi] = useState(DEFAULT_FILTERS.minRsi);
  const [maxRsi, setMaxRsi] = useState(DEFAULT_FILTERS.maxRsi);
  const [volumeSpike, setVolumeSpike] = useState(DEFAULT_FILTERS.volumeSpike);
  const [near52High, setNear52High] = useState(DEFAULT_FILTERS.near52High);
  const [near52Low, setNear52Low] = useState(DEFAULT_FILTERS.near52Low);
  const [minScore, setMinScore] = useState(DEFAULT_FILTERS.minScore);
  const [sortBy, setSortBy] = useState(DEFAULT_FILTERS.sortBy);
  const [sortDir, setSortDir] = useState(DEFAULT_FILTERS.sortDir);
  const [search, setSearch] = useState(DEFAULT_FILTERS.search);
  const [page, setPage] = useState(DEFAULT_FILTERS.page);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Fetch screener data from API
  const fetchData = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      ...(sector !== 'All' && { sector }),
      ...(signal !== 'All' && { signal }),
      min_rsi: minRsi,
      max_rsi: maxRsi,
      volume_spike: volumeSpike,
      near_52w_high: near52High,
      near_52w_low: near52Low,
      min_score: minScore,
      sort_by: sortBy,
      sort_dir: sortDir,
    });

    api.get(`/api/screener/advanced?${params}`)
      .then((r) => {
        setRows(Array.isArray(r.data) ? r.data : []);
      })
      .catch((err) => {
        const msg = err.response?.data?.detail || 'Failed to load screener data.';
        setError(msg);
        if (!isBackground) toast.error(msg);
      })
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  }, [sector, signal, minRsi, maxRsi, volumeSpike, near52High, near52Low, minScore, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live Auto-Refresh polling interval
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoRefreshTimer(30);
      return;
    }

    timerRef.current = setInterval(() => {
      setAutoRefreshTimer((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  // Preset Selection Handler
  const handleSelectPreset = useCallback((presetId) => {
    setPreset(presetId);
    setSector('All');
    setSearch('');
    const targetPreset = PRESETS.find((p) => p.id === presetId);
    if (targetPreset) {
      const { filter } = targetPreset;
      setSignal(filter.signal);
      setMinRsi(filter.minRsi);
      setMaxRsi(filter.maxRsi);
      setVolumeSpike(filter.volumeSpike);
      setNear52High(filter.near52High);
      setNear52Low(filter.near52Low);
      setMinScore(filter.minScore);
      toast.success(`Applied preset: ${targetPreset.label}`);
    }
  }, []);

  // Reset Filters Handler
  const handleResetFilters = useCallback(() => {
    setPreset('all');
    setSector(DEFAULT_FILTERS.sector);
    setSignal(DEFAULT_FILTERS.signal);
    setMinRsi(DEFAULT_FILTERS.minRsi);
    setMaxRsi(DEFAULT_FILTERS.maxRsi);
    setVolumeSpike(DEFAULT_FILTERS.volumeSpike);
    setNear52High(DEFAULT_FILTERS.near52High);
    setNear52Low(DEFAULT_FILTERS.near52Low);
    setMinScore(DEFAULT_FILTERS.minScore);
    setSearch('');
    setPage(1);
    toast.success('Filters reset to default');
  }, []);

  // Check if any filter is actively modified
  const isFiltered = useMemo(() => {
    return (
      sector !== 'All' ||
      signal !== 'All' ||
      minRsi > 0 ||
      maxRsi < 100 ||
      volumeSpike ||
      near52High ||
      near52Low ||
      minScore > 0 ||
      search.trim().length > 0 ||
      preset !== 'all'
    );
  }, [sector, signal, minRsi, maxRsi, volumeSpike, near52High, near52Low, minScore, search, preset]);

  // Column Sort Handler
  const handleSort = useCallback((field) => {
    setSortBy((prevSortBy) => {
      if (prevSortBy === field) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        return field;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  // Stock Row Click Handler -> Opens Chart
  const handleSelectStock = useCallback((ticker) => {
    if (!ticker) return;
    setSelectedSymbol(ticker);
    setActiveView('Live Chart');
  }, [setSelectedSymbol, setActiveView]);

  // CSV Export Handler
  const handleExportCsv = useCallback(() => {
    if (!rows.length) {
      toast.error('No rows to export');
      return;
    }
    const header = 'Ticker,Name,Sector,Price,Change%,Trend,AI Score,Signal,Target 7D,Stop Loss,RSI,Volume Ratio,52W High,52W Low\n';
    const lines = rows.map((r) =>
      `"${r.ticker || ''}","${r.name || ''}","${r.sector || ''}",${r.price || 0},${r.change || 0},"${r.trend || ''}",${r.ai_score || 0},"${r.signal || ''}",${r.target_price_7d || ''},${r.stop_loss || ''},${r.rsi ?? ''},${r.volume_ratio ?? ''},${r.high_52w ?? ''},${r.low_52w ?? ''}`
    ).join('\n');

    const blob = new Blob([header + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockoracle_screener_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} stocks to CSV`);
  }, [rows]);

  // KPI Metrics Calculation (Memoized)
  const stats = useMemo(() => {
    const total = rows.length;
    const bullish = rows.filter((r) => r.signal === 'buy' || r.trend === 'BULLISH').length;
    const volumeSurges = rows.filter((r) => (r.volume_ratio || 0) >= THRESHOLDS.VOLUME_SURGE_RATIO).length;
    const oversold = rows.filter((r) => (r.rsi || 50) < THRESHOLDS.RSI_OVERSOLD).length;
    const avgScore = total
      ? (rows.reduce((acc, r) => acc + (r.ai_score || 0), 0) / total).toFixed(0)
      : 0;
    return { total, bullish, volumeSurges, oversold, avgScore };
  }, [rows]);

  // Filter and Paginate rows (Memoized for zero render lag)
  const filteredRows = useMemo(() => {
    const q = (search || '').trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const matchTicker = r.ticker ? String(r.ticker).toUpperCase().includes(q) : false;
      const matchName = r.name ? String(r.name).toUpperCase().includes(q) : false;
      return matchTicker || matchName;
    });
  }, [rows, search]);

  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, pageSize]);

  return (
    <div className="screener-container">
      {/* Header with View Switcher, Auto-Scan & Actions */}
      <ScreenerHeader
        onExportCsv={handleExportCsv}
        onRefresh={() => fetchData(false)}
        loading={loading}
        viewMode={viewMode}
        setViewMode={setViewMode}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        autoRefreshTimer={autoRefreshTimer}
      />

      {/* KPI Cards Bar */}
      <ScreenerKpiCards stats={stats} />

      {/* Sector Distribution Panel (When selected or visible) */}
      {viewMode === 'sectors' && (
        <ScreenerSectorChart
          rows={rows}
          selectedSector={sector}
          onSelectSector={setSector}
        />
      )}

      {/* 1-Click Presets */}
      <ScreenerPresets
        activePreset={preset}
        onSelectPreset={handleSelectPreset}
      />

      {/* Filter Controls Panel */}
      <ScreenerFilters
        sector={sector}
        setSector={setSector}
        signal={signal}
        setSignal={setSignal}
        minRsi={minRsi}
        setMinRsi={setMinRsi}
        maxRsi={maxRsi}
        setMaxRsi={setMaxRsi}
        volumeSpike={volumeSpike}
        setVolumeSpike={setVolumeSpike}
        near52High={near52High}
        setNear52High={setNear52High}
        near52Low={near52Low}
        setNear52Low={setNear52Low}
        minScore={minScore}
        setMinScore={setMinScore}
        search={search}
        setSearch={setSearch}
        onResetFilters={handleResetFilters}
        isFiltered={isFiltered}
      />

      {/* Error Message */}
      {error && (
        <div style={{ color: '#F43F5E', background: 'rgba(244,63,94,0.1)', padding: 12, borderRadius: 8 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Pagination Controls Top */}
      {viewMode !== 'sectors' && (
        <ScreenerPagination
          totalItems={filteredRows.length}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      )}

      {/* Main View: Table vs Card Grid vs Sector Chart */}
      {viewMode === 'table' ? (
        <ScreenerTable
          rows={paginatedRows}
          loading={loading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={handleSelectStock}
        />
      ) : viewMode === 'cards' ? (
        <ScreenerCardGrid
          rows={paginatedRows}
          loading={loading}
          onSelect={handleSelectStock}
        />
      ) : (
        <ScreenerTable
          rows={paginatedRows}
          loading={loading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={handleSelectStock}
        />
      )}

      {/* Bottom Pagination */}
      {filteredRows.length > pageSize && viewMode !== 'sectors' && (
        <ScreenerPagination
          totalItems={filteredRows.length}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      )}
    </div>
  );
}
