import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useStore from '../store/useStore';
import {
  PRESETS,
  DEFAULT_FILTERS,
  DEFAULT_PAGE_SIZE,
  THRESHOLDS,
  INDEX_CONSTITUENTS
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
 * Advanced AI Stock Screener Orchestrator Component with Multi-Universe Selection
 */
export default function AdvancedScreener() {
  const { setSelectedSymbol, setActiveView } = useStore();
  const [allStocks, setAllStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Mode: 'table' | 'cards' | 'sectors'
  const [viewMode, setViewMode] = useState('table');

  // Auto Refresh State (every 30s)
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshTimer, setAutoRefreshTimer] = useState(30);
  const timerRef = useRef(null);

  // Universe & Filter States
  const [universe, setUniverse] = useState(DEFAULT_FILTERS.universe);
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

  // Fetch full stock universe from backend
  const fetchData = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    api.get('/api/screener/advanced?universe=NIFTY%20100')
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length > 0) {
          setAllStocks(r.data);
        } else {
          return api.get('/api/screener').then((bRes) => {
            if (Array.isArray(bRes.data)) setAllStocks(bRes.data);
          });
        }
      })
      .catch((err) => {
        return api.get('/api/screener')
          .then((bRes) => {
            if (Array.isArray(bRes.data)) setAllStocks(bRes.data);
          })
          .catch(() => {
            const msg = err.response?.data?.detail || err.message || 'Failed to load screener data.';
            setError(msg);
            if (!isBackground) toast.error(msg);
          });
      })
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  }, []);

  // Initial fetch on mount
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
      setPage(1);
      toast.success(`Applied preset: ${targetPreset.label}`);
    }
  }, []);

  // Reset Filters Handler
  const handleResetFilters = useCallback(() => {
    setUniverse(DEFAULT_FILTERS.universe);
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
      universe !== 'NIFTY 50' ||
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
  }, [universe, sector, signal, minRsi, maxRsi, volumeSpike, near52High, near52Low, minScore, search, preset]);

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

  // Filter stocks by Selected Universe
  const universeStocks = useMemo(() => {
    const targetTickers = INDEX_CONSTITUENTS[universe] || INDEX_CONSTITUENTS['NIFTY 50'];
    if (!targetTickers || universe === 'NIFTY 100') return allStocks;
    return allStocks.filter((r) => targetTickers.includes(r.ticker));
  }, [allStocks, universe]);

  // CSV Export Handler
  const handleExportCsv = useCallback(() => {
    if (!universeStocks.length) {
      toast.error('No stocks to export');
      return;
    }
    const header = 'Ticker,Name,Sector,Price,Change%,Trend,AI Score,Signal,Target 7D,Stop Loss,RSI,Volume Ratio,52W High,52W Low\n';
    const lines = universeStocks.map((r) =>
      `"${r.ticker || ''}","${r.name || ''}","${r.sector || ''}",${r.price || 0},${r.change || 0},"${r.trend || ''}",${r.ai_score || 0},"${r.signal || ''}",${r.target_price_7d || ''},${r.stop_loss || ''},${r.rsi ?? ''},${r.volume_ratio ?? ''},${r.high_52w ?? ''},${r.low_52w ?? ''}`
    ).join('\n');

    const blob = new Blob([header + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockoracle_screener_${universe.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${universeStocks.length} stocks from ${universe} to CSV`);
  }, [universeStocks, universe]);

  // KPI Metrics Calculation for Selected Universe
  const stats = useMemo(() => {
    const total = universeStocks.length;
    const bullish = universeStocks.filter((r) => r.signal === 'buy' || r.trend === 'BULLISH').length;
    const volumeSurges = universeStocks.filter((r) => (r.volume_ratio || 0) >= THRESHOLDS.VOLUME_SURGE_RATIO).length;
    const oversold = universeStocks.filter((r) => (r.rsi || 50) < THRESHOLDS.RSI_OVERSOLD).length;
    const avgScore = total
      ? (universeStocks.reduce((acc, r) => acc + (r.ai_score || 0), 0) / total).toFixed(0)
      : 0;
    return { total, bullish, volumeSurges, oversold, avgScore };
  }, [universeStocks]);

  // Instant reactive client-side filtering & sorting (0ms latency)
  const filteredAndSortedRows = useMemo(() => {
    let list = [...universeStocks];

    // 1. Sector Filter
    if (sector !== 'All') {
      list = list.filter((r) => String(r.sector || '').toLowerCase() === sector.toLowerCase());
    }

    // 2. Signal Filter
    if (signal !== 'All') {
      list = list.filter((r) => String(r.signal || '').toLowerCase() === signal.toLowerCase());
    }

    // 3. Min Score
    if (minScore > 0) {
      list = list.filter((r) => (r.ai_score ?? 0) >= minScore);
    }

    // 4. RSI Range
    if (minRsi > 0 || maxRsi < 100) {
      list = list.filter((r) => r.rsi == null || (r.rsi >= minRsi && r.rsi <= maxRsi));
    }

    // 5. Volume Spike
    if (volumeSpike) {
      list = list.filter((r) => (r.volume_ratio || 0) >= THRESHOLDS.VOLUME_SURGE_RATIO);
    }

    // 6. Near 52W High
    if (near52High) {
      list = list.filter((r) => r.high_52w && (r.price >= r.high_52w * 0.95));
    }

    // 7. Near 52W Low
    if (near52Low) {
      list = list.filter((r) => r.low_52w && (r.price <= r.low_52w * 1.05));
    }

    // 8. Search query
    const q = (search || '').trim().toUpperCase();
    if (q) {
      list = list.filter((r) => {
        const matchTicker = r.ticker ? String(r.ticker).toUpperCase().includes(q) : false;
        const matchName = r.name ? String(r.name).toUpperCase().includes(q) : false;
        return matchTicker || matchName;
      });
    }

    // 9. Sorting
    list.sort((a, b) => {
      let valA = a[sortBy] ?? 0;
      let valB = b[sortBy] ?? 0;
      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [universeStocks, sector, signal, minScore, minRsi, maxRsi, volumeSpike, near52High, near52Low, search, sortBy, sortDir]);

  // Paginated Slice
  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedRows.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedRows, page, pageSize]);

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

      {/* Sector Distribution Panel */}
      {viewMode === 'sectors' && (
        <ScreenerSectorChart
          rows={universeStocks}
          selectedSector={sector}
          onSelectSector={setSector}
        />
      )}

      {/* 1-Click Presets */}
      <ScreenerPresets
        activePreset={preset}
        onSelectPreset={handleSelectPreset}
      />

      {/* Filter Controls Panel (with Index Universe Selector) */}
      <ScreenerFilters
        universe={universe}
        setUniverse={(u) => {
          setUniverse(u);
          setSector('All');
          setPage(1);
        }}
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

      {/* Error Notice */}
      {error && (
        <div style={{ color: '#F43F5E', background: 'rgba(244,63,94,0.1)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" className="screener-btn screener-btn-refresh" onClick={() => fetchData(false)}>
            Retry
          </button>
        </div>
      )}

      {/* Pagination Controls Top */}
      {viewMode !== 'sectors' && (
        <ScreenerPagination
          totalItems={filteredAndSortedRows.length}
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
      {filteredAndSortedRows.length > pageSize && viewMode !== 'sectors' && (
        <ScreenerPagination
          totalItems={filteredAndSortedRows.length}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      )}
    </div>
  );
}
