import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { newGroup, compileBuilderToDsl } from './ScreenerFilterBuilder';
import { NO_OP_QUERY, isNoOpQuery, RANK_OPTIONS, ALL_COLUMNS } from './screenerColumns';
import { ALL_UNIVERSE } from './screenerLocal';

// Query state, visual sliders, formula builders, presets, sorting and result
// processing extracted from AdvancedScreener (pure code motion).
export function useScreenerQuery() {
  // Mode & drawer
  const [queryMode, setQueryMode] = useState('visual');

  // Universe / search / AI
  const [searchFilter, setSearchFilter] = useState('');

  // Sorting (single + multi)
  const [sortColumn, setSortColumn] = useState('market_cap_cr');
  const [sortDirection, setSortDirection] = useState('desc');
  const [multiSort, setMultiSort] = useState([]);
  // NOTE: there is deliberately no separate `rankBy` state. The dropdown is
  // driven by `sortColumn`, otherwise clicking a column header changed the real
  // sort while the dropdown kept displaying the previous ranking choice.

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
  const [formulaQuery, setFormulaQuery] = useState(NO_OP_QUERY);

  // Results / presets / overview
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  // Server-side match/universe counts ("N of M stocks") — distinct from the
  // client-side filtered processedResults length below.
  const [queryMeta, setQueryMeta] = useState({ total: 0, universeTotal: 0 });

  const [activePresetId, setActivePresetId] = useState('all-nse');
  const [activeCard, setActiveCard] = useState('total');

  // Refresh mode
  const [refreshMode, setRefreshMode] = useState('manual');
  const refreshTimer = useRef(null);

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
    return parts.length ? parts.join(' AND ') : NO_OP_QUERY;
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

  // Active filter chips derived from current formula AST-ish split (best-effort display).
  // The no-op sentinel is not a filter, so it must not appear as one chip the
  // user is invited to remove.
  const activeChips = useMemo(() => {
    const f = queryMode === 'formula' ? formulaQuery : activeFormula;
    if (isNoOpQuery(f)) return [];
    return f.split(/\s+(AND|OR)\s+/i).filter((t) => !/^(AND|OR)$/i.test(t.trim())).map((t) => t.trim()).filter(Boolean).slice(0, 12);
  }, [formulaQuery, activeFormula, queryMode]);

  // ── Run screen ──
  // Category scoping is server-side: we send the universe id (e.g. "NIFTY 50",
  // "NIFTY MIDCAP") and the backend resolves official NSE constituents.
  const runScreen = async (query = null, universeId = null) => {
    setLoading(true);
    const activeQuery = query || activeFormula || NO_OP_QUERY;
    const activeUniverse = universeId !== null && universeId !== undefined ? universeId : universe;
    try {
      const { data } = await api.post('/api/screener/query', {
        formula_query: activeQuery || NO_OP_QUERY,
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
      runScreen(NO_OP_QUERY);
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
    setFormulaQuery(NO_OP_QUERY); setActivePresetId('all-nse'); setActiveCard('total');
    runScreen(NO_OP_QUERY, ALL_UNIVERSE);
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
    next = next || NO_OP_QUERY;
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

  return {
    queryMode, setQueryMode,
    universe, setUniverse, selectedSector, setSelectedSector, marketCapCat, setMarketCapCat,
    minRoce, minRoe, maxPe, maxPb, maxDebt, minSalesGrowth, minProfitGrowth, minRsi, maxRsi, minVolRatio, minAiScore,
    touchedFilters, visualSetters,
    builderEnabled, setBuilderEnabled, builderGroups, setBuilderGroups, builderTopLogic, setBuilderTopLogic,
    formulaQuery, setFormulaQuery,
    loading, results, queryMeta,
    activePresetId, setActivePresetId, activeCard,
    refreshMode, setRefreshMode,
    buildVisualFormula, activeFormula, activeChips,
    runScreen, applyPreset, applyCard, handleUniverseChange, handleResetFilters, removeChip,
    searchFilter, setSearchFilter, processedResults,
    sortColumn, sortDirection, multiSort, setMultiSort, onSort, rankOptions, rankByChange,
  };
}
