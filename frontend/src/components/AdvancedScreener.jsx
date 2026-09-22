import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Sparkles, Play, RefreshCw, Search, Save } from 'lucide-react';
import './screener/terminal.css';
import { TN, panel, sectionTitle, btn, btnPrimary, btnGreen, chip, input } from './screener/terminalTheme';

import ScreenerHeaderBar from './screener/ScreenerHeaderBar';
import ScreenerKpiCards from './screener/ScreenerKpiCards';
import ScreenerSectorChart from './screener/ScreenerSectorChart';
import ScreenerBreadthBar from './screener/ScreenerBreadthBar';
import ScreenerFilters from './screener/ScreenerFilters';
import ScreenerFilterBuilder, { newGroup, compileBuilderToDsl } from './screener/ScreenerFilterBuilder';
import ScreenerTable from './screener/ScreenerTable';
import ScreenerFlyoutDrawer from './screener/ScreenerFlyoutDrawer';
import ScreenerBulkBar from './screener/ScreenerBulkBar';
import ScreenerBacktestModal from './screener/ScreenerBacktestModal';
import ScreenerSaveModal from './screener/ScreenerSaveModal';
import ScreenerColumnMenu from './screener/ScreenerColumnMenu';
import ScreenerStatusBar from './screener/ScreenerStatusBar';
import { INDEX_CONSTITUENTS } from '../constants/screenerConfig';
import { COLUMN_GROUPS, PREBUILT_SCREENS, RANK_OPTIONS, OVERVIEW_CARDS, ALL_COLUMNS, groupColumnsWithTicker } from './screener/screenerColumns';
import { getWsUrl } from '../utils/api';

const ALL_UNIVERSE = 'ALL NSE';
const UNIVERSE_IDS = [ALL_UNIVERSE, ...Object.keys(INDEX_CONSTITUENTS)];
const COLS_KEY = 'stockoracle_screener_cols_v1';

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

export default function AdvancedScreener() {
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);

  // Mode & drawer
  const [queryMode, setQueryMode] = useState('visual');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnGroup, setColumnGroup] = useState('overview');

  // Universe / search / AI
  const [searchFilter, setSearchFilter] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // {formula_query, explanation, filters_preview, unavailable_notes, valid}

  // Sorting (single + multi)
  const [sortColumn, setSortColumn] = useState('market_cap_cr');
  const [sortDirection, setSortDirection] = useState('desc');
  const [multiSort, setMultiSort] = useState([]);
  // NOTE: there is deliberately no separate `rankBy` state. The dropdown is
  // driven by `sortColumn`, otherwise clicking a column header changed the real
  // sort while the dropdown kept displaying the previous ranking choice.
  // NOTE: the pager bar (page/pageSize state) was removed — the table is
  // virtualized now, so the full result set scrolls with ~30 rows in the DOM.
  // Scroll position resets via ScreenerTable when the result set changes.
  const tableScrollRef = useRef(null);

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

  // Which visual sliders the user actually moved. Only these become DSL
  // conditions — previously ALL 11 were ANDed in every time, so merely opening
  // Visual mode silently applied a preset-quality screen and reported 11
  // "active filters" the user never set.
  const [touchedFilters, setTouchedFilters] = useState(() => new Set());

  // Setters that register a slider as intentional before updating it.
  const visualSetters = useMemo(() => {
    const wrap = (key, setter) => (value) => {
      setTouchedFilters((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
      setter(value);
    };
    return {
      setMinRoce: wrap('roce', setMinRoce),
      setMinRoe: wrap('roe', setMinRoe),
      setMaxPe: wrap('pe', setMaxPe),
      setMaxPb: wrap('pb', setMaxPb),
      setMaxDebt: wrap('debt', setMaxDebt),
      setMinSalesGrowth: wrap('sales', setMinSalesGrowth),
      setMinProfitGrowth: wrap('profit', setMinProfitGrowth),
      setMinRsi: wrap('rsiMin', setMinRsi),
      setMaxRsi: wrap('rsiMax', setMaxRsi),
      setMinVolRatio: wrap('vol', setMinVolRatio),
      setMinAiScore: wrap('ai', setMinAiScore),
    };
    // Setters returned by useState are stable, so this object is built once.
  }, []);

  // Filter-builder groups (nested AND/OR/NOT)
  const [builderGroups, setBuilderGroups] = useState([newGroup()]);
  const [builderTopLogic, setBuilderTopLogic] = useState('AND');
  const [builderEnabled, setBuilderEnabled] = useState(false);

  // Formula — open by default so first load shows the whole tracked
  // universe; user narrows down from there (matches initial runScreen + reset).
  const [formulaQuery, setFormulaQuery] = useState('MarketCap > 0');

  // Results / presets / overview
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  // Server-side match/universe counts ("N of M stocks") — distinct from the
  // client-side filtered processedResults length below.
  const [queryMeta, setQueryMeta] = useState({ total: 0, universeTotal: 0 });
  const [overview, setOverview] = useState({ cards: {}, breadth: {}, sectors: [], market_status: 'UNKNOWN', feed_live: false, total: 0 });
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);
  const [activePresetId, setActivePresetId] = useState('all-nse');
  const [activeCard, setActiveCard] = useState('total');

  // Selection / inspection
  const [selectedTickers, setSelectedTickers] = useState(new Set());
  const [inspectedStock, setInspectedStock] = useState(null);

  // Categorical universes (NIFTY 50 / MIDCAP / sectoral…) with live
  // constituent counts from the backend (official NSE lists). Falls back to
  // the bundled INDEX_CONSTITUENTS if the endpoint is unreachable.
  const [universeOptions, setUniverseOptions] = useState(null);
  const universeIds = useMemo(() => (
    universeOptions ? universeOptions.map((u) => u.id) : UNIVERSE_IDS
  ), [universeOptions]);

  // Live ticks
  const [liveTicks, setLiveTicks] = useState({});
  const [wsState, setWsState] = useState('idle');
  const wsRef = useRef(null);
  const pendingTickersRef = useRef(null);

  // Refresh mode
  const [refreshMode, setRefreshMode] = useState('manual');
  const refreshTimer = useRef(null);

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

  // Collapsible upper panels so the table keeps the majority of the height
  const [sectorsCollapsed, setSectorsCollapsed] = useState(false);
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);

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
      try {
        const { data } = await api.get('/api/screener/universes');
        if (Array.isArray(data.universes) && data.universes.length > 0) {
          setUniverseOptions(data.universes);
        }
      } catch (err) {
        console.error('Failed to load screener universes, using fallback', err);
      }
      runScreen('MarketCap > 0', ALL_UNIVERSE);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Formula builders ──
  // Only the sliders the user actually touched are emitted. Defaults therefore
  // no longer silently exclude most of the universe, and the "Active filters"
  // chip count finally reflects real intent.
  const buildVisualFormula = useCallback((sectorOverride = null) => {
    const sector = sectorOverride ?? selectedSector;
    const parts = [];
    const add = (key, expr) => { if (touchedFilters.has(key)) parts.push(expr); };
    add('roce', `ROCE > ${minRoce}`);
    add('roe', `ROE > ${minRoe}`);
    add('pe', `PE < ${maxPe}`);
    add('pb', `PB < ${maxPb}`);
    add('debt', `DebtToEquity < ${maxDebt}`);
    add('sales', `SalesGrowth3Y > ${minSalesGrowth}`);
    add('profit', `ProfitGrowth3Y > ${minProfitGrowth}`);
    add('rsiMin', `RSI14 > ${minRsi}`);
    add('rsiMax', `RSI14 < ${maxRsi}`);
    add('vol', `VolumeRatio20D > ${minVolRatio}`);
    add('ai', `AIConsensus > ${minAiScore}`);
    // Sector / market-cap are always explicit clicks, never defaults.
    if (sector !== 'ALL') parts.push(`Sector == '${sector}'`);
    if (marketCapCat !== 'ALL') parts.push(`MarketCapCat == '${marketCapCat}'`);
    return parts.length ? parts.join(' AND ') : 'MarketCap > 0';
  }, [minRoce, minRoe, maxPe, maxPb, maxDebt, minSalesGrowth, minProfitGrowth, minRsi, maxRsi, minVolRatio, minAiScore, selectedSector, marketCapCat, touchedFilters]);

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
  // Category scoping is server-side: we send the universe id (e.g. "NIFTY 50",
  // "NIFTY MIDCAP") and the backend resolves official NSE constituents.
  const runScreen = async (query = null, universeId = null) => {
    setLoading(true);
    const activeQuery = query || activeFormula || 'MarketCap > 0';
    const activeUniverse = universeId !== null && universeId !== undefined ? universeId : universe;
    try {
      const { data } = await api.post('/api/screener/query', {
        formula_query: activeQuery || 'MarketCap > 0',
        universe: activeUniverse !== ALL_UNIVERSE ? activeUniverse : null,
        sort_by: sortColumn || 'market_cap_cr',
        sort_dir: sortDirection === 'asc' ? 'ASC' : 'DESC',
        // The client re-sorts what it receives, so asking for a
        // limit smaller than the tracked universe would rank a truncated set
        // and silently hide matches. 5000 covers the whole NSE equity list.
        limit: 5000,
        offset: 0
      });
      setResults(data.results || []);
      setQueryMeta({
        total: data.total ?? (data.results || []).length,
        universeTotal: data.universe_total ?? 0,
        universe: data.universe ?? null,
        universeScoped: data.universe_scoped_count ?? null,
      });
    } catch (err) {
      console.error('Screener query error:', err);
      toast.error(err.response?.data?.detail || 'Screener query failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Keep the newest runScreen reachable from timers ──
  // The auto-refresh interval is (re)created only when refreshMode changes, so
  // its closure would pin the formula/universe/sort of THAT render. Going
  // through a ref guarantees a poll always executes the user's CURRENT screen
  // instead of a stale one.
  const runScreenRef = useRef(runScreen);
  useEffect(() => { runScreenRef.current = runScreen; });

  // ── WebSocket live ticks (event-driven; refresh modes only re-query) ──
  const wsRetryRef = useRef(null);
  const wsAttemptRef = useRef(0);
  const connectWsRef = useRef(null);

  // Exponential backoff (2s -> 4s -> 8s -> 16s, capped at 30s). Previously a
  // dropped socket only flipped the label to RECONNECTING and nothing ever
  // retried, so live prices stayed dead until the user ran a new screen.
  const scheduleReconnect = useCallback(() => {
    if (wsRetryRef.current) return;
    wsAttemptRef.current += 1;
    const delay = Math.min(30000, 2000 * (2 ** (wsAttemptRef.current - 1)));
    setWsState('reconnecting');
    wsRetryRef.current = setTimeout(() => {
      wsRetryRef.current = null;
      if (connectWsRef.current) connectWsRef.current();
    }, delay);
  }, []);

  const connectWs = useCallback(() => {
    try { wsRef.current?.close(); } catch (_) {}
    setWsState('connecting');
    let ws;
    try {
      ws = new WebSocket(getWsUrl());
    } catch (_) {
      setWsState('offline');
      scheduleReconnect();
      return null;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      wsAttemptRef.current = 0; // healthy again -> reset the backoff
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
    ws.onclose = () => {
      // A superseded socket (replaced by connectWs, or closed on unmount) must
      // not trigger a reconnect, otherwise every connect would spawn another.
      if (wsRef.current !== ws) return;
      setWsState((s) => (s === 'live' ? 'reconnecting' : 'offline'));
      scheduleReconnect();
    };
    ws.onerror = () => { if (wsRef.current === ws) setWsState('reconnecting'); };
    return ws;
  }, [scheduleReconnect]);

  useEffect(() => { connectWsRef.current = connectWs; }, [connectWs]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRetryRef.current) { clearTimeout(wsRetryRef.current); wsRetryRef.current = null; }
      const ws = wsRef.current;
      wsRef.current = null; // marks the close as intentional for ws.onclose
      try { ws?.close(); } catch (_) {}
    };
  }, [connectWs]);

  useEffect(() => {
    if (!results || results.length === 0) return;
    const topTickers = results.slice(0, 50).map(r => r.ticker);
    const allowed = new Set(topTickers);
    // Bound the tick store: keyed by symbol it used to grow for every ticker
    // ever subscribed in the session (unbounded memory, stale prices).
    setLiveTicks((prev) => {
      const next = {};
      let changed = false;
      Object.keys(prev).forEach((k) => {
        if (allowed.has(k)) next[k] = prev[k];
        else changed = true;
      });
      return changed ? next : prev;
    });
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ subscribe: topTickers })); } catch (_) {}
      return;
    }
    // Not open: queue the subscription and make sure exactly one attempt is
    // in flight (never a second socket while one is connecting/retrying).
    pendingTickersRef.current = topTickers;
    const state = ws ? ws.readyState : null;
    if (state !== WebSocket.CONNECTING && !wsRetryRef.current) connectWs();
  }, [results, connectWs]);

  // Refresh modes (polling only when explicitly chosen; realtime = event-driven WS)
  useEffect(() => {
    if (refreshTimer.current) { clearInterval(refreshTimer.current); refreshTimer.current = null; }
    const ms = refreshMode === '5s' ? 5000 : refreshMode === '10s' ? 10000 : refreshMode === '30s' ? 30000 : refreshMode === '1m' ? 60000 : null;
    // Through the ref so a poll always re-runs the CURRENT screen, not the one
    // captured when this interval was created (stale formula/universe/sort).
    if (ms) refreshTimer.current = setInterval(() => { runScreenRef.current(); }, ms);
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
      // The backend already persists universe/sort_by/sort_dir and returns them
      // from GET /screener/screens. Previously they were smuggled into the
      // display name and never read back, so reopening a screen silently lost
      // its universe and ranking. "ALL NSE" is stored verbatim; the backend
      // resolves it to no scope (whole tracked table).
      await api.post('/api/screener/screens', {
        name: screenName.trim(),
        description: `Columns: ${columnGroup}`,
        formula_query: activeQuery,
        universe,
        sort_by: sortColumn,
        sort_dir: sortDirection === 'asc' ? 'ASC' : 'DESC',
        is_public: true,
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

  // Saved screens can be removed again (DELETE /screener/screens/{id} existed
  // but nothing in the UI ever called it).
  const handleDeleteScreen = async (screenId, name) => {
    try {
      await api.delete(`/api/screener/screens/${screenId}`);
      setSavedScreens((prev) => prev.filter((s) => s.id !== screenId));
      toast.success(`Deleted screen: ${name}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete screen.');
    }
  };

  const handleCopyShareLink = (token) => {
    if (!token) { toast.error('This screen has no share token.'); return; }
    const url = `${window.location.origin}/?screen=${token}`;
    try {
      navigator.clipboard?.writeText(url);
      toast.success('Share link copied to clipboard.');
    } catch (_) {
      toast(url, { icon: '🔗' });
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

  // `meta` restores a saved screen's stored universe + ranking. Pre-built
  // templates deliberately pass none: their informational `universe` field
  // (NIFTY_500) must not silently narrow the user's current universe.
  const applyPreset = (id, query, name, meta = null) => {
    setActivePresetId(id);
    setActiveCard('total');
    setFormulaQuery(query);
    setQueryMode('formula');
    setBuilderEnabled(false);
    setMultiSort([]);
    if (meta) {
      if (meta.universe) setUniverse(meta.universe);
      if (meta.sort_by) {
        setSortColumn(meta.sort_by);
        setSortDirection(String(meta.sort_dir || 'DESC').toLowerCase() === 'asc' ? 'asc' : 'desc');
      }
    }
    // meta.universe of "ALL NSE" is normalised to null (= whole tracked table)
    // by runScreen itself.
    runScreen(query, meta?.universe ?? null);
    toast.success(`Applied: ${name}`);
  };

  const applyCard = (card) => {
    setActiveCard(card.id);
    if (!card.dsl) {
      runScreen('MarketCap > 0');
      return;
    }
    setFormulaQuery(card.dsl);
    setQueryMode('formula');
    runScreen(card.dsl);
  };

  const handleUniverseChange = (universeId) => {
    setUniverse(universeId);
    if (universeId === ALL_UNIVERSE) {
      // ALL NSE = the whole tracked universe: drop restrictive filters so
      // every stock comes back (same as a filter reset, universe kept as ALL).
      handleResetFilters();
      return;
    }
    // Server resolves the universe id to official NSE constituents.
    runScreen(null, universeId);
  };

  const handleResetFilters = () => {
    setMinRoce(0); setMinRoe(0); setMaxPe(100); setMaxPb(25); setMaxDebt(3.0);
    setMinSalesGrowth(-10); setMinProfitGrowth(-10); setMinRsi(0); setMaxRsi(100);
    setMinVolRatio(0.5); setMinAiScore(30); setSelectedSector('ALL'); setMarketCapCat('ALL');
    // No slider counts as "touched" after a reset, so visual mode is back to the
    // full universe instead of a default preset screen.
    setTouchedFilters(new Set());
    setUniverse(ALL_UNIVERSE); setBuilderEnabled(false); setBuilderGroups([newGroup()]);
    setFormulaQuery('MarketCap > 0'); setActivePresetId('all-nse'); setActiveCard('total');
    runScreen('MarketCap > 0', ALL_UNIVERSE);
    toast.success('Filters reset to default.');
  };

  const removeChip = (chip) => {
    const f = queryMode === 'formula' ? formulaQuery : activeFormula;
    const target = String(chip).trim();
    // Split on AND/OR while KEEPING the joiners, otherwise dropping a chip out
    // of an OR expression silently turned it into an AND chain (and a totally
    // different result set than the chips implied).
    const parts = f.split(/(\s+(?:AND|OR)\s+)/i);
    const terms = parts.filter((_, i) => i % 2 === 0).map((t) => t.trim()).filter(Boolean);
    const joiners = parts.filter((_, i) => i % 2 === 1).map((j) => j.trim().toUpperCase());
    let next;
    if (joiners.length !== terms.length - 1) {
      // Defensive: unexpected shape -> fall back to the previous behaviour.
      next = f.split(/\s+AND\s+/i).filter((t) => t.trim() !== target).join(' AND ');
    } else {
      // unit[i] = { joiner: joiner that preceded term i, term }
      const units = terms.map((term, i) => ({ joiner: i === 0 ? null : joiners[i - 1], term }));
      const kept = units.filter((u) => u.term !== target);
      const out = [];
      kept.forEach((u) => {
        if (out.length === 0) { out.push(u.term); return; }
        out.push(u.joiner || 'AND', u.term);
      });
      next = out.join(' ').trim();
    }
    next = next || 'MarketCap > 0';
    setFormulaQuery(next);
    setQueryMode('formula');
    runScreen(next);
  };

  // ── Filter + multi-sort (client-side over last server query) ──
  // Deferred so typing stays responsive: filtering + sorting the full universe
  // on every keystroke used to block the input.
  const deferredSearch = useDeferredValue(searchFilter);

  const processedResults = useMemo(() => {
    let list = [...results];
    const q = deferredSearch.trim().toLowerCase();
    if (q) {
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
  }, [results, deferredSearch, sortColumn, sortDirection, multiSort]);

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

  // The dropdown reflects the REAL current sort. If the sort came from a column
  // header that isn't a curated preset, it is prepended so the control can never
  // show a ranking that disagrees with the table.
  const rankOptions = useMemo(() => {
    if (RANK_OPTIONS.some((r) => r.id === sortColumn)) return RANK_OPTIONS;
    const col = ALL_COLUMNS.find((c) => c.key === sortColumn);
    return [{ id: sortColumn, label: `${col ? col.label : sortColumn} (column)` }, ...RANK_OPTIONS];
  }, [sortColumn]);

  const rankByChange = (key) => {
    setSortColumn(key);
    setSortDirection(key === 'rsi_14' ? 'asc' : 'desc');
    setMultiSort([]);
    toast.success(`Ranked by ${RANK_OPTIONS.find((r) => r.id === key)?.label || key}`);
  };

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

  // Prefill the alert modal from a table row (submission still uses the real API)
  const handleAlertFor = useCallback((stock) => {
    const px = Math.round(Number(stock.close_price) || 0);
    setAlertDraft({ ticker: stock.ticker || '', type: 'price_above', value: px ? String(px) : '' });
    setShowAlertModal(true);
  }, []);

  const handleAddWatchlist = useCallback((stock) => {
    try {
      const ticker = String(stock?.ticker || '').trim();
      const current = JSON.parse(localStorage.getItem('stockoracle_custom_watchlist') || '[]');

      if (!ticker) {
        toast.error('Ticker missing.');
        return;
      }

      const next = Array.from(new Set([...current.map(String), ticker.toUpperCase()]));
      if (next.length === current.length) {
        toast.error(`${ticker.toUpperCase()} is already in your watchlist.`);
        return;
      }

      localStorage.setItem('stockoracle_custom_watchlist', JSON.stringify(next));
      toast.success(`${ticker.toUpperCase()} added to watchlist!`);
    } catch (_) {
      toast.error('Failed to update watchlist.');
    }
  }, []);

  const quickPills = [
    { id: 'all-nse', name: 'All NSE Equities', query: 'MarketCap > 0' },
    { id: 'high-roce', name: 'High ROCE (>20%)', query: 'ROCE > 20 AND DebtToEquity < 0.5' },
    { id: 'value-growth', name: 'Growth at Fair Value', query: 'ROCE > 18 AND PE < 28 AND DebtToEquity < 1.0' },
    { id: 'oversold', name: 'Oversold Momentum', query: 'RSI14 < 40 AND VolumeRatio20D > 1.1' },
    { id: 'ai-bulls', name: 'AI High Consensus', query: 'AIConsensus > 75 AND VolumeRatio20D > 1.0' },
    { id: 'low-debt', name: 'Low Debt Quality', query: 'DebtToEquity < 0.2 AND ROCE > 15' },
  ];

  const visibleChips = showAllChips ? activeChips : activeChips.slice(0, 5);

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

  return (
    <div className="tn-scroll tn-screener-root" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, height: '100%', boxSizing: 'border-box', background: TN.bg, color: TN.text, overflowY: 'auto' }}>
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
        universes={[ALL_UNIVERSE, ...universeIds.filter((u) => u !== ALL_UNIVERSE)]}
        refreshMode={refreshMode}
        onRefreshMode={setRefreshMode}
        onExportCsv={() => handleExportCsv(processedResults)}
        onOpenSaveModal={() => setShowSaveModal(true)}
        // Opening the modal must not fire a simulation: previously this button
        // ran a backtest immediately, so the rebalance/friction controls inside
        // could never be set before the first run.
        onOpenBacktestModal={() => setShowBacktestModal(true)}
        onCreateAlert={() => setShowAlertModal(true)}
        onRefresh={() => runScreen()}
        loading={loading}
      />

      <ScreenerKpiCards stats={kpiStats} activeCard={activeCard} onSelect={applyCard} />

      <ScreenerBreadthBar breadth={overview.breadth?.total ? overview.breadth : null} />

      {/* AI Screener — interpretation is always shown before anything is applied */}
      <div style={panel({ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 6, border: `1px solid rgba(167,139,250,0.25)` })}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: TN.ai, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 7 }}>
            <Sparkles size={14} /> AI SCREENER
          </div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiTranslate(false); } }}
            rows={2}
            placeholder="Find large-cap stocks with RSI below 40, price above EMA 200 and unusual volume…"
            aria-label="Describe the screen you want in plain English"
            style={input({ flex: 1, padding: '6px 10px', border: 'none', background: 'transparent', resize: 'none', lineHeight: 1.5 })}
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
            <button onClick={() => handleAiTranslate(false)} disabled={aiLoading} style={btnPrimary({ opacity: aiLoading ? 0.6 : 1 })}>
              {aiLoading ? <RefreshCw size={12} className="tn-spin" /> : <Play size={12} />} Generate
            </button>
          </div>
        </div>
        {aiPreview && (
          <div style={{ background: TN.inset, border: `1px solid rgba(167,139,250,0.30)`, borderRadius: TN.radius, padding: '8px 10px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={sectionTitle({ color: TN.ai, marginBottom: 5 })}>AI interpretation</div>
              {(aiPreview.filters_preview || []).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 11, marginBottom: 6 }}>
                  {aiPreview.filters_preview.map((f, i) => (
                    <React.Fragment key={i}>
                      <span style={{ color: TN.faint }}>{f.field}</span>
                      <span style={{ color: TN.text, fontFamily: TN.mono }}>{f.operator} {String(f.value)}</span>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: TN.muted, marginBottom: 6 }}>{aiPreview.explanation || 'No structured filters parsed.'}</div>
              )}
              {(aiPreview.unavailable_notes || []).map((n, i) => (
                <div key={i} style={{ fontSize: 11, color: TN.warn, marginBottom: 3 }}>{n}</div>
              ))}
              {!!(aiPreview.filters_preview || []).length && aiPreview.explanation && (
                <div style={{ fontSize: 11, color: TN.muted, marginBottom: 6 }}>{aiPreview.explanation}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end', minWidth: 150 }}>
              <div style={{ fontSize: 11, color: TN.info, fontFamily: TN.mono, overflow: 'hidden', textOverflow: 'ellipsis' }} title={aiPreview.formula_query}>{aiPreview.formula_query}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={applyAiPreview} style={btnGreen()}>Apply Filters</button>
                <button onClick={() => { setFormulaQuery(aiPreview.formula_query); setQueryMode('formula'); }} style={btn()}>Modify</button>
                <button onClick={() => setAiPreview(null)} style={btn(false, { border: '1px solid transparent', background: 'transparent' })}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Presets incl. 13 institutional templates */}
      <div style={panel({ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 7 })}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={sectionTitle()}>Screen presets</span>
          <span style={{ fontSize: 11, color: TN.faint }}>
            {quickPills.length + (prebuiltTemplates.length || PREBUILT_SCREENS.length) + savedScreens.length} saved views — one click applies the full filter set
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {quickPills.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id, p.query, p.name)} style={pill(activePresetId === p.id)}>{p.name}</button>
          ))}
          {(prebuiltTemplates.length ? prebuiltTemplates : PREBUILT_SCREENS.map((t) => ({ id: t.id, name: t.name, formula_query: t.query }))).map(tpl => (
            <button key={tpl.id} onClick={() => applyPreset(tpl.id, tpl.formula_query, tpl.name)} style={pill(activePresetId === tpl.id)}>{tpl.name}</button>
          ))}
          {savedScreens.map(s => (
            <span key={`saved-${s.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              <button
                onClick={() => applyPreset(`saved-${s.id}`, s.formula_query, s.name, { universe: s.universe, sort_by: s.sort_by, sort_dir: s.sort_dir })}
                style={{ ...pill(activePresetId === `saved-${s.id}`), borderStyle: 'dashed', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                title={`${s.formula_query}${s.universe ? ` · universe ${s.universe}` : ''}${s.sort_by ? ` · ${s.sort_by} ${s.sort_dir}` : ''}`}
              >
                {s.name}
              </button>
              {/* Restore-universe/sort + share + delete: the backend already
                  returned all of this, but no control ever surfaced it. */}
              {s.share_token && (
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(s.share_token)}
                  title="Copy public share link"
                  aria-label={`Copy share link for ${s.name}`}
                  style={{ ...pill(false), borderStyle: 'dashed', borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '3px 6px' }}
                >
                  🔗
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteScreen(s.id, s.name)}
                title="Delete this saved screen"
                aria-label={`Delete ${s.name}`}
                style={{ ...pill(false), borderStyle: 'dashed', borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '3px 6px' }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <ScreenerSectorChart
        rows={processedResults}
        sectors={overview.sectors || []}
        selectedSector={selectedSector}
        collapsed={sectorsCollapsed}
        onToggleCollapse={() => setSectorsCollapsed((v) => !v)}
        expanded={sectorsExpanded}
        onToggleExpanded={() => setSectorsExpanded((v) => !v)}
        onSelectSector={(sec) => {
          setSelectedSector(sec);
          if (queryMode === 'visual' && !builderEnabled) runScreen(buildVisualFormula(sec));
        }}
      />

      {/* Active filter chips — compact, one row, never overlaps tabs */}
      {activeChips.length > 0 && (
        <div style={panel({ padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', width: '100%', minWidth: 0, boxSizing: 'border-box' })} className="tn-no-scrollbar">
          <span style={sectionTitle({ whiteSpace: 'nowrap', flexShrink: 0 })}>Active filters ({activeChips.length})</span>
          {visibleChips.map((c, i) => (
            <span key={i} style={chip('default', { flexShrink: 0 })}>
              {c}
              <button onClick={() => removeChip(c)} title={`Remove filter: ${c}`} aria-label={`Remove filter ${c}`} style={{ background: 'transparent', border: 'none', color: TN.down, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
          {activeChips.length > 5 && (
            <button onClick={() => setShowAllChips((v) => !v)} style={{ fontSize: 11, color: TN.accent, background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {showAllChips ? 'Show less' : `+${activeChips.length - 5} more`}
            </button>
          )}
          <span style={{ flex: '1 0 8px' }} />
          <button onClick={() => setShowSaveModal(true)} title="Save this screen" style={{ ...btn(), height: 24, fontSize: 11, flexShrink: 0 }}><Save size={12} /> Save Screen</button>
          <button onClick={handleResetFilters} style={{ fontSize: 11, color: TN.muted, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0 }}>Clear all</button>
        </div>
      )}

      {/* Filter drawer: sliders + builder + formula */}
      {filtersOpen && (
        <div style={panel({ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0, boxSizing: 'border-box' })}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[['visual', 'Visual + Builder'], ['formula', 'Formula DSL']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setQueryMode(id)} style={btn(queryMode === id)}>{label}</button>
            ))}
            <span style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: TN.muted }}>
              <input type="checkbox" checked={builderEnabled} onChange={(e) => setBuilderEnabled(e.target.checked)} style={{ accentColor: '#7C8CF8' }} /> Advanced builder (AND/OR/NOT)
            </label>
            <button type="button" onClick={handleResetFilters} style={btn()}>Reset</button>
            <button type="button" onClick={() => runScreen()} disabled={loading} style={btnGreen({ opacity: loading ? 0.6 : 1 })}>{loading ? 'Running…' : 'Apply & Run'}</button>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" style={{ background: 'transparent', border: 'none', color: TN.faint, cursor: 'pointer' }}>✕</button>
          </div>
          {queryMode === 'visual' ? (
            <>
              {builderEnabled ? (
                <ScreenerFilterBuilder groups={builderGroups} setGroups={setBuilderGroups} topLogic={builderTopLogic} setTopLogic={setBuilderTopLogic} />
              ) : (
                <ScreenerFilters
                  universe={universe} setUniverse={setUniverse} onUniverseChange={handleUniverseChange}
                  universeOptions={universeOptions}
                  selectedSector={selectedSector} setSelectedSector={setSelectedSector}
                  marketCapCat={marketCapCat} setMarketCapCat={setMarketCapCat}
                  minRoce={minRoce} setMinRoce={visualSetters.setMinRoce}
                  minRoe={minRoe} setMinRoe={visualSetters.setMinRoe}
                  maxPe={maxPe} setMaxPe={visualSetters.setMaxPe}
                  maxPb={maxPb} setMaxPb={visualSetters.setMaxPb}
                  maxDebt={maxDebt} setMaxDebt={visualSetters.setMaxDebt}
                  minSalesGrowth={minSalesGrowth} setMinSalesGrowth={visualSetters.setMinSalesGrowth}
                  minProfitGrowth={minProfitGrowth} setMinProfitGrowth={visualSetters.setMinProfitGrowth}
                  minRsi={minRsi} setMinRsi={visualSetters.setMinRsi}
                  maxRsi={maxRsi} setMaxRsi={visualSetters.setMaxRsi}
                  minVolRatio={minVolRatio} setMinVolRatio={visualSetters.setMinVolRatio}
                  minAiScore={minAiScore} setMinAiScore={visualSetters.setMinAiScore}
                  touchedFilters={touchedFilters}
                  activeFilterCount={activeChips.length}
                />
              )}
            </>
          ) : (
            <div>
              <textarea value={formulaQuery} onChange={(e) => setFormulaQuery(e.target.value)} rows={3} style={input({ width: '100%', padding: '8px 10px', color: TN.info, fontFamily: TN.mono, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' })} />
              <div style={{ fontSize: 11, color: TN.faint, marginTop: 4 }}>Whitelisted: ROCE ROE PE PB DebtToEquity MarketCap RSI14 VolumeRatio20D EMA ADX ATR BB Stoch CCI ROC Williams MACD Supertrend Structure Regime Breakout Confluence AIConsensus RsNifty Sentiment… Unavailable fields show “Data unavailable for this condition.”</div>
            </div>
          )}
        </div>
      )}

      {/* Category navigation + rank + search — tabs own full-width row, controls second row */}
      <div style={panel({ padding: '2px 12px 6px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 0, width: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'visible' })}>
        <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', minWidth: 0 }}>
          <nav className="tn-tabs" aria-label="Column groups" style={{ display: 'flex', flex: '1 1 auto', minWidth: 0, overflow: 'visible', flexWrap: 'nowrap' }}>
            {[{ id: 'overview', label: 'Overview' }, ...COLUMN_GROUPS.filter((g) => g.id !== 'overview')].map(t => (
              <button key={t.id} onClick={() => setColumnGroup(t.id)} aria-pressed={columnGroup === t.id} className={`tn-tab${columnGroup === t.id ? ' active' : ''}`}>{t.label}</button>
            ))}
          </nav>
          <div style={{ position: 'relative', flexShrink: 0, paddingBottom: 4, paddingLeft: 8 }}>
            <button type="button" onClick={() => setShowColumnMenu((v) => !v)} aria-expanded={showColumnMenu} title="Show, hide and reorder columns" style={btn(showColumnMenu, { height: 26, whiteSpace: 'nowrap' })}>Columns{groupHidden.length ? ` (${groupOrderedCols.length - groupHidden.length}/${groupOrderedCols.length})` : ''} ▾</button>
            {showColumnMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 110, cursor: 'default' }}
                  onClick={() => setShowColumnMenu(false)}
                  aria-hidden="true"
                />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 120 }}>
                  <ScreenerColumnMenu
                    columns={groupOrderedCols}
                    isVisible={(k) => !groupHidden.includes(k)}
                    onToggle={toggleColumn}
                    onMove={moveColumn}
                    onResetWidths={resetWidths}
                    onClose={() => setShowColumnMenu(false)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, flexWrap: 'wrap', borderTop: `1px solid ${TN.border}`, marginTop: 2, width: '100%', minWidth: 0 }}>
          <label style={{ fontSize: 11, color: TN.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>Rank by:</label>
          <select value={sortColumn} onChange={(e) => rankByChange(e.target.value)} style={input({ height: 26, padding: '0 6px', fontSize: 12 })}>
            {rankOptions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {multiSort.length > 0 && (
            <button onClick={() => setMultiSort([])} style={{ fontSize: 11, color: TN.warn, background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear multi-sort ({multiSort.length})</button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: TN.inset, borderRadius: TN.radius, padding: '3px 8px', border: `1px solid ${TN.border}`, flex: '1 1 160px', minWidth: 140, maxWidth: 300 }}>
            <Search size={12} color={TN.faint} />
            <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Search ticker, name…" aria-label="Filter results by ticker or name" style={{ background: 'transparent', border: 'none', color: TN.text, fontSize: 12, outline: 'none', width: '100%', minWidth: 0 }} />
          </div>
          <div style={{ fontSize: 12, color: TN.muted, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 'auto' }} title={queryMeta.universeTotal ? `${processedResults.length} after client filters · ${queryMeta.total} matched on server${queryMeta.universe ? ` · universe ${queryMeta.universe} (${queryMeta.universeScoped ?? '?'})` : ''} · ${queryMeta.universeTotal} stocks tracked` : undefined}><strong style={{ color: TN.up, fontFamily: TN.mono }}>{processedResults.length}</strong> matches{queryMeta.universe && queryMeta.universeScoped != null ? <span style={{ color: TN.faint }}> in {queryMeta.universe} ({queryMeta.universeScoped})</span> : queryMeta.universeTotal > 0 ? <span style={{ color: TN.faint }}> of {queryMeta.universeTotal} stocks</span> : null}</div>
        </div>
      </div>

      {/* Results table — single vertical scroll root, horizontal inside.
          Rows are virtualized: the full result set scrolls, only visible
          rows sit in the DOM. Deliberately borderless/transparent so it reads
          as page flow rather than a box — scrolling still stays inside this
          container, keeping filters and the sticky header in view. */}
      <div ref={tableScrollRef} className="tn-scroll" style={{ flex: '1 1 auto', minHeight: '55vh', overflowY: 'auto', overflowX: 'auto', background: 'transparent', border: 'none', borderRadius: 0, position: 'relative', width: '100%', minWidth: 0 }}>
        <ScreenerTable
          rows={processedResults}
          loading={loading}
          sortBy={sortColumn}
          sortDir={sortDirection}
          multiSort={multiSort}
          onSort={(col, e) => onSort(col, e)}
          columnGroup={columnGroup}
          visibleColumns={groupVisibleKeys}
          columnOrder={colConfig.order[columnGroup] || null}
          columnWidths={colConfig.widths}
          onResizeColumn={resizeColumn}
          onResizeCommit={commitColumnWidth}
          selectedTickers={selectedTickers}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onInspect={inspectStock}
          onNavigateChart={navigateChart}
          onNavigateFundamentals={navigateFundamentals}
          onAddWatchlist={handleAddWatchlist}
          onAlertFor={handleAlertFor}
          liveTicks={liveTicks}
          scrollRef={tableScrollRef}
        />
      </div>

      <ScreenerStatusBar
        wsState={wsState === 'live' ? 'live' : wsState}
        feedLive={overview.feed_live}
        matchCount={processedResults.length}
        universe={universe}
      />

      <ScreenerBulkBar
        selectedCount={selectedTickers.size}
        selectedTickers={Array.from(selectedTickers)}
        onClearSelection={clearSelection}
        onExportSelected={() => { handleExportCsv(processedResults.filter(r => selectedTickers.has(r.ticker))); }}
        allResults={processedResults}
      />

      {inspectedStock && (
        <ScreenerFlyoutDrawer
          stock={inspectedStock}
          onClose={() => setInspectedStock(null)}
          onNavigateChart={navigateChart}
          onNavigateFundamentals={navigateFundamentals}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 260 }}>
          <div style={{ background: TN.panel, border: `1px solid ${TN.borderStrong}`, borderRadius: TN.radius, padding: 18, width: 380, maxWidth: '92vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TN.text, marginBottom: 4 }}>Create Alert</div>
            <div style={{ fontSize: 11, color: TN.faint, marginBottom: 12 }}>Evaluated by the backend scheduler. Examples: RSI crosses above 30, AI Score &gt; 80 with volume &gt; 2x.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, color: TN.muted }}>Ticker<input value={alertDraft.ticker} onChange={(e) => setAlertDraft({ ...alertDraft, ticker: e.target.value })} placeholder="RELIANCE" style={inputStyle} /></label>
              <label style={{ fontSize: 11, color: TN.muted }}>Condition
                <select value={alertDraft.type} onChange={(e) => setAlertDraft({ ...alertDraft, type: e.target.value })} style={inputStyle}>
                  <option value="rsi_below">RSI crosses below</option>
                  <option value="rsi_above">RSI crosses above</option>
                  <option value="price_above">Price above</option>
                  <option value="price_below">Price below</option>
                  <option value="volume_spike">Volume spike ratio above</option>
                </select>
              </label>
              <label style={{ fontSize: 11, color: TN.muted }}>Threshold<input value={alertDraft.value} onChange={(e) => setAlertDraft({ ...alertDraft, value: e.target.value })} placeholder="30" style={inputStyle} /></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={handleCreateAlert} style={btnGreen({ flex: 1, justifyContent: 'center' })}>Create Alert</button>
                <button onClick={() => setShowAlertModal(false)} style={btn()}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const pill = (active) => ({ padding: '3px 10px', borderRadius: 3, background: active ? 'rgba(124,140,248,0.14)' : 'rgba(148,163,184,0.05)', border: active ? '1px solid rgba(124,140,248,0.5)' : `1px solid ${TN.border}`, color: active ? TN.accent : TN.muted, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 });
const inputStyle = { display: 'block', width: '100%', marginTop: 4, background: TN.inset, border: `1px solid ${TN.borderStrong}`, borderRadius: TN.radius, padding: '6px 10px', color: TN.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' };
