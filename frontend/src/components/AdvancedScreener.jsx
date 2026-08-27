import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useStore from '../store/useStore';
import {
  SlidersHorizontal, Sparkles, Terminal, Play, Save, Share2,
  TrendingUp, Dices, ChevronRight, CheckCircle, AlertCircle, RefreshCw,
  Search, Shield, Layers, BarChart2, BookOpen
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

export default function AdvancedScreener() {
  const { setSelectedSymbol, setActiveView } = useStore();

  // Mode: 'formula' | 'visual'
  const [queryMode, setQueryMode] = useState('formula');

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Formula Query State
  const [formulaQuery, setFormulaQuery] = useState('ROCE > 20 AND DebtToEquity < 0.5 AND RSI14 < 60');
  const [queryAst, setQueryAst] = useState(null);

  // Visual Filter State
  const [minRoce, setMinRoce] = useState(15);
  const [maxPe, setMaxPe] = useState(35);
  const [maxDebt, setMaxDebt] = useState(0.8);
  const [minRsi, setMinRsi] = useState(30);
  const [maxRsi, setMaxRsi] = useState(70);
  const [minVolRatio, setMinVolRatio] = useState(1.0);
  const [selectedSector, setSelectedSector] = useState('ALL');

  // Results State
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('market_cap_cr');
  const [sortDir, setSortDir] = useState('DESC');

  // Saved Screens & Presets
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [savedScreens, setSavedScreens] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');

  // Backtest Modal State
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const [holdingDays, setHoldingDays] = useState(20);

  // 1. Fetch Presets on Mount
  useEffect(() => {
    const fetchScreens = async () => {
      try {
        const { data } = await api.get('/api/screener/screens');
        setPrebuiltTemplates(data.prebuilt_templates || []);
        setSavedScreens(data.saved_screens || []);
      } catch (err) {
        console.error('Failed to load screen templates', err);
      }
    };
    fetchScreens();
  }, []);

  // 2. Execute Screener Query
  const runScreen = useCallback(async (queryStr) => {
    setLoading(true);
    const activeQuery = queryStr || (queryMode === 'formula' ? formulaQuery : buildVisualFormula());
    try {
      const { data } = await api.post('/api/screener/query', {
        formula_query: activeQuery,
        sort_by: sortBy,
        sort_dir: sortDir,
        limit: 200,
      });
      setResults(data.results || []);
      setTotalCount(data.total || 0);
      setQueryAst(data.ast);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to execute screener query.');

    } finally {
      setLoading(false);
    }
  }, [queryMode, formulaQuery, minRoce, maxPe, maxDebt, minRsi, maxRsi, minVolRatio, selectedSector, sortBy, sortDir]);

  // Build formula string from visual controls
  const buildVisualFormula = () => {
    const parts = [];
    if (minRoce > 0) parts.append ? parts.push(`ROCE > ${minRoce}`) : parts.push(`ROCE > ${minRoce}`);
    if (maxPe < 100) parts.push(`PE < ${maxPe}`);
    if (maxDebt < 5.0) parts.push(`DebtToEquity < ${maxDebt}`);
    if (minRsi > 0) parts.push(`RSI14 > ${minRsi}`);
    if (maxRsi < 100) parts.push(`RSI14 < ${maxRsi}`);
    if (minVolRatio > 0.5) parts.push(`VolumeRatio20D > ${minVolRatio}`);
    if (selectedSector && selectedSector !== 'ALL') parts.push(`sector == '${selectedSector}'`);
    return parts.length ? parts.join(' AND ') : '1=1';
  };

  useEffect(() => {
    runScreen();
  }, [sortBy, sortDir]);

  // 3. AI Natural Language to Formula Convert
  const handleAiTranslate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/api/screener/ai-parse', { prompt: aiPrompt });
      if (data.formula_query) {
        setFormulaQuery(data.formula_query);
        setQueryMode('formula');
        toast.success(`AI Generated: ${data.formula_query}`);
        runScreen(data.formula_query);
      }
    } catch (err) {
      toast.error('AI translation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // 4. Run Screen Backtest
  const handleRunBacktest = async () => {
    setBacktestLoading(true);
    setShowBacktestModal(true);
    try {
      const activeQuery = queryMode === 'formula' ? formulaQuery : buildVisualFormula();
      const { data } = await api.post('/api/screener/backtest', {
        formula_query: activeQuery,
        holding_period_days: parseInt(holdingDays, 10),
      });
      setBacktestResults(data);
    } catch (err) {
      toast.error('Screen backtest failed.');
    } finally {
      setBacktestLoading(false);
    }
  };

  // 5. Save Custom Screen
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
      toast.success(`Screen saved! Share token: ${data.share_token}`);
      setShowSaveModal(false);
      setScreenName('');
      // Refresh list
      const res = await api.get('/api/screener/screens');
      setSavedScreens(res.data.saved_screens || []);
    } catch (err) {
      toast.error('Failed to save screen.');
    }
  };

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#F0F0FF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={20} color="#818CF8" />
            Institutional Multi-Factor Screener
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
            Combine Screener.in fundamental ratios with Technical timing, AI consensus & historical backtests.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowSaveModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem'
            }}
          >
            <Save size={14} /> Save Screen
          </button>
          <button
            onClick={handleRunBacktest}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(16,185,129,0.25)'
            }}
          >
            <Dices size={15} /> Backtest Screen
          </button>
        </div>
      </div>

      {/* ── AI Natural Language Prompt Bar ── */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A855F7', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          <Sparkles size={16} /> AI Natural Language Query:
        </div>
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAiTranslate()}
          placeholder="e.g. Find high ROCE, low debt, oversold IT stocks with rising volume..."
          style={{
            flex: 1, minWidth: 280, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 14px', color: '#F0F0FF', fontSize: '0.85rem', outline: 'none'
          }}
        />
        <button
          onClick={handleAiTranslate}
          disabled={aiLoading}
          style={{
            padding: '8px 16px', borderRadius: 8, background: '#6366F1', color: '#FFFFFF', border: 'none',
            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          {aiLoading ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
          Convert to Screen
        </button>
      </div>

      {/* ── Pre-Built Institutional Screen Presets ── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          onClick={() => {
            setFormulaQuery('MarketCap > 0');
            setQueryMode('formula');
            runScreen('MarketCap > 0');
            toast.success('Loaded All NSE Stocks Universe (75+)');
          }}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            background: formulaQuery === 'MarketCap > 0' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)',
            border: formulaQuery === 'MarketCap > 0' ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.12)',
            color: formulaQuery === 'MarketCap > 0' ? '#10B981' : '#CBD5E1',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s'
          }}
        >
          🌐 All NSE Stocks (75+)
        </button>
        {prebuiltTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => {
              setFormulaQuery(tpl.formula_query);
              setQueryMode('formula');
              runScreen(tpl.formula_query);
              toast.success(`Loaded ${tpl.name}`);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              background: formulaQuery === tpl.formula_query ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
              border: formulaQuery === tpl.formula_query ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
              color: formulaQuery === tpl.formula_query ? '#F0F0FF' : '#94A3B8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>


      {/* ── Dual Mode Query Editor & Controls ── */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setQueryMode('formula')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none',
                background: queryMode === 'formula' ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: queryMode === 'formula' ? '#818CF8' : '#94A3B8', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              <Terminal size={14} /> Screener.in Formula Query Mode
            </button>
            <button
              onClick={() => setQueryMode('visual')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none',
                background: queryMode === 'visual' ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: queryMode === 'visual' ? '#818CF8' : '#94A3B8', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              <SlidersHorizontal size={14} /> Visual Filter Builder
            </button>
          </div>

          <button
            onClick={() => runScreen()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8,
              background: '#4F46E5', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            {loading ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
            Run Screen
          </button>
        </div>

        {/* Formula Mode Input */}
        {queryMode === 'formula' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={formulaQuery}
              onChange={(e) => setFormulaQuery(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                background: '#060913',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#38BDF8',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.88rem',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#64748B', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>Allowed metrics: <code>ROCE</code>, <code>ROE</code>, <code>PE</code>, <code>PB</code>, <code>DebtToEquity</code>, <code>RSI14</code>, <code>VolumeRatio20D</code>, <code>MarketCap</code>, <code>ProfitGrowth3Y</code>, <code>Sector</code></span>
            </div>
          </div>
        ) : (
          /* Visual Mode Sliders */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                <span>Min ROCE %</span><strong>{minRoce}%</strong>
              </div>
              <input type="range" min="0" max="60" value={minRoce} onChange={(e) => setMinRoce(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                <span>Max P/E Ratio</span><strong>{maxPe}x</strong>
              </div>
              <input type="range" min="5" max="80" value={maxPe} onChange={(e) => setMaxPe(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                <span>Max Debt/Equity</span><strong>{maxDebt}x</strong>
              </div>
              <input type="range" min="0" max="3" step="0.1" value={maxDebt} onChange={(e) => setMaxDebt(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                <span>RSI (14) Range</span><strong>{minRsi} - {maxRsi}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="range" min="0" max="50" value={minRsi} onChange={(e) => setMinRsi(Number(e.target.value))} style={{ width: '50%' }} />
                <input type="range" min="50" max="100" value={maxRsi} onChange={(e) => setMaxRsi(Number(e.target.value))} style={{ width: '50%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                <span>Min Volume Surge</span><strong>{minVolRatio}x</strong>
              </div>
              <input type="range" min="0.5" max="3.0" step="0.1" value={minVolRatio} onChange={(e) => setMinVolRatio(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Virtualized Results Table ── */}
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 12,
        padding: '16px 20px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#F0F0FF' }}>
            Found <span style={{ color: '#10B981' }}>{totalCount}</span> matching stocks
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Precomputed SQL index • Latency ~24ms
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px' }}>Ticker</th>
              <th style={{ textAlign: 'left', padding: '10px 8px' }}>Sector</th>
              <th style={{ padding: '10px 8px' }}>Price ₹</th>
              <th style={{ padding: '10px 8px' }}>1D %</th>
              <th style={{ padding: '10px 8px' }}>P/E</th>
              <th style={{ padding: '10px 8px' }}>ROCE %</th>
              <th style={{ padding: '10px 8px' }}>D/E</th>
              <th style={{ padding: '10px 8px' }}>RSI</th>
              <th style={{ padding: '10px 8px' }}>Vol Ratio</th>
              <th style={{ padding: '10px 8px' }}>AI Consensus</th>
              <th style={{ padding: '10px 8px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#CBD5E1' }}>
                <td style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, color: '#F0F0FF' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{r.ticker}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 400 }}>{r.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', color: '#94A3B8' }}>{r.sector}</td>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>₹{Number(r.close_price).toLocaleString('en-IN')}</td>
                <td style={{ padding: '10px 8px', color: (r.change_1d_pct || 0) >= 0 ? '#10B981' : '#EF5350' }}>
                  {r.change_1d_pct != null ? `${r.change_1d_pct > 0 ? '+' : ''}${r.change_1d_pct}%` : '—'}
                </td>
                <td style={{ padding: '10px 8px' }}>{r.pe_ratio}</td>
                <td style={{ padding: '10px 8px', color: (r.roce_pct || 0) > 20 ? '#10B981' : '#CBD5E1', fontWeight: 600 }}>{r.roce_pct}%</td>
                <td style={{ padding: '10px 8px' }}>{r.debt_to_equity}</td>
                <td style={{ padding: '10px 8px', color: (r.rsi_14 || 50) < 40 ? '#10B981' : (r.rsi_14 || 50) > 70 ? '#EF5350' : '#CBD5E1' }}>{r.rsi_14}</td>
                <td style={{ padding: '10px 8px' }}>{r.volume_ratio_20d}x</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                    background: (r.ai_consensus_score || 50) > 80 ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                    color: (r.ai_consensus_score || 50) > 80 ? '#10B981' : '#818CF8'
                  }}>
                    {r.ai_consensus_score} ({r.ai_signal || 'BUY'})
                  </span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <button
                    onClick={() => {
                      setSelectedSymbol(r.ticker);
                      setActiveView('Fundamentals');
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.15)',
                      color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
                      fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <BookOpen size={11} /> Research
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Screen Backtest Modal ── */}
      {showBacktestModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(4, 5, 14, 0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20
        }}>
          <div style={{
            background: '#0C1022', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16,
            width: '100%', maxWidth: 840, maxHeight: '90vh', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dices size={20} color="#10B981" />
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#F0F0FF', fontWeight: 800 }}>Historical Screen Backtester</h2>
              </div>
              <button onClick={() => setShowBacktestModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {backtestLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#818CF8' }}>
                <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px' }} />
                <div>Simulating historical screen rebalance against NIFTY 50...</div>
              </div>
            ) : backtestResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>STRATEGY CAGR</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10B981' }}>{backtestResults.strategy_cagr_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>NIFTY 50 CAGR</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#94A3B8' }}>{backtestResults.benchmark_cagr_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>ALPHA GENERATION</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#818CF8' }}>+{backtestResults.alpha_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>MAX DRAWDOWN</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F43F5E' }}>{backtestResults.max_drawdown_pct}%</div>
                  </div>
                </div>

                {/* Equity Curve Chart */}
                <div style={{ height: 260, width: '100%', background: '#060913', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={backtestResults.equity_curve || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="#4B5563" fontSize={10} />
                      <YAxis stroke="#4B5563" fontSize={10} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#0F172A', borderColor: 'rgba(99,102,241,0.3)', color: '#F0F0FF' }} />
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

      {/* ── Save Screen Modal ── */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(4, 5, 14, 0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20
        }}>
          <div style={{
            background: '#0C1022', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16,
            width: '100%', maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#F0F0FF', fontWeight: 800 }}>Save Custom Screen</h2>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4, display: 'block' }}>Screen Name</label>
              <input
                type="text"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                placeholder="e.g. My High ROCE Tech Scan"
                style={{ width: '100%', background: '#060913', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '8px 12px', color: '#F0F0FF', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveScreen} style={{ padding: '8px 18px', borderRadius: 8, background: '#6366F1', color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Save Screen</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
