import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Sparkles, Play, RefreshCw, Search, X } from 'lucide-react';

import ScreenerHeaderBar from './screener/ScreenerHeaderBar';
import ScreenerKpiCards from './screener/ScreenerKpiCards';
import ScreenerSectorChart from './screener/ScreenerSectorChart';
import ScreenerBreadthBar from './screener/ScreenerBreadthBar';
import ScreenerFilters from './screener/ScreenerFilters';
import ScreenerFilterBuilder, { newGroup, compileBuilderToDsl } from './screener/ScreenerFilterBuilder';
import ScreenerTable from './screener/ScreenerTable';
import ScreenerPagination from './screener/ScreenerPagination';
import ScreenerFlyoutDrawer from './screener/ScreenerFlyoutDrawer';
import ScreenerBulkBar from './screener/ScreenerBulkBar';
import ScreenerBacktestModal from './screener/ScreenerBacktestModal';
import ScreenerSaveModal from './screener/ScreenerSaveModal';
import { INDEX_CONSTITUENTS } from '../constants/screenerConfig';
import { COLUMN_GROUPS, PREBUILT_SCREENS, RANK_OPTIONS, OVERVIEW_CARDS } from './screener/screenerColumns';
import { getWsUrl } from '../utils/api';

const ALL_UNIVERSE = 'ALL NSE';
const UNIVERSE_IDS = [ALL_UNIVERSE, ...Object.keys(INDEX_CONSTITUENTS)];

export default function AdvancedScreener() {
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);

  // Mode & drawer
  const [queryMode, setQueryMode] = useState('visual');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnGroup, setColumnGroup] = useState('overview');
  const [activeTab] = useState('all');

  // Universe / search / AI
  const [searchFilter, setSearchFilter] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // {formula_query, explanation, filters_preview, unavailable_notes, valid}

  // Sorting (single + multi)
  const [sortColumn, setSortColumn] = useState('market_cap_cr');
  const [sortDirection, setSortDirection] = useState('desc');
  const [multiSort, setMultiSort] = useState([]);
  const [rankBy, setRankBy] = useState('ai_consensus_score');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Visual sliders
  const [universe, setUniverse] = useState('ALL NSE');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [marketCapCat, setMarketCapCat] = useState('ALL');
  const [minRoce, setMinRoce] = useState(15);
  const [minRoe, setMinRoe] = useState(12);
  const [maxPe, setMaxPe] = useState(40);
  const [maxPb, setMaxPb] = useState(10);
  const [maxDebt, setMaxDebt] = useState(1.5);
  const [minSalesGrowth, setMinSalesGrowth] = useState(8);
  const [minProfitGrowth, setMinProfitGrowth] = useState(10);
  const [minRsi, setMinRsi] = useState(0);
  const [maxRsi, setMaxRsi] = useState(100);
  const [minVolRatio, setMinVolRatio] = useState(0.8);
  const [minAiScore, setMinAiScore] = useState(50);

  // Filter-builder groups (nested AND/OR/NOT)
  const [builderGroups, setBuilderGroups] = useState([newGroup()]);
  const [builderTopLogic, setBuilderTopLogic] = useState('AND');
  const [builderEnabled, setBuilderEnabled] = useState(false);

  // Formula
  const [formulaQuery, setFormulaQuery] = useState('MarketCap > 0 AND ROCE > 15 AND PE < 40');

  // Results / presets / overview
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [overview, setOverview] = useState({ cards: {}, breadth: {}, sectors: [], market_status: 'UNKNOWN', feed_live: false, total: 0 });
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);
  const [activePresetId, setActivePresetId] = useState('all-nse');
  const [activeCard, setActiveCard] = useState('total');

  // Selection / inspection
  const [selectedTickers, setSelectedTickers] = useState(new Set());
  const [inspectedStock, setInspectedStock] = useState(null);

  // Live ticks
  const [liveTicks, setLiveTicks] = useState({});
  const [wsState, setWsState] = useState('idle');
  const wsRef = useRef(null);
  const pendingTickersRef = useRef(null);

  // Refresh mode
  const [refreshMode, setRefreshMode] = useState('manual');
  const refreshTimer = useRef(null);

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const [holdingDays, setHoldingDays] = useState(20);
  const [sttRate, setSttRate] = useState(0.001);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertDraft, setAlertDraft] = useState({ ticker: '', type: 'rsi_below', value: '30' });

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/api/screener/screens');
        setPrebuiltTemplates(data.prebuilt_templates || []);
        setSavedScreens(data.saved_screens || []);
      } catch (err) {
        console.error('Failed to load screen presets', err);
      }
      try {
        const { data } = await api.get('/api/screener/overview');
        setOverview(data);
      } catch (err) {
        console.error('Failed to load screener overview', err);
      }
      runScreen('MarketCap > 0');
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Formula builders ──
  const buildVisualFormula = useCallback((sectorOverride = null) => {
    const sector = sectorOverride ?? selectedSector;
    let parts = [
      `ROCE > ${minRoce}`, `ROE > ${minRoe}`, `PE < ${maxPe}`, `PB < ${maxPb}`,
      `DebtToEquity < ${maxDebt}`, `SalesGrowth3Y > ${minSalesGrowth}`,
      `ProfitGrowth3Y > ${minProfitGrowth}`, `RSI14 > ${minRsi}`, `RSI14 < ${maxRsi}`,
      `VolumeRatio20D > ${minVolRatio}`, `AIConsensus > ${minAiScore}`
    ];
    if (sector !== 'ALL') parts.push(`Sector == '${sector}'`);
    if (marketCapCat !== 'ALL') parts.push(`MarketCapCat == '${marketCapCat}'`);
    return parts.join(' AND ');
  }, [minRoce, minRoe, maxPe, maxPb, maxDebt, minSalesGrowth, minProfitGrowth, minRsi, maxRsi, minVolRatio, minAiScore, selectedSector, marketCapCat]);

  const activeFormula = useMemo(() => {
    if (queryMode === 'formula') return formulaQuery;
    if (builderEnabled) return compileBuilderToDsl(builderGroups, builderTopLogic);
    return buildVisualFormula();
  }, [queryMode, formulaQuery, builderEnabled, builderGroups, builderTopLogic, buildVisualFormula]);

  useEffect(() => {
    if (queryMode === 'visual' && !builderEnabled) setFormulaQuery(buildVisualFormula());
    else if (queryMode === 'visual' && builderEnabled) setFormulaQuery(compileBuilderToDsl(builderGroups, builderTopLogic));
  }, [queryMode, builderEnabled, builderGroups, builderTopLogic, buildVisualFormula]);

  // Active filter chips derived from current formula AST-ish split (best-effort display)
  const activeChips = useMemo(() => {
    const f = queryMode === 'formula' ? formulaQuery : activeFormula;
    return f.split(/\s+(AND|OR)\s+/i).filter((t) => !/^(AND|OR)$/i.test(t.trim())).map((t) => t.trim()).filter(Boolean).slice(0, 12);
  }, [formulaQuery, activeFormula, queryMode]);

  // ── Run screen ──
  const runScreen = async (query = null, tickersOverride = undefined) => {
    setLoading(true);
    const activeQuery = query || activeFormula || 'MarketCap > 0';
    const activeTickers = tickersOverride !== undefined
      ? tickersOverride
      : (universe !== ALL_UNIVERSE && INDEX_CONSTITUENTS[universe] ? INDEX_CONSTITUENTS[universe] : null);
    try {
      const { data } = await api.post('/api/screener/query', {
        formula_query: activeQuery || 'MarketCap > 0',
        tickers: activeTickers,
        sort_by: sortColumn || 'market_cap_cr',
        sort_dir: sortDirection === 'asc' ? 'ASC' : 'DESC',
        limit: 1000,
        offset: 0
      });
      setResults(data.results || []);
    } catch (err) {
      console.error('Screener query error:', err);
      toast.error(err.response?.data?.detail || 'Screener query failed');
    } finally {
      setLoading(false);
    }
  };

  // ── WebSocket live ticks (event-driven; refresh modes only re-query) ──
  const connectWs = useCallback(() => {
    try { wsRef.current?.close(); } catch (_) {}
    setWsState('connecting');
    let ws;
    try {
      ws = new WebSocket(getWsUrl());
    } catch (_) {
      setWsState('offline');
      return null;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      setWsState('live');
      const pending = pendingTickersRef.current;
      if (pending && pending.length > 0) {
        try { ws.send(JSON.stringify({ subscribe: pending })); } catch (_) {}
        pendingTickersRef.current = null;
      }
    };
    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data);
        if (tick.ticker && tick.price) {
          setLiveTicks(prev => ({ ...prev, [tick.ticker]: { price: tick.price, change_pct: tick.change_pct, is_live: tick.is_live } }));
        }
      } catch (_) {}
    };
    ws.onclose = () => setWsState((s) => (s === 'live' ? 'reconnecting' : 'offline'));
    ws.onerror = () => setWsState('reconnecting');
    return ws;
  }, []);

  useEffect(() => {
    connectWs();
    return () => { try { wsRef.current?.close(); } catch (_) {} wsRef.current = null; };
  }, [connectWs]);

  useEffect(() => {
    if (!results || results.length === 0) return;
    const topTickers = results.slice(0, 50).map(r => r.ticker);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ subscribe: topTickers })); } catch (_) {}
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      pendingTickersRef.current = topTickers;
    } else {
      pendingTickersRef.current = topTickers;
      connectWs();
    }
  }, [results, connectWs]);

  // Refresh modes (polling only when explicitly chosen; realtime = event-driven WS)
  useEffect(() => {
    if (refreshTimer.current) { clearInterval(refreshTimer.current); refreshTimer.current = null; }
    const ms = refreshMode === '5s' ? 5000 : refreshMode === '10s' ? 10000 : refreshMode === '30s' ? 30000 : refreshMode === '1m' ? 60000 : null;
    if (ms) refreshTimer.current = setInterval(() => { runScreen(); }, ms);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMode]);

  // ── AI natural query with preview/edit ──
  const handleAiTranslate = async (applyImmediately = false) => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/api/screener/ai-parse', { prompt: aiPrompt });
      if (data.formula_query) {
        setAiPreview(data);
        if (applyImmediately || !data.filters_preview?.length) {
          setFormulaQuery(data.formula_query);
          setQueryMode('formula');
          setActivePresetId(null);
          setPage(1);
          runScreen(data.formula_query);
        }
        if ((data.unavailable_notes || []).length) {
          toast.error(data.unavailable_notes[0]);
        } else {
          toast.success(`AI Screen: ${data.formula_query}`);
        }
      } else {
        toast.error(data.parse_error || 'Could not generate formula.');
        setAiPreview(data);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI query error');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiPreview = () => {
    if (!aiPreview?.formula_query) return;
    setFormulaQuery(aiPreview.formula_query);
    setQueryMode('formula');
    setActivePresetId(null);
    setPage(1);
    runScreen(aiPreview.formula_query);
    setAiPreview(null);
  };

  // ── Backtest (exact screen conditions, never modified silently) ──
  const handleRunBacktest = async () => {
    setShowBacktestModal(true);
    setBacktestLoading(true);
    const activeQuery = queryMode === 'formula' ? formulaQuery : activeFormula;
    try {
      const { data } = await api.post('/api/screener/backtest', { formula_query: activeQuery, holding_period_days: holdingDays, stt_rate: sttRate });
      setBacktestResults(data);
      toast.success('Historical screen backtest completed!');
    } catch (err) {
      toast.error('Screen backtest failed.');
    } finally {
      setBacktestLoading(false);
    }
  };

  // ── Save screen (filters + columns + sorting + universe) ──
  const handleSaveScreen = async () => {
    if (!screenName.trim()) { toast.error('Please enter a screen name.'); return; }
    try {
      const activeQuery = queryMode === 'formula' ? formulaQuery : activeFormula;
      await api.post('/api/screener/screens', {
        name: `${screenName} [${columnGroup}|${sortColumn}:${sortDirection}|${universe}]`,
        formula_query: activeQuery, is_public: true,
      });
      toast.success('Screen saved successfully!');
      setShowSaveModal(false);
      setScreenName('');
      const res = await api.get('/api/screener/screens');
      setSavedScreens(res.data.saved_screens || []);
    } catch (err) {
      toast.error('Failed to save screen.');
    }
  };

  // ── Alert from screener (real smart-alerts API) ──
  const handleCreateAlert = async () => {
    const { ticker, type, value } = alertDraft;
    if (!ticker.trim()) { toast.error('Enter a ticker for the alert.'); return; }
    const num = Number(value);
    if (!isFinite(num)) { toast.error('Enter a numeric threshold.'); return; }
    try {
      const param = type.startsWith('rsi') ? { threshold: num } : type.startsWith('volume') ? { ratio: num } : { threshold: num };
      await api.post('/api/smart-alerts', { ticker: ticker.toUpperCase().trim(), alert_type: type, param_value: param });
      toast.success(`Alert created: ${ticker.toUpperCase()} ${type} ${num}`);
      setShowAlertModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create alert');
    }
  };

  const applyPreset = (id, query, name) => {
    setActivePresetId(id);
    setActiveCard('total');
    setFormulaQuery(query);
    setQueryMode('formula');
    setBuilderEnabled(false);
    setPage(1);
    runScreen(query);
    toast.success(`Applied: ${name}`);
  };

  const applyCard = (card) => {
    setActiveCard(card.id);
    if (!card.dsl) {
      setPage(1);
      runScreen('MarketCap > 0');
      return;
    }
    setFormulaQuery(card.dsl);
    setQueryMode('formula');
    setPage(1);
    runScreen(card.dsl);
  };

  const handleUniverseChange = (universeId) => {
    setUniverse(universeId);
    setPage(1);
    const tickers = universeId !== ALL_UNIVERSE && INDEX_CONSTITUENTS[universeId] ? INDEX_CONSTITUENTS[universeId] : null;
    runScreen(null, tickers);
  };

  const handleResetFilters = () => {
    setMinRoce(0); setMinRoe(0); setMaxPe(100); setMaxPb(25); setMaxDebt(3.0);
    setMinSalesGrowth(-10); setMinProfitGrowth(-10); setMinRsi(0); setMaxRsi(100);
    setMinVolRatio(0.5); setMinAiScore(30); setSelectedSector('ALL'); setMarketCapCat('ALL');
    setUniverse(ALL_UNIVERSE); setBuilderEnabled(false); setBuilderGroups([newGroup()]);
    setFormulaQuery('MarketCap > 0'); setActivePresetId('all-nse'); setActiveCard('total'); setPage(1);
    runScreen('MarketCap > 0', null);
    toast.success('Filters reset to default.');
  };

  const removeChip = (chip) => {
    const f = queryMode === 'formula' ? formulaQuery : activeFormula;
    const next = f.split(/\s+AND\s+/i).filter((t) => t.trim() !== chip).join(' AND ') || 'MarketCap > 0';
    setFormulaQuery(next);
    setQueryMode('formula');
    setPage(1);
    runScreen(next);
  };

  // ── Filter + multi-sort (client-side over last server query) ──
  const processedResults = useMemo(() => {
    let list = [...results];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(r => r.ticker?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.sector?.toLowerCase().includes(q));
    }
    if (multiSort.length > 0) {
      list.sort((a, b) => {
        for (const m of multiSort) {
          const va = a[m.key], vb = b[m.key];
          if (va == null && vb == null) continue;
          if (va == null) return 1;
          if (vb == null) return -1;
          let cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
          if (cmp !== 0) return m.dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    } else {
      list.sort((a, b) => {
        const valA = a[sortColumn], valB = b[sortColumn];
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (typeof valA === 'string') return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      });
    }
    // Rank numbers
    return list.map((r, i) => ({ ...r, _rank: i + 1 }));
  }, [results, searchFilter, sortColumn, sortDirection, multiSort]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedResults.slice(start, start + pageSize);
  }, [processedResults, page, pageSize]);

  const dataAsOf = useMemo(() => {
    let latest = null;
    results.forEach(r => {
      if (r.updated_at) {
        const d = new Date(r.updated_at);
        if (!isNaN(d) && (!latest || d > latest)) latest = d;
      }
    });
    return latest ? latest.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  }, [results]);

  const kpiStats = useMemo(() => {
    const cards = overview.cards && Object.keys(overview.cards).length ? overview.cards : null;
    if (cards) return { total: overview.total ?? processedResults.length, ...cards };
    let bullish = 0, volumeSurges = 0, oversold = 0, totalScore = 0;
    processedResults.forEach(r => {
      if (r.ai_signal === 'BUY' || r.ai_signal === 'STRONG BUY') bullish++;
      if ((r.volume_ratio_20d || 1) > 1.3) volumeSurges++;
      if ((r.rsi_14 || 50) < 38) oversold++;
      totalScore += (r.ai_consensus_score || 50);
    });
    return { total: processedResults.length, bullish, volumeSurges, oversold, avgScore: processedResults.length > 0 ? (totalScore / processedResults.length).toFixed(0) : 50 };
  }, [processedResults, overview]);

  const onSort = (col, evt) => {
    if (evt?.shiftKey) {
      setMultiSort((prev) => {
        const ex = prev.find((m) => m.key === col);
        if (ex) return prev.map((m) => (m.key === col ? { ...m, dir: m.dir === 'asc' ? 'desc' : 'asc' } : m));
        return [...prev.slice(0, 2), { key: col, dir: 'desc' }];
      });
      return;
    }
    setMultiSort([]);
    if (sortColumn === col) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('desc'); }
  };

  const rankByChange = (key) => {
    setRankBy(key);
    setSortColumn(key);
    setSortDirection(key === 'rsi_14' ? 'asc' : 'desc');
    setMultiSort([]);
    toast.success(`Ranked by ${RANK_OPTIONS.find((r) => r.id === key)?.label || key}`);
  };

  // Export visible columns only (current group); hidden columns are never exported
  const handleExportCsv = (dataToExport = processedResults) => {
    if (dataToExport.length === 0) { toast.error('No data to export.'); return; }
    const headers = ['Rank', 'Ticker', 'Name', 'Sector', 'Price', 'Chg%', 'RelVol', 'RSI', 'MACD Hist', 'EMA Align', 'ADX', 'ATR%', '52W Pos', 'Structure', 'Regime', 'AI Score', 'AI Conf', 'Signal'];
    const rows = [headers.join(',')];
    dataToExport.forEach((r, i) => {
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      rows.push([
        i + 1, esc(r.ticker), esc(r.name), esc(r.sector), r.close_price ?? '', r.change_1d_pct ?? '',
        r.volume_ratio_20d ?? '', r.rsi_14 ?? '', r.macd_hist ?? '', esc(r.ema_alignment ?? ''),
        r.adx_14 ?? '', r.atr_pct ?? '', r.pos_52w_pct ?? '', esc(r.structure_label ?? ''),
        esc(r.market_regime ?? ''), r.ai_consensus_score ?? '', r.ai_confidence_score ?? '', esc(r.ai_signal ?? ''),
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `StockOracle_Screener_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${dataToExport.length} stocks (visible columns)!`);
  };

  const handleAddWatchlist = (stock) => {
    try {
      const stored = JSON.parse(localStorage.getItem('stockoracle_custom_watchlist') || '[]');
      if (!stored.includes(stock.ticker)) {
        stored.push(stock.ticker);
        localStorage.setItem('stockoracle_custom_watchlist', JSON.stringify(stored));
        toast.success(`${stock.ticker} added to watchlist!`);
      } else {
        toast.error(`${stock.ticker} is already in your watchlist.`);
      }
    } catch (_) {
      toast.error('Failed to update watchlist.');
    }
  };

  const quickPills = [
    { id: 'all-nse', name: 'All NSE Equities', query: 'MarketCap > 0' },
    { id: 'high-roce', name: 'High ROCE (>20%)', query: 'ROCE > 20 AND DebtToEquity < 0.5' },
    { id: 'value-growth', name: 'Growth at Fair Value', query: 'ROCE > 18 AND PE < 28 AND DebtToEquity < 1.0' },
    { id: 'oversold', name: 'Oversold Momentum', query: 'RSI14 < 40 AND VolumeRatio20D > 1.1' },
    { id: 'ai-bulls', name: 'AI High Consensus', query: 'AIConsensus > 75 AND VolumeRatio20D > 1.0' },
    { id: 'low-debt', name: 'Low Debt Quality', query: 'DebtToEquity < 0.2 AND ROCE > 15' },
  ];

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%', boxSizing: 'border-box', background: '#030712', color: '#F1F5F9' }}>
      <ScreenerHeaderBar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        activeFilterCount={activeChips.length}
        dataAsOf={dataAsOf}
        marketStatus={overview.market_status || 'UNKNOWN'}
        feedLive={overview.feed_live}
        wsState={wsState === 'live' ? 'live' : wsState}
        scannedCount={overview.total || results.length}
        universe={universe}
        onUniverseChange={handleUniverseChange}
        universes={UNIVERSE_IDS}
        search={searchFilter}
        onSearch={(v) => { setSearchFilter(v); setPage(1); }}
        refreshMode={refreshMode}
        onRefreshMode={setRefreshMode}
        onExportCsv={() => handleExportCsv(processedResults)}
        onOpenSaveModal={() => setShowSaveModal(true)}
        onOpenBacktestModal={handleRunBacktest}
        onCreateAlert={() => setShowAlertModal(true)}
        onRefresh={() => runScreen()}
        loading={loading}
      />

      <ScreenerKpiCards stats={kpiStats} activeCard={activeCard} onSelect={applyCard} />

      <ScreenerBreadthBar breadth={overview.breadth?.total ? overview.breadth : null} />

      {/* AI Natural Query with preview/edit */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#080D1F', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A855F7', fontSize: '0.74rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
            <Sparkles size={15} /> AI Natural Query:
          </div>
          <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiTranslate(false)}
            placeholder="e.g. 'Find large cap stocks with RSI below 40, price above 200 EMA and unusual volume...'"
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.78rem', outline: 'none' }} />
          <button onClick={() => handleAiTranslate(false)} disabled={aiLoading} style={{ padding: '5px 14px', borderRadius: 6, background: '#6366F1', color: '#FFF', border: 'none', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            {aiLoading ? <RefreshCw size={12} className="spin" /> : <Play size={12} />} Generate
          </button>
        </div>
        {aiPreview && (
          <div style={{ background: '#060913', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.64rem', color: '#C084FC', fontWeight: 800, marginBottom: 4 }}>GENERATED FILTERS (editable before execution)</div>
            <div style={{ fontSize: '0.7rem', color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>{aiPreview.formula_query}</div>
            {(aiPreview.filters_preview || []).length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                {aiPreview.filters_preview.map((f, i) => (
                  <span key={i} style={{ fontSize: '0.62rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC', borderRadius: 5, padding: '2px 7px' }}>
                    {f.field} {f.operator} {String(f.value)}
                  </span>
                ))}
              </div>
            )}
            {(aiPreview.unavailable_notes || []).map((n, i) => (
              <div key={i} style={{ fontSize: '0.66rem', color: '#F59E0B', marginBottom: 3 }}>{n}</div>
            ))}
            {aiPreview.explanation && <div style={{ fontSize: '0.66rem', color: '#94A3B8', marginBottom: 6 }}>{aiPreview.explanation}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={applyAiPreview} style={{ padding: '4px 12px', borderRadius: 6, background: '#10B981', color: '#FFF', border: 'none', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}>Apply</button>
              <button onClick={() => { setFormulaQuery(aiPreview.formula_query); setQueryMode('formula'); }} style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>Edit as formula</button>
              <button onClick={() => setAiPreview(null)} style={{ padding: '4px 12px', borderRadius: 6, background: 'transparent', color: '#64748B', border: 'none', fontSize: '0.68rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Presets incl. 13 institutional templates */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, alignItems: 'center' }}>
        <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginRight: 2 }}>Presets:</span>
        {quickPills.map(p => (
          <button key={p.id} onClick={() => applyPreset(p.id, p.query, p.name)} style={pill(activePresetId === p.id)}>{p.name}</button>
        ))}
        {(prebuiltTemplates.length ? prebuiltTemplates : PREBUILT_SCREENS.map((t) => ({ id: t.id, name: t.name, formula_query: t.query }))).map(tpl => (
          <button key={tpl.id} onClick={() => applyPreset(tpl.id, tpl.formula_query, tpl.name)} style={pill(activePresetId === tpl.id)}>{tpl.name}</button>
        ))}
        {savedScreens.map(s => (
          <button key={`saved-${s.id}`} onClick={() => applyPreset(`saved-${s.id}`, s.formula_query, s.name)} style={{ ...pill(activePresetId === `saved-${s.id}`), borderStyle: 'dashed' }}>{s.name}</button>
        ))}
      </div>

      <ScreenerSectorChart
        rows={processedResults}
        sectors={overview.sectors || []}
        selectedSector={selectedSector}
        onSelectSector={(sec) => {
          setSelectedSector(sec);
          setPage(1);
          if (queryMode === 'visual' && !builderEnabled) runScreen(buildVisualFormula(sec));
        }}
      />

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: '#080D1E', padding: '7px 11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 800 }}>ACTIVE FILTERS ({activeChips.length}):</span>
          {activeChips.map((c, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.64rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC', borderRadius: 12, padding: '2px 6px 2px 9px', fontFamily: 'JetBrains Mono, monospace' }}>
              {c}
              <button onClick={() => removeChip(c)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>×</button>
            </span>
          ))}
          <button onClick={handleResetFilters} style={{ fontSize: '0.62rem', color: '#64748B', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear all</button>
        </div>
      )}

      {/* Filter drawer: sliders + builder + formula */}
      {filtersOpen && (
        <div style={{ background: '#090D1C', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['visual', 'Visual + Builder'], ['formula', 'Formula DSL']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setQueryMode(id)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: queryMode === id ? 'rgba(99,102,241,0.25)' : 'transparent', color: queryMode === id ? '#A5B4FC' : '#64748B', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>{label}</button>
            ))}
            <span style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: '#94A3B8' }}>
              <input type="checkbox" checked={builderEnabled} onChange={(e) => setBuilderEnabled(e.target.checked)} style={{ accentColor: '#6366F1' }} /> Advanced builder (AND/OR/NOT)
            </label>
            <button type="button" onClick={handleResetFilters} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem', cursor: 'pointer' }}>Reset</button>
            <button type="button" onClick={() => { setPage(1); runScreen(); }} disabled={loading} style={{ padding: '5px 14px', borderRadius: 6, background: '#10B981', color: '#FFF', border: 'none', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>{loading ? 'Running…' : 'Apply & Run'}</button>
            <button type="button" onClick={() => setFiltersOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}>✕</button>
          </div>
          {queryMode === 'visual' ? (
            <>
              {builderEnabled ? (
                <ScreenerFilterBuilder groups={builderGroups} setGroups={setBuilderGroups} topLogic={builderTopLogic} setTopLogic={setBuilderTopLogic} />
              ) : (
                <ScreenerFilters
                  universe={universe} setUniverse={setUniverse} onUniverseChange={handleUniverseChange}
                  selectedSector={selectedSector} setSelectedSector={setSelectedSector}
                  marketCapCat={marketCapCat} setMarketCapCat={setMarketCapCat}
                  minRoce={minRoce} setMinRoce={setMinRoce} minRoe={minRoe} setMinRoe={setMinRoe}
                  maxPe={maxPe} setMaxPe={setMaxPe} maxPb={maxPb} setMaxPb={setMaxPb}
                  maxDebt={maxDebt} setMaxDebt={setMaxDebt} minSalesGrowth={minSalesGrowth} setMinSalesGrowth={setMinSalesGrowth}
                  minProfitGrowth={minProfitGrowth} setMinProfitGrowth={setMinProfitGrowth}
                  minRsi={minRsi} setMinRsi={setMinRsi} maxRsi={maxRsi} setMaxRsi={setMaxRsi}
                  minVolRatio={minVolRatio} setMinVolRatio={setMinVolRatio} minAiScore={minAiScore} setMinAiScore={setMinAiScore}
                  queryMode={queryMode} setQueryMode={setQueryMode} formulaQuery={formulaQuery} setFormulaQuery={setFormulaQuery}
                  onResetFilters={handleResetFilters} onRunScreen={() => { setPage(1); runScreen(); }} loading={loading} onClose={() => setFiltersOpen(false)}
                />
              )}
            </>
          ) : (
            <div>
              <textarea value={formulaQuery} onChange={(e) => setFormulaQuery(e.target.value)} rows={3} style={{ width: '100%', background: '#060913', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 8, padding: '8px 12px', color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', outline: 'none' }} />
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 4 }}>Whitelisted: ROCE ROE PE PB DebtToEquity MarketCap RSI14 VolumeRatio20D EMA ADX ATR BB Stoch CCI ROC Williams MACD Supertrend Structure Regime Breakout Confluence AIConsensus RsNifty Sentiment… Unavailable fields show “Data unavailable for this condition.”</div>
            </div>
          )}
        </div>
      )}

      {/* Column groups + rank + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: '#080D1E', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[{ id: 'overview', label: 'Overview' }, ...COLUMN_GROUPS.filter((g) => g.id !== 'overview')].map(t => (
            <button key={t.id} onClick={() => setColumnGroup(t.id)} style={{ padding: '5px 11px', borderRadius: 6, border: 'none', background: columnGroup === t.id ? 'rgba(99,102,241,0.25)' : 'transparent', color: columnGroup === t.id ? '#818CF8' : '#64748B', fontSize: '0.68rem', fontWeight: columnGroup === t.id ? 800 : 500, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700 }}>Rank by:</label>
          <select value={rankBy} onChange={(e) => rankByChange(e.target.value)} style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#F1F5F9', fontSize: '0.68rem', outline: 'none' }}>
            {RANK_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {multiSort.length > 0 && (
            <button onClick={() => setMultiSort([])} style={{ fontSize: '0.62rem', color: '#F59E0B', background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear multi-sort ({multiSort.length})</button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={12} color="#64748B" />
            <input type="text" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} placeholder="Search ticker, name..." style={{ background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.7rem', outline: 'none', width: 130 }} />
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}><strong style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>{processedResults.length}</strong> Matches</div>
        </div>
      </div>

      {/* Results table */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#080D1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, minHeight: '380px', position: 'relative' }}>
        <ScreenerTable
          rows={paginatedRows}
          loading={loading}
          sortBy={sortColumn}
          sortDir={sortDirection}
          multiSort={multiSort}
          onSort={(col, e) => onSort(col, e)}
          activeTab={activeTab}
          columnGroup={columnGroup}
          selectedTickers={selectedTickers}
          onToggleSelect={(sym) => { setSelectedTickers(prev => { const next = new Set(prev); if (next.has(sym)) next.delete(sym); else next.add(sym); return next; }); }}
          onToggleSelectAll={() => {
            if (paginatedRows.every(r => selectedTickers.has(r.ticker))) {
              setSelectedTickers(prev => { const next = new Set(prev); paginatedRows.forEach(r => next.delete(r.ticker)); return next; });
            } else {
              setSelectedTickers(prev => { const next = new Set(prev); paginatedRows.forEach(r => next.add(r.ticker)); return next; });
            }
          }}
          onInspect={(stock) => setInspectedStock(stock)}
          onNavigateChart={(sym) => {
            const row = processedResults.find((r) => r.ticker === sym);
            setSelectedSymbol(sym); setActiveView('Live Chart');
            if (row && (row.rsi_14 ?? 50) < 30) toast.success('Chart opened — consider enabling RSI (screen flagged RSI < 30).');
          }}
          onNavigateFundamentals={(sym) => { setSelectedSymbol(sym); setActiveView('Fundamentals'); }}
          liveTicks={liveTicks}
        />
      </div>

      <ScreenerPagination totalItems={processedResults.length} page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} />

      <ScreenerBulkBar
        selectedCount={selectedTickers.size}
        selectedTickers={Array.from(selectedTickers)}
        onClearSelection={() => setSelectedTickers(new Set())}
        onExportSelected={() => { handleExportCsv(processedResults.filter(r => selectedTickers.has(r.ticker))); }}
        allResults={processedResults}
      />

      {inspectedStock && (
        <ScreenerFlyoutDrawer
          stock={inspectedStock}
          onClose={() => setInspectedStock(null)}
          onNavigateChart={(sym) => { setSelectedSymbol(sym); setActiveView('Live Chart'); }}
          onNavigateFundamentals={(sym) => { setSelectedSymbol(sym); setActiveView('Fundamentals'); }}
          onAddWatchlist={handleAddWatchlist}
          onAnalyzeAI={(s) => { setSelectedSymbol(s.ticker); setActiveView('AI Prediction'); }}
        />
      )}

      <ScreenerBacktestModal
        isOpen={showBacktestModal}
        onClose={() => setShowBacktestModal(false)}
        loading={backtestLoading}
        results={backtestResults}
        holdingDays={holdingDays}
        setHoldingDays={setHoldingDays}
        sttRate={sttRate}
        setSttRate={setSttRate}
        onRerun={handleRunBacktest}
      />

      <ScreenerSaveModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} screenName={screenName} setScreenName={setScreenName} onSave={handleSaveScreen} />

      {/* Alert-from-screener modal (real smart-alerts API) */}
      {showAlertModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 260 }}>
          <div style={{ background: '#090D1C', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: 20, width: 380, maxWidth: '92vw' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFF', marginBottom: 4 }}>Create Alert from Screener</div>
            <div style={{ fontSize: '0.66rem', color: '#64748B', marginBottom: 12 }}>Real alert evaluated by the backend scheduler. Examples: RSI crosses above 30, AI Score &gt; 80 with volume &gt; 2x.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Ticker<input value={alertDraft.ticker} onChange={(e) => setAlertDraft({ ...alertDraft, ticker: e.target.value })} placeholder="RELIANCE" style={inputStyle} /></label>
              <label style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Condition
                <select value={alertDraft.type} onChange={(e) => setAlertDraft({ ...alertDraft, type: e.target.value })} style={inputStyle}>
                  <option value="rsi_below">RSI crosses below</option>
                  <option value="rsi_above">RSI crosses above</option>
                  <option value="price_above">Price above</option>
                  <option value="price_below">Price below</option>
                  <option value="volume_spike">Volume spike ratio above</option>
                </select>
              </label>
              <label style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Threshold<input value={alertDraft.value} onChange={(e) => setAlertDraft({ ...alertDraft, value: e.target.value })} placeholder="30" style={inputStyle} /></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={handleCreateAlert} style={{ flex: 1, padding: '7px', borderRadius: 7, background: '#10B981', color: '#FFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Create Alert</button>
                <button onClick={() => setShowAlertModal(false)} style={{ padding: '7px 14px', borderRadius: 7, background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const pill = (active) => ({ padding: '4px 10px', borderRadius: 14, background: active ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.03)', border: active ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.06)', color: active ? '#A5B4FC' : '#94A3B8', fontSize: '0.66rem', fontWeight: active ? 800 : 500, cursor: 'pointer', whiteSpace: 'nowrap' });
const inputStyle = { display: 'block', width: '100%', marginTop: 4, background: '#060913', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 10px', color: '#F1F5F9', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' };
