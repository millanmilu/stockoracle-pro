import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { 
  SlidersHorizontal, Sparkles, Terminal, Play, 
  Dices, Save, RefreshCw, Filter, Search, Download,
  BookmarkPlus, ArrowUpDown, ChevronDown, ChevronUp, Layers, CheckSquare
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import ScreenerKpiCards from './screener/ScreenerKpiCards';
import ScreenerSectorChart from './screener/ScreenerSectorChart';
import ScreenerFilters from './screener/ScreenerFilters';
import ScreenerTable from './screener/ScreenerTable';
import ScreenerPagination from './screener/ScreenerPagination';
import ScreenerFlyoutDrawer from './screener/ScreenerFlyoutDrawer';
import ScreenerBulkBar from './screener/ScreenerBulkBar';

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.hostname.includes('amplifyapp.com')) {
      return 'wss://stockoracle.duckdns.org/ws/prices';
    }
    return `${protocol}//${window.location.host}/ws/prices`;
  }
  return 'ws://localhost:8000/ws/prices';
};

export default function AdvancedScreener() {
  const setSelectedSymbol = useStore(s => s.setSelectedSymbol);
  const setActiveView = useStore(s => s.setActiveView);

  // Mode: 'visual' | 'formula'
  const [queryMode, setQueryMode] = useState('visual');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'valuation' | 'technical' | 'ai'
  
  // Search & AI State
  const [searchFilter, setSearchFilter] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Sorting
  const [sortColumn, setSortColumn] = useState('market_cap_cr');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Formula State
  const [formulaQuery, setFormulaQuery] = useState('MarketCap > 0 AND ROCE > 15 AND PE < 40');

  // Visual Filter Sliders
  const [universe, setUniverse] = useState('ALL NSE');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [marketCapCat, setMarketCapCat] = useState('ALL');
  const [minRoce, setMinRoce] = useState(15);
  const [maxPe, setMaxPe] = useState(40);
  const [maxDebt, setMaxDebt] = useState(1.5);
  const [minRsi, setMinRsi] = useState(0);
  const [maxRsi, setMaxRsi] = useState(100);
  const [minVolRatio, setMinVolRatio] = useState(0.8);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);
  const [activePresetId, setActivePresetId] = useState('all-nse');

  // Multi-Selection State
  const [selectedTickers, setSelectedTickers] = useState(new Set());

  // Flyout Drawer State
  const [inspectedStock, setInspectedStock] = useState(null);

  // WebSocket Live Ticks State
  const [liveTicks, setLiveTicks] = useState({});
  const wsRef = useRef(null);

  // Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const [holdingDays, setHoldingDays] = useState(20);
  const [sttRate, setSttRate] = useState(0.001); // 0.10%

  // 1. Fetch Presets & Initial Data on Mount
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/api/screener/screens');
        setPrebuiltTemplates(data.prebuilt_templates || []);
        setSavedScreens(data.saved_screens || []);
      } catch (err) {
        console.error('Failed to load screen presets', err);
      }
      runScreen('MarketCap > 0');
    };
    init();
  }, []);

  // 2. Build Visual Formula
  const buildVisualFormula = useCallback(() => {
    let formula = `ROCE > ${minRoce} AND PE < ${maxPe} AND DebtToEquity < ${maxDebt} AND RSI14 > ${minRsi} AND RSI14 < ${maxRsi} AND VolumeRatio20D > ${minVolRatio}`;
    if (selectedSector !== 'ALL') {
      formula += ` AND Sector == '${selectedSector}'`;
    }
    if (marketCapCat !== 'ALL') {
      formula += ` AND MarketCapCat == '${marketCapCat}'`;
    }
    return formula;
  }, [minRoce, maxPe, maxDebt, minRsi, maxRsi, minVolRatio, selectedSector, marketCapCat]);

  // Sync formula when sliders change (if in visual mode)
  useEffect(() => {
    if (queryMode === 'visual') {
      setFormulaQuery(buildVisualFormula());
    }
  }, [queryMode, buildVisualFormula]);

  // 3. Run Screen API (/api/screener/query)
  const runScreen = async (query = null, targetPage = 1, targetSize = pageSize) => {
    setLoading(true);
    const activeQuery = query || (queryMode === 'formula' ? formulaQuery : buildVisualFormula());
    try {
      const { data } = await api.post('/api/screener/query', {
        formula_query: activeQuery || "MarketCap > 0",
        sort_by: sortColumn || "market_cap_cr",
        sort_dir: sortDirection === 'asc' ? "ASC" : "DESC",
        limit: 1000,
        offset: 0
      });
      setResults(data.results || []);
      setTotalCount(data.total || (data.results ? data.results.length : 0));
    } catch (err) {
      console.error('Screener query error:', err);
      toast.error(err.response?.data?.detail || 'Screener query failed');
    } finally {
      setLoading(false);
    }
  };

  // 4. WebSocket Feed for Live Price Ticks
  useEffect(() => {
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (results.length > 0) {
        const topTickers = results.slice(0, 50).map(r => r.ticker);
        ws.send(JSON.stringify({ subscribe: topTickers }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data);
        if (tick.ticker && tick.price) {
          setLiveTicks(prev => ({
            ...prev,
            [tick.ticker]: {
              price: tick.price,
              change_pct: tick.change_pct,
              is_live: tick.is_live,
              updated_at: Date.now()
            }
          }));
        }
      } catch (_) {}
    };

    return () => {
      ws.close();
    };
  }, [results]);

  // 5. AI Translate Natural Language (/api/screener/ai-parse)
  const handleAiTranslate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/api/screener/ai-parse', { prompt: aiPrompt });
      if (data.formula_query) {
        setFormulaQuery(data.formula_query);
        setQueryMode('formula');
        setActivePresetId(null);
        setPage(1);
        runScreen(data.formula_query, 1);
        toast.success(`AI Query: ${data.formula_query}`);
      } else {
        toast.error('Could not generate formula.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI query error');
    } finally {
      setAiLoading(false);
    }
  };

  // 6. Backtest Runner (/api/screener/backtest)
  const handleRunBacktest = async () => {
    setShowBacktestModal(true);
    setBacktestLoading(true);
    const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
    try {
      const { data } = await api.post('/api/screener/backtest', {
        formula_query: activeQuery,
        holding_period_days: holdingDays,
        benchmark: 'NIFTY50',
        stt_rate: sttRate
      });
      setBacktestResults(data);
      toast.success('Historical screen backtest completed!');
    } catch (err) {
      toast.error('Screen backtest failed.');
    } finally {
      setBacktestLoading(false);
    }
  };

  // 7. Save Screen Handler
  const handleSaveScreen = async () => {
    if (!screenName.trim()) {
      toast.error('Please enter a screen name.');
      return;
    }
    try {
      const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
      await api.post('/api/screener/screens', {
        name: screenName,
        formula_query: activeQuery,
        is_public: true,
      });
      toast.success(`Screen saved successfully!`);
      setShowSaveModal(false);
      setScreenName('');
      const res = await api.get('/api/screener/screens');
      setSavedScreens(res.data.saved_screens || []);
    } catch (err) {
      toast.error('Failed to save screen.');
    }
  };

  // Quick Preset Selection
  const applyPreset = (id, query, name) => {
    setActivePresetId(id);
    setFormulaQuery(query);
    setQueryMode('formula');
    setPage(1);
    runScreen(query, 1);
    toast.success(`Applied: ${name}`);
  };

  // Reset Filters Handler
  const handleResetFilters = () => {
    setMinRoce(0);
    setMaxPe(100);
    setMaxDebt(3.0);
    setMinRsi(0);
    setMaxRsi(100);
    setMinVolRatio(0.5);
    setSelectedSector('ALL');
    setMarketCapCat('ALL');
    setFormulaQuery('MarketCap > 0');
    setActivePresetId('all-nse');
    setPage(1);
    runScreen('MarketCap > 0', 1);
    toast.success('Filters reset to default.');
  };

  // Client-side instant filter & sorting
  const processedResults = useMemo(() => {
    let list = [...results];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(r => 
        r.ticker?.toLowerCase().includes(q) || 
        r.name?.toLowerCase().includes(q) ||
        r.sector?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [results, searchFilter, sortColumn, sortDirection]);

  // Paginated Rows Slice
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedResults.slice(start, start + pageSize);
  }, [processedResults, page, pageSize]);

  // Derived KPI Stats
  const kpiStats = useMemo(() => {
    let bullish = 0;
    let volumeSurges = 0;
    let oversold = 0;
    let totalScore = 0;

    processedResults.forEach(r => {
      if (r.ai_signal === 'BUY' || r.ai_signal === 'STRONG BUY') bullish++;
      if ((r.volume_ratio_20d || 1) > 1.3) volumeSurges++;
      if ((r.rsi_14 || 50) < 38) oversold++;
      totalScore += (r.ai_consensus_score || 50);
    });

    return {
      total: processedResults.length,
      bullish,
      volumeSurges,
      oversold,
      avgScore: processedResults.length > 0 ? (totalScore / processedResults.length).toFixed(0) : 50
    };
  }, [processedResults]);

  // Sort Toggle
  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  // Selection Handlers
  const handleToggleSelect = (ticker) => {
    setSelectedTickers(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (paginatedRows.every(r => selectedTickers.has(r.ticker))) {
      setSelectedTickers(prev => {
        const next = new Set(prev);
        paginatedRows.forEach(r => next.delete(r.ticker));
        return next;
      });
    } else {
      setSelectedTickers(prev => {
        const next = new Set(prev);
        paginatedRows.forEach(r => next.add(r.ticker));
        return next;
      });
    }
  };

  // CSV Export Handler
  const handleExportCsv = (dataToExport = processedResults) => {
    if (dataToExport.length === 0) {
      toast.error('No data to export.');
      return;
    }
    const headers = ['Ticker', 'Name', 'Sector', 'Industry', 'Price', '1D Change %', 'P/E', 'ROCE %', 'Debt/Equity', 'RSI (14)', 'Vol Ratio', 'Market Cap (Cr)', 'AI Score', 'AI Signal'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach(r => {
      const values = [
        `"${r.ticker || ''}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.sector || ''}"`,
        `"${r.industry || ''}"`,
        r.close_price || '',
        r.change_1d_pct || '',
        r.pe_ratio || '',
        r.roce_pct || '',
        r.debt_to_equity || '',
        r.rsi_14 || '',
        r.volume_ratio_20d || '',
        r.market_cap_cr || '',
        r.ai_consensus_score || '',
        `"${r.ai_signal || ''}"`
      ];
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StockOracle_Screener_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${dataToExport.length} stocks to CSV!`);
  };

  // Pre-configured Quick Strategy Pills
  const quickPills = [
    { id: 'all-nse', name: '🌐 All NSE Equities (1,500+)', query: 'MarketCap > 0' },
    { id: 'high-roce', name: '💎 High ROCE (>20%)', query: 'ROCE > 20 AND DebtToEquity < 0.5' },
    { id: 'value-growth', name: '🔥 Growth at Fair Value', query: 'ROCE > 18 AND PE < 28 AND DebtToEquity < 1.0' },
    { id: 'oversold', name: '⚡ Oversold Momentum', query: 'RSI14 < 40 AND VolumeRatio20D > 1.1' },
    { id: 'ai-bulls', name: '🤖 AI High Consensus', query: 'AIConsensus > 75 AND VolumeRatio20D > 1.0' },
    { id: 'low-debt', name: '🛡️ Zero / Low Debt', query: 'DebtToEquity < 0.2 AND ROCE > 15' },
  ];

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box', background: '#050711', color: '#F1F5F9' }}>
      
      {/* ── TOP HEADER & ACTION BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #4F46E5, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal size={18} color="#FFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFF' }}>Institutional Screener</span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818CF8', fontSize: '0.65rem', fontWeight: 700 }}>v2.0 PRO</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
              Real-time multi-factor scanning with AI consensus & live WebSocket market timing
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
              background: filtersOpen ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              color: filtersOpen ? '#818CF8' : '#94A3B8', border: filtersOpen ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s'
            }}
          >
            <Filter size={13} /> Filters
            <span style={{ background: '#6366F1', color: '#FFF', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem' }}>
              {queryMode === 'visual' ? '7' : '1'}
            </span>
          </button>

          <button
            onClick={() => handleExportCsv(processedResults)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
            }}
          >
            <Download size={13} /> Export CSV
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
            }}
          >
            <Save size={13} /> Save Screen
          </button>

          <button
            onClick={handleRunBacktest}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 6,
              background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFF', border: 'none',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
            }}
          >
            <Dices size={13} /> Backtest Strategy
          </button>
        </div>
      </div>

      {/* ── KPI SUMMARY CARDS ── */}
      <ScreenerKpiCards stats={kpiStats} />

      {/* ── AI PROMPT & SEARCH BAR ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#0B0F1E', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A855F7', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
          <Sparkles size={14} /> AI Screen:
        </div>
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAiTranslate()}
          placeholder="Ask in plain english: e.g. 'high ROCE debt-free IT companies with RSI < 40'..."
          style={{
            flex: 1, background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.75rem',
            outline: 'none', padding: '4px 0'
          }}
        />
        <button
          onClick={handleAiTranslate}
          disabled={aiLoading}
          style={{
            padding: '4px 11px', borderRadius: 5, background: '#6366F1', color: '#FFF', border: 'none',
            fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          {aiLoading ? <RefreshCw size={11} className="spin" /> : <Play size={11} />}
          Search AI
        </button>
      </div>

      {/* ── QUICK STRATEGY PILLS ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginRight: 2 }}>Quick:</span>
        {quickPills.map(pill => {
          const isActive = activePresetId === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => applyPreset(pill.id, pill.query, pill.name)}
              style={{
                padding: '3px 9px', borderRadius: 14,
                background: isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                border: isActive ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
                color: isActive ? '#A5B4FC' : '#94A3B8',
                fontSize: '0.68rem', fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s'
              }}
            >
              {pill.name}
            </button>
          );
        })}
        {prebuiltTemplates.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => applyPreset(tpl.id, tpl.formula_query, tpl.name)}
            style={{
              padding: '3px 9px', borderRadius: 14,
              background: activePresetId === tpl.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
              border: activePresetId === tpl.id ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.06)',
              color: activePresetId === tpl.id ? '#A5B4FC' : '#64748B',
              fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {/* ── SECTOR DISTRIBUTION CHART ── */}
      <ScreenerSectorChart
        rows={processedResults}
        selectedSector={selectedSector}
        onSelectSector={(sec) => {
          setSelectedSector(sec);
          if (queryMode === 'visual') {
            runScreen();
          }
        }}
      />

      {/* ── EXPANDABLE FILTER DRAWER ── */}
      {filtersOpen && (
        <ScreenerFilters
          universe={universe}
          setUniverse={setUniverse}
          selectedSector={selectedSector}
          setSelectedSector={setSelectedSector}
          minRoce={minRoce}
          setMinRoce={setMinRoce}
          maxPe={maxPe}
          setMaxPe={setMaxPe}
          maxDebt={maxDebt}
          setMaxDebt={setMaxDebt}
          minRsi={minRsi}
          setMinRsi={setMinRsi}
          maxRsi={maxRsi}
          setMaxRsi={setMaxRsi}
          minVolRatio={minVolRatio}
          setMinVolRatio={setMinVolRatio}
          marketCapCat={marketCapCat}
          setMarketCapCat={setMarketCapCat}
          queryMode={queryMode}
          setQueryMode={setQueryMode}
          formulaQuery={formulaQuery}
          setFormulaQuery={setFormulaQuery}
          onResetFilters={handleResetFilters}
          onRunScreen={() => { setPage(1); runScreen(); }}
          loading={loading}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {/* ── TABLE CONTROLS & CATEGORY TABS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: '#080C1A', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'all', label: 'All Columns' },
            { id: 'valuation', label: 'Valuation & Quality' },
            { id: 'technical', label: 'Technical & RSI' },
            { id: 'ai', label: 'AI Score & Signal' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '4px 10px', borderRadius: 5, border: 'none',
                background: activeTab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: activeTab === t.id ? '#818CF8' : '#64748B',
                fontSize: '0.68rem', fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Quick Search in Results */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '3px 8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={11} color="#64748B" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Quick search results..."
              style={{ background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.68rem', outline: 'none', width: 140 }}
            />
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
            Matches: <span style={{ color: '#10B981', fontWeight: 800 }}>{processedResults.length}</span>
          </div>
        </div>
      </div>

      {/* ── MODULAR DATA TABLE ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: '#080C1A',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        minHeight: '380px',
        position: 'relative'
      }}>
        <ScreenerTable
          rows={paginatedRows}
          loading={loading}
          sortBy={sortColumn}
          sortDir={sortDirection}
          onSort={handleSort}
          activeTab={activeTab}
          selectedTickers={selectedTickers}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onInspect={(stock) => setInspectedStock(stock)}
          onNavigateChart={(sym) => { setSelectedSymbol(sym); setActiveView('Live Chart'); }}
          onNavigateFundamentals={(sym) => { setSelectedSymbol(sym); setActiveView('Fundamentals'); }}
          liveTicks={liveTicks}
        />
      </div>

      {/* ── SERVER-SIDE PAGINATION BAR ── */}
      <ScreenerPagination
        totalItems={processedResults.length}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
      />

      {/* ── BULK ACTION FLOATING BAR ── */}
      <ScreenerBulkBar
        selectedCount={selectedTickers.size}
        selectedTickers={Array.from(selectedTickers)}
        onClearSelection={() => setSelectedTickers(new Set())}
        onExportSelected={() => {
          const selectedRows = processedResults.filter(r => selectedTickers.has(r.ticker));
          handleExportCsv(selectedRows);
        }}
        allResults={processedResults}
      />

      {/* ── STOCK INSPECTION FLYOUT DRAWER ── */}
      {inspectedStock && (
        <ScreenerFlyoutDrawer
          stock={inspectedStock}
          onClose={() => setInspectedStock(null)}
          onNavigateChart={(sym) => { setSelectedSymbol(sym); setActiveView('Live Chart'); }}
          onNavigateFundamentals={(sym) => { setSelectedSymbol(sym); setActiveView('Fundamentals'); }}
        />
      )}

      {/* ── HISTORICAL STRATEGY BACKTEST MODAL ── */}
      {showBacktestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4, 5, 14, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dices size={18} color="#10B981" />
                <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#F0F0FF', fontWeight: 800 }}>Historical Strategy Backtester</h2>
              </div>
              <button onClick={() => setShowBacktestModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Backtest Config Controls */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Rebalance:</div>
              <select
                value={holdingDays}
                onChange={(e) => setHoldingDays(Number(e.target.value))}
                style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '3px 8px', color: '#F1F5F9', fontSize: '0.72rem' }}
              >
                <option value="5">Weekly (5 Days)</option>
                <option value="20">Monthly (20 Days)</option>
                <option value="60">Quarterly (60 Days)</option>
              </select>

              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginLeft: 8 }}>STT / Slippage:</div>
              <select
                value={sttRate}
                onChange={(e) => setSttRate(Number(e.target.value))}
                style={{ background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '3px 8px', color: '#F1F5F9', fontSize: '0.72rem' }}
              >
                <option value="0.0005">0.05% Low Friction</option>
                <option value="0.001">0.10% Standard NSE</option>
                <option value="0.002">0.20% Conservative</option>
              </select>

              <button
                onClick={handleRunBacktest}
                disabled={backtestLoading}
                style={{
                  marginLeft: 'auto', padding: '4px 12px', borderRadius: 5, background: '#6366F1',
                  color: '#FFF', border: 'none', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Re-simulate
              </button>
            </div>

            {backtestLoading ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#818CF8' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '0.82rem' }}>Fetching historical price bars & rebalancing against NIFTY 50...</div>
              </div>
            ) : backtestResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.62rem', color: '#6B7280' }}>STRATEGY CAGR</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981' }}>{backtestResults.strategy_cagr_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.62rem', color: '#6B7280' }}>NIFTY 50 CAGR</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#94A3B8' }}>{backtestResults.benchmark_cagr_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.62rem', color: '#6B7280' }}>ALPHA GENERATION</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818CF8' }}>+{backtestResults.alpha_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(244,63,94,0.1)', padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.62rem', color: '#6B7280' }}>MAX DRAWDOWN</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F43F5E' }}>{backtestResults.max_drawdown_pct}%</div>
                  </div>
                </div>

                <div style={{ height: 230, width: '100%', background: '#060913', borderRadius: 8, padding: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={backtestResults.equity_curve || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="#4B5563" fontSize={9} />
                      <YAxis stroke="#4B5563" fontSize={9} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF', fontSize: '0.72rem' }} />
                      <Line type="monotone" dataKey="strategy_value" stroke="#10B981" strokeWidth={2} dot={false} name="Strategy Basket" />
                      <Line type="monotone" dataKey="benchmark_value" stroke="#6B7280" strokeWidth={1.5} dot={false} name="NIFTY 50" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── SAVE CUSTOM SCREEN MODAL ── */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4, 5, 14, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, width: '100%', maxWidth: 380, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#F0F0FF', fontWeight: 800 }}>Save Custom Screen</h2>
            <div>
              <label style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Screen Name</label>
              <input
                type="text"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                placeholder="e.g. High ROCE Breakouts"
                style={{ width: '100%', background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', color: '#F0F0FF', marginTop: 4, outline: 'none', fontSize: '0.75rem' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: '5px 10px', borderRadius: 6, background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.72rem', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveScreen} style={{ padding: '5px 12px', borderRadius: 6, background: '#6366F1', color: '#FFFFFF', border: 'none', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Save Screen</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
