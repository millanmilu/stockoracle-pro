import React, { useState, useEffect, useRef, useMemo } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { 
  SlidersHorizontal, Sparkles, Terminal, Play, 
  Dices, Save, BookOpen, RefreshCw, Layers,
  ChevronDown, ChevronUp, ArrowUpDown, Filter,
  Search, Check, TrendingUp, BarChart2, Zap, Shield, HelpCircle, ExternalLink
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';

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
  const [sortColumn, setSortColumn] = useState('ai_consensus_score');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Formula State
  const [formulaQuery, setFormulaQuery] = useState('MarketCap > 0 AND ROCE > 15 AND PE < 35');

  // Visual Filter Sliders
  const [minRoce, setMinRoce] = useState(15);
  const [maxPe, setMaxPe] = useState(40);
  const [maxDebt, setMaxDebt] = useState(1.5);
  const [minRsi, setMinRsi] = useState(0);
  const [maxRsi, setMaxRsi] = useState(100);
  const [minVolRatio, setMinVolRatio] = useState(0.8);
  const [selectedSector, setSelectedSector] = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);
  const [activePresetId, setActivePresetId] = useState('all-nse');

  // Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const [holdingDays, setHoldingDays] = useState(20);

  const parentRef = useRef(null);

  // 1. Fetch Presets & Initial Data on Mount
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/api/screener/screens');
        setPrebuiltTemplates(data.prebuilt_templates || []);
        setSavedScreens(data.saved_screens || []);
      } catch (err) {
        console.error('Failed to load screens', err);
      }
      runScreen('MarketCap > 0');
    };
    init();
  }, []);

  // 2. Build Visual Formula
  const buildVisualFormula = () => {
    let formula = `ROCE > ${minRoce} AND PE < ${maxPe} AND DebtToEquity < ${maxDebt} AND RSI14 > ${minRsi} AND RSI14 < ${maxRsi} AND VolumeRatio20D > ${minVolRatio}`;
    if (selectedSector !== 'ALL') {
      formula += ` AND Sector == '${selectedSector}'`;
    }
    return formula;
  };

  // 3. Run Screen API
  const runScreen = async (query = null) => {
    setLoading(true);
    const activeQuery = query || (queryMode === 'formula' ? formulaQuery : buildVisualFormula());
    try {
      const { data } = await api.post('/api/screener/run', {
        formula_query: activeQuery,
        sort_by: sortColumn,
        sort_desc: sortDirection === 'desc',
        limit: 300
      });
      setResults(data.results || []);
      setTotalCount(data.total_matches || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Screener query failed');
    } finally {
      setLoading(false);
    }
  };

  // 4. AI Translate Natural Language
  const handleAiTranslate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/api/screener/nl-to-screen', { nl_query: aiPrompt });
      setFormulaQuery(data.formula_query);
      setQueryMode('formula');
      setActivePresetId(null);
      runScreen(data.formula_query);
      toast.success('AI mapped query to formula criteria!');
    } catch (err) {
      toast.error('AI could not parse your query.');
    } finally {
      setAiLoading(false);
    }
  };

  // 5. Backtest Runner
  const handleRunBacktest = async () => {
    setShowBacktestModal(true);
    setBacktestLoading(true);
    const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
    try {
      const { data } = await api.post('/api/screener/backtest', {
        formula_query: activeQuery,
        holding_period_days: holdingDays,
        benchmark: 'NIFTY50'
      });
      setBacktestResults(data);
      toast.success('Screen backtest simulated!');
    } catch (err) {
      toast.error('Screen backtest failed.');
    } finally {
      setBacktestLoading(false);
    }
  };

  // 6. Save Screen Handler
  const handleSaveScreen = async () => {
    if (!screenName.trim()) {
      toast.error('Please enter a screen name.');
      return;
    }
    try {
      const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
      const { data } = await api.post('/api/screener/screens', {
        name: screenName,
        formula_query: activeQuery,
        is_public: true,
      });
      toast.success(`Screen saved: ${data.share_token}`);
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
    runScreen(query);
    toast.success(`Applied: ${name}`);
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

  // Virtualizer for smooth rendering
  const rowVirtualizer = useVirtualizer({
    count: processedResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 12,
  });

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (col) => {
    if (sortColumn !== col) return <ArrowUpDown size={10} style={{ opacity: 0.35 }} />;
    return sortDirection === 'asc' ? <ChevronUp size={12} color="#10B981" /> : <ChevronDown size={12} color="#10B981" />;
  };

  // Pre-configured Quick Strategy Pills
  const quickPills = [
    { id: 'all-nse', name: '🌐 All Stocks (75+)', query: 'MarketCap > 0' },
    { id: 'high-roce', name: '💎 High ROCE (>20%)', query: 'ROCE > 20 AND DebtToEquity < 0.5' },
    { id: 'value-growth', name: '🔥 Growth at Fair Value', query: 'ROCE > 18 AND PE < 28 AND DebtToEquity < 1.0' },
    { id: 'oversold', name: '⚡ Oversold Momentum', query: 'RSI14 < 40 AND VolumeRatio20D > 1.2' },
    { id: 'ai-bulls', name: '🤖 AI Top Ranked', query: 'MarketCap > 0' },
    { id: 'low-debt', name: '🛡️ Zero / Low Debt', query: 'DebtToEquity < 0.2 AND ROCE > 15' },
  ];

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%', boxSizing: 'border-box', background: '#050711', color: '#F1F5F9' }}>
      
      {/* ── TOP HEADER & ACTION BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #4F46E5, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal size={16} color="#FFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFF' }}>Institutional Screener</span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818CF8', fontSize: '0.65rem', fontWeight: 700 }}>v2.0 PRO</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
              Real-time multi-factor scanning with AI consensus & technical timing
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6,
              background: filtersOpen ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              color: filtersOpen ? '#818CF8' : '#94A3B8', border: filtersOpen ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s'
            }}
          >
            <Filter size={13} /> Filters
            <span style={{ background: '#6366F1', color: '#FFF', borderRadius: '50%', width: 15, height: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem' }}>
              {queryMode === 'visual' ? '6' : '1'}
            </span>
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
            }}
          >
            <Save size={13} /> Save
          </button>

          <button
            onClick={handleRunBacktest}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6,
              background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFF', border: 'none',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
            }}
          >
            <Dices size={13} /> Backtest Strategy
          </button>
        </div>
      </div>

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
            padding: '4px 10px', borderRadius: 5, background: '#6366F1', color: '#FFF', border: 'none',
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

      {/* ── EXPANDABLE FILTER DRAWER ── */}
      {filtersOpen && (
        <div style={{ background: '#090D1C', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setQueryMode('visual')}
                style={{
                  padding: '4px 10px', borderRadius: 5, border: 'none',
                  background: queryMode === 'visual' ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: queryMode === 'visual' ? '#818CF8' : '#64748B', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Sliders Filter Builder
              </button>
              <button
                onClick={() => setQueryMode('formula')}
                style={{
                  padding: '4px 10px', borderRadius: 5, border: 'none',
                  background: queryMode === 'formula' ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: queryMode === 'formula' ? '#818CF8' : '#64748B', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Screener.in SQL Formula
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => runScreen()}
                disabled={loading}
                style={{
                  padding: '4px 12px', borderRadius: 5, background: '#10B981', color: '#FFF', border: 'none',
                  fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                {loading ? <RefreshCw size={11} className="spin" /> : <Play size={11} />} Apply & Run
              </button>
              <button
                onClick={() => setFiltersOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                ✕
              </button>
            </div>
          </div>

          {queryMode === 'visual' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
                  <span>Min ROCE %</span><strong style={{ color: '#10B981' }}>{minRoce}%</strong>
                </div>
                <input type="range" min="0" max="60" value={minRoce} onChange={(e) => setMinRoce(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
                  <span>Max P/E Ratio</span><strong style={{ color: '#38BDF8' }}>{maxPe}x</strong>
                </div>
                <input type="range" min="5" max="80" value={maxPe} onChange={(e) => setMaxPe(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
                  <span>Max Debt/Equity</span><strong style={{ color: '#F59E0B' }}>{maxDebt}x</strong>
                </div>
                <input type="range" min="0" max="3" step="0.1" value={maxDebt} onChange={(e) => setMaxDebt(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
                  <span>RSI (14) Range</span><strong>{minRsi} - {maxRsi}</strong>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="range" min="0" max="50" value={minRsi} onChange={(e) => setMinRsi(Number(e.target.value))} style={{ width: '50%' }} />
                  <input type="range" min="50" max="100" value={maxRsi} onChange={(e) => setMaxRsi(Number(e.target.value))} style={{ width: '50%' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
                  <span>Min Vol Surge</span><strong style={{ color: '#A855F7' }}>{minVolRatio}x</strong>
                </div>
                <input type="range" min="0.5" max="3.0" step="0.1" value={minVolRatio} onChange={(e) => setMinVolRatio(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 2 }}>
                  <span>Sector Filter</span>
                </div>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  style={{ width: '100%', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px', color: '#F1F5F9', fontSize: '0.68rem' }}
                >
                  <option value="ALL">All Sectors</option>
                  <option value="IT">IT & Tech</option>
                  <option value="Banking">Banking & Finance</option>
                  <option value="Pharma">Pharma & Healthcare</option>
                  <option value="Auto">Automobiles</option>
                  <option value="Energy">Energy & Oil</option>
                  <option value="FMCG">FMCG & Retail</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                value={formulaQuery}
                onChange={(e) => setFormulaQuery(e.target.value)}
                rows={2}
                style={{
                  width: '100%', background: '#060913', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 6, padding: '6px 10px', color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.72rem', outline: 'none'
                }}
              />
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 4 }}>
                Variables: <code>ROCE</code>, <code>ROE</code>, <code>PE</code>, <code>DebtToEquity</code>, <code>RSI14</code>, <code>VolumeRatio20D</code>, <code>MarketCap</code>, <code>Sector</code>
              </div>
            </div>
          )}
        </div>
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
              style={{ background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.68rem', outline: 'none', width: 130 }}
            />
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
            Matches: <span style={{ color: '#10B981', fontWeight: 800 }}>{processedResults.length}</span>
          </div>
        </div>
      </div>

      {/* ── VIRTUALIZED DATA TABLE ── */}
      <div 
        ref={parentRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          background: '#080C1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          position: 'relative'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0C1124', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', width: 35 }}>#</th>
              <th onClick={() => handleSort('ticker')} style={{ textAlign: 'left', padding: '6px 8px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Ticker {getSortIcon('ticker')}</div>
              </th>
              <th onClick={() => handleSort('sector')} style={{ textAlign: 'left', padding: '6px 8px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Sector {getSortIcon('sector')}</div>
              </th>
              <th onClick={() => handleSort('close_price')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>Price ₹ {getSortIcon('close_price')}</div>
              </th>
              <th onClick={() => handleSort('change_1d_pct')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>1D % {getSortIcon('change_1d_pct')}</div>
              </th>

              {(activeTab === 'all' || activeTab === 'valuation') && (
                <>
                  <th onClick={() => handleSort('pe_ratio')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>P/E {getSortIcon('pe_ratio')}</div>
                  </th>
                  <th onClick={() => handleSort('roce_pct')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>ROCE % {getSortIcon('roce_pct')}</div>
                  </th>
                  <th onClick={() => handleSort('debt_to_equity')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>D/E {getSortIcon('debt_to_equity')}</div>
                  </th>
                </>
              )}

              {(activeTab === 'all' || activeTab === 'technical') && (
                <>
                  <th onClick={() => handleSort('rsi_14')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>RSI (14) {getSortIcon('rsi_14')}</div>
                  </th>
                  <th onClick={() => handleSort('volume_ratio_20d')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>Vol Surge {getSortIcon('volume_ratio_20d')}</div>
                  </th>
                </>
              )}

              {(activeTab === 'all' || activeTab === 'ai') && (
                <th onClick={() => handleSort('ai_consensus_score')} style={{ padding: '6px 8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>AI Score {getSortIcon('ai_consensus_score')}</div>
                </th>
              )}

              <th style={{ padding: '6px 8px', textAlign: 'center', width: 90 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rowVirtualizer.getVirtualItems()[0]?.start > 0 && (
              <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
                <td colSpan="12" style={{ padding: 0, border: 0 }}></td>
              </tr>
            )}

            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const r = processedResults[virtualRow.index];
              if (!r) return null;
              const isPositive = (r.change_1d_pct || 0) >= 0;
              const isHighRoce = (r.roce_pct || 0) >= 20;
              const isOverbought = (r.rsi_14 || 50) >= 70;
              const isOversold = (r.rsi_14 || 50) <= 35;
              const isStrongAi = (r.ai_consensus_score || 50) >= 80;

              return (
                <tr
                  key={r.ticker || virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    textAlign: 'right',
                    color: '#CBD5E1',
                    background: virtualRow.index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = virtualRow.index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                >
                  <td style={{ textAlign: 'left', padding: '5px 8px', color: '#475569', fontSize: '0.62rem' }}>
                    {virtualRow.index + 1}
                  </td>

                  {/* Ticker & Name */}
                  <td style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 700, color: '#F8FAFC' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#38BDF8', cursor: 'pointer' }} onClick={() => { setSelectedSymbol(r.ticker); setActiveView('Live Chart'); }}>
                        {r.ticker}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 400, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                    </div>
                  </td>

                  {/* Sector */}
                  <td style={{ textAlign: 'left', padding: '5px 8px' }}>
                    <span style={{ padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontSize: '0.62rem' }}>
                      {r.sector || 'General'}
                    </span>
                  </td>

                  {/* Price */}
                  <td style={{ padding: '5px 8px', fontWeight: 700, color: '#F1F5F9' }}>
                    ₹{Number(r.close_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>

                  {/* 1D Change */}
                  <td style={{ padding: '5px 8px', color: isPositive ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                    {isPositive ? '+' : ''}{r.change_1d_pct != null ? `${r.change_1d_pct}%` : '—'}
                  </td>

                  {/* Valuation metrics */}
                  {(activeTab === 'all' || activeTab === 'valuation') && (
                    <>
                      <td style={{ padding: '5px 8px', color: (r.pe_ratio || 0) < 25 ? '#38BDF8' : '#CBD5E1' }}>
                        {r.pe_ratio != null ? `${r.pe_ratio}x` : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', color: isHighRoce ? '#10B981' : '#CBD5E1', fontWeight: isHighRoce ? 700 : 500 }}>
                        {r.roce_pct != null ? `${r.roce_pct}%` : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', color: (r.debt_to_equity || 0) < 0.5 ? '#10B981' : '#F59E0B' }}>
                        {r.debt_to_equity != null ? r.debt_to_equity : '—'}
                      </td>
                    </>
                  )}

                  {/* Technical metrics */}
                  {(activeTab === 'all' || activeTab === 'technical') && (
                    <>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{
                          padding: '2px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 600,
                          background: isOverbought ? 'rgba(239,68,68,0.15)' : isOversold ? 'rgba(16,185,129,0.15)' : 'transparent',
                          color: isOverbought ? '#EF4444' : isOversold ? '#10B981' : '#94A3B8'
                        }}>
                          {r.rsi_14 != null ? r.rsi_14 : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '5px 8px', color: (r.volume_ratio_20d || 1) > 1.5 ? '#A855F7' : '#94A3B8', fontWeight: (r.volume_ratio_20d || 1) > 1.5 ? 700 : 400 }}>
                        {r.volume_ratio_20d != null ? `${r.volume_ratio_20d}x` : '—'}
                      </td>
                    </>
                  )}

                  {/* AI Consensus Score */}
                  {(activeTab === 'all' || activeTab === 'ai') && (
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 800,
                        background: isStrongAi ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.15)',
                        color: isStrongAi ? '#10B981' : '#818CF8',
                        border: isStrongAi ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(99,102,241,0.3)'
                      }}>
                        {r.ai_consensus_score || 50} • {r.ai_signal || 'BUY'}
                      </span>
                    </td>
                  )}

                  {/* Quick Actions */}
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => { setSelectedSymbol(r.ticker); setActiveView('Live Chart'); }}
                        title="Open Live Chart"
                        style={{
                          padding: '3px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.12)',
                          color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)', cursor: 'pointer',
                          fontSize: '0.6rem', fontWeight: 600
                        }}
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => { setSelectedSymbol(r.ticker); setActiveView('Fundamentals'); }}
                        title="View Research & Ratios"
                        style={{
                          padding: '3px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)',
                          color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer',
                          fontSize: '0.6rem', fontWeight: 600
                        }}
                      >
                        Info
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end }}>
                <td colSpan="12" style={{ padding: 0, border: 0 }}></td>
              </tr>
            )}
          </tbody>
        </table>

        {processedResults.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B', fontSize: '0.78rem' }}>
            No stocks matched current criteria. Try resetting or relaxing your filters.
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {showBacktestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4, 5, 14, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#0C1022', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dices size={18} color="#10B981" />
                <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#F0F0FF', fontWeight: 800 }}>Historical Strategy Backtester</h2>
              </div>
              <button onClick={() => setShowBacktestModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
            </div>
            {backtestLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#818CF8' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '0.8rem' }}>Simulating historical screen rebalance against NIFTY 50...</div>
              </div>
            ) : backtestResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 6 }}><div style={{ fontSize: '0.62rem', color: '#6B7280' }}>STRATEGY CAGR</div><div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10B981' }}>{backtestResults.strategy_cagr_pct}%</div></div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6 }}><div style={{ fontSize: '0.62rem', color: '#6B7280' }}>NIFTY 50 CAGR</div><div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#94A3B8' }}>{backtestResults.benchmark_cagr_pct}%</div></div>
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: 8, borderRadius: 6 }}><div style={{ fontSize: '0.62rem', color: '#6B7280' }}>ALPHA GENERATION</div><div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#818CF8' }}>+{backtestResults.alpha_pct}%</div></div>
                  <div style={{ background: 'rgba(244,63,94,0.1)', padding: 8, borderRadius: 6 }}><div style={{ fontSize: '0.62rem', color: '#6B7280' }}>MAX DRAWDOWN</div><div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F43F5E' }}>{backtestResults.max_drawdown_pct}%</div></div>
                </div>
                <div style={{ height: 220, width: '100%', background: '#060913', borderRadius: 8, padding: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={backtestResults.equity_curve || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="#4B5563" fontSize={9} />
                      <YAxis stroke="#4B5563" fontSize={9} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF', fontSize: '0.72rem' }} />
                      <Line type="monotone" dataKey="strategy_value" stroke="#10B981" strokeWidth={2} dot={false} name="Strategy" />
                      <Line type="monotone" dataKey="benchmark_value" stroke="#6B7280" strokeWidth={1.5} dot={false} name="NIFTY 50" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

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
