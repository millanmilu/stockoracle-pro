import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../store/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { 
  ChevronDown, ChevronUp, Sparkles, RefreshCw, ExternalLink, 
  Search, Filter, Globe, TrendingUp, TrendingDown, Clock, 
  Share2, Newspaper, CheckCircle2, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Source Brand Colors ────────────────────────────────────────────────────────
const SOURCE_COLORS = {
  'Economic Times': { bg: 'rgba(225, 29, 72, 0.15)', text: '#FB7185', border: 'rgba(225, 29, 72, 0.35)' },
  'Moneycontrol':   { bg: 'rgba(37, 99, 235, 0.15)',  text: '#60A5FA', border: 'rgba(37, 99, 235, 0.35)' },
  'LiveMint':       { bg: 'rgba(249, 115, 22, 0.15)', text: '#FB923C', border: 'rgba(249, 115, 22, 0.35)' },
  'Yahoo Finance':  { bg: 'rgba(124, 58, 237, 0.15)', text: '#A78BFA', border: 'rgba(124, 58, 237, 0.35)' },
  'Google News':    { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.35)' },
  'Reuters':        { bg: 'rgba(234, 88, 12, 0.15)',  text: '#FDBA74', border: 'rgba(234, 88, 12, 0.35)' },
  'Bloomberg':      { bg: 'rgba(79, 70, 229, 0.15)',  text: '#818CF8', border: 'rgba(79, 70, 229, 0.35)' },
  'Business Standard': { bg: 'rgba(2, 132, 199, 0.15)', text: '#38BDF8', border: 'rgba(2, 132, 199, 0.35)' },
  'Default':        { bg: 'rgba(100, 116, 139, 0.15)', text: '#94A3B8', border: 'rgba(100, 116, 139, 0.3)' }
};

const SENTIMENT_COLORS = {
  'Strongly Bullish': '#10B981',
  'Bullish': '#22C55E',
  'Neutral': '#EAB308',
  'Bearish': '#F97316',
  'Strongly Bearish': '#EF4444',
};

// ── AI News Summary Card ───────────────────────────────────────────────────────
function AiNewsSummary({ ticker }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const fetchSummary = () => {
    setSummary(null);
    setLoading(true);
    api.get(`/api/stock/${ticker}/news-summary`)
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSummary();
  }, [ticker]);

  const color = summary ? (SENTIMENT_COLORS[summary.sentiment] || '#EAB308') : '#EAB308';

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, backdropFilter: 'blur(10px)' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="#818CF8" />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F0F0FF', letterSpacing: '0.02em' }}>AI EXECUTIVE INTELLIGENCE SUMMARY</span>
          {summary && (
            <span style={{ padding: '2px 9px', borderRadius: 6, background: `${color}20`, color, fontSize: '0.7rem', fontWeight: 800, border: `1px solid ${color}40` }}>
              {summary.sentiment}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            title="Re-run AI Analysis"
            onClick={(e) => { e.stopPropagation(); fetchSummary(); }}
            style={{ background: 'transparent', border: 'none', color: '#818CF8', cursor: 'pointer', padding: 2 }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          {collapsed ? <ChevronDown size={16} color="#6B7280" /> : <ChevronUp size={16} color="#6B7280" />}
        </div>
      </div>

      {!collapsed && (
        loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 6px 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            <RefreshCw size={14} className="spin" color="#818CF8" />
            Analyzing cross-publisher headlines with multi-AI engine…
          </div>
        ) : summary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 12 }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#E2E8F0', lineHeight: 1.65 }}>{summary.summary}</p>
            {summary.risks && summary.risks.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700 }}>KEY RISKS:</span>
                {summary.risks.map((r, i) => (
                  <span key={i} style={{ padding: '2px 9px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.12)', color: '#FCA5A5', fontSize: '0.68rem', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    ⚠ {r}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8', paddingTop: 2 }}>
              <div>
                Estimated Market Impact: <strong style={{ color: summary.impact === 'Positive' ? '#10B981' : summary.impact === 'Negative' ? '#EF4444' : '#EAB308', fontWeight: 800 }}>{summary.impact}</strong>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Synthesized across financial publications</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 10 }}>
            AI news analysis temporarily unavailable. Check Broker & AI Settings for configured providers.
          </div>
        )
      )}
    </div>
  );
}

// ── Main NewsPanel Component ───────────────────────────────────────────────────
export default function NewsPanel({ ticker: propTicker }) {
  const storeSymbol = useStore(s => s.selectedSymbol);
  const selectedSymbol = propTicker || storeSymbol || 'RELIANCE';

  const [articles, setArticles] = useState([]);
  const [sourcesList, setSourcesList] = useState(['All Sources']);
  const [activeSource, setActiveSource] = useState('All Sources');
  const [activeSentiment, setActiveSentiment] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [overallScore, setOverallScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stock/${selectedSymbol}/news?limit=25`);
      const items = Array.isArray(data) ? data : (data.items || []);
      setArticles(items);
      setOverallScore(data.sentiment_score ?? 0);
      if (data.available_sources && Array.isArray(data.available_sources)) {
        setSourcesList(data.available_sources);
      } else {
        const discovered = Array.from(new Set(items.map(a => a.source).filter(Boolean)));
        setSourcesList(['All Sources', ...discovered]);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load multi-source news', err);
      toast.error('Unable to fetch live news feeds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [selectedSymbol]);

  // Client-side filtering for fast responsive typing
  const filteredArticles = useMemo(() => {
    return articles.filter(item => {
      // Source filter
      if (activeSource !== 'All Sources' && item.source !== activeSource) {
        return false;
      }
      // Sentiment filter
      if (activeSentiment !== 'All' && item.sentiment !== activeSentiment) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (item.title || '').toLowerCase();
        const s = (item.source || '').toLowerCase();
        if (!t.includes(q) && !s.includes(q)) return false;
      }
      return true;
    });
  }, [articles, activeSource, activeSentiment, searchQuery]);

  // Transform sentiment (-1 to 1) into a gauge value (0 to 100)
  const normalizedValue = Math.max(0, Math.min(100, ((overallScore + 1) / 2) * 100));
  const gaugeData = [
    { name: 'Score', value: normalizedValue, color: overallScore > 0.15 ? '#10B981' : (overallScore < -0.15 ? '#EF4444' : '#EAB308') },
    { name: 'Empty', value: 100 - normalizedValue, color: 'rgba(255,255,255,0.06)' }
  ];

  const handleShare = (article) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(article.url || article.link);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box' }}>

      {/* Top Banner & Refresh */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 12,
        padding: '12px 18px', backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Newspaper size={18} color="#818CF8" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC' }}>
              Multi-Source News Radar — <span style={{ color: '#818CF8' }}>{selectedSymbol}</span>
            </h2>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
              Real-time Indian financial coverage aggregated from The Economic Times, Moneycontrol, LiveMint, Yahoo Finance & Google News.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefreshed && (
            <div style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button
            type="button"
            onClick={fetchNews}
            disabled={loading}
            style={{
              padding: '6px 13px', borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)',
              color: '#818CF8', border: '1px solid rgba(99, 102, 241, 0.3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 700
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* AI News Summary */}
      <AiNewsSummary ticker={selectedSymbol} />

      {/* Sentiment Overview & Sources Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        
        {/* Sentiment Meter Card */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AGGREGATE NEWS SENTIMENT
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: gaugeData[0].color, fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
              {overallScore > 0 ? '+' : ''}{overallScore.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
              Overall Tone: <strong style={{ color: gaugeData[0].color }}>{overallScore > 0.15 ? 'Bullish' : overallScore < -0.15 ? 'Bearish' : 'Neutral'}</strong>
            </div>
          </div>

          <div style={{ width: 100, height: 60, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={34}
                  outerRadius={46}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {gaugeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Coverage Breadth Card */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            COVERAGE & PUBLISHERS
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38BDF8', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
            {articles.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8' }}>Articles Indexed</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
            Across <strong>{sourcesList.length - 1}</strong> premier financial newsrooms
          </div>
        </div>

      </div>

      {/* Filter & Search Toolbar */}
      <div style={{
        background: 'rgba(9, 13, 30, 0.85)', border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10
      }}>
        {/* Source Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginRight: 4, whiteSpace: 'nowrap' }}>
            SOURCES:
          </span>
          {sourcesList.map(src => {
            const isSel = activeSource === src;
            const style = SOURCE_COLORS[src] || SOURCE_COLORS.Default;
            return (
              <button
                key={src}
                type="button"
                onClick={() => setActiveSource(src)}
                style={{
                  padding: '4px 11px', borderRadius: 14,
                  background: isSel ? style.bg : 'rgba(255, 255, 255, 0.03)',
                  color: isSel ? style.text : '#94A3B8',
                  border: isSel ? `1px solid ${style.border}` : '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.72rem', fontWeight: isSel ? 800 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {src}
              </button>
            );
          })}
        </div>

        {/* Sentiment & Keyword Search Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginRight: 4 }}>
              SENTIMENT:
            </span>
            {['All', 'Bullish', 'Neutral', 'Bearish'].map(s => {
              const isSel = activeSentiment === s;
              const color = s === 'Bullish' ? '#10B981' : s === 'Bearish' ? '#EF4444' : s === 'Neutral' ? '#EAB308' : '#818CF8';
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveSentiment(s)}
                  style={{
                    padding: '3px 10px', borderRadius: 6,
                    background: isSel ? `${color}20` : 'transparent',
                    color: isSel ? color : '#94A3B8',
                    border: isSel ? `1px solid ${color}50` : '1px solid transparent',
                    fontSize: '0.7rem', fontWeight: isSel ? 800 : 500, cursor: 'pointer'
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0C1022', padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(255, 255, 255, 0.1)', flex: '1', maxWidth: 280 }}>
            <Search size={13} color="#64748B" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in headlines..."
              style={{ background: 'transparent', border: 'none', color: '#F1F5F9', fontSize: '0.74rem', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Articles Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && articles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={24} className="spin" color="#818CF8" />
            <span>Fetching latest market dispatches across all sources…</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <AlertCircle size={28} color="#64748B" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, color: '#F1F5F9' }}>No news matched the current filters</div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>Try clearing search or switching to "All Sources"</div>
          </div>
        ) : (
          filteredArticles.map((item, idx) => {
            const srcStyle = SOURCE_COLORS[item.source] || SOURCE_COLORS.Default;
            const sentColor = item.sentiment === 'Bullish' ? '#10B981' : item.sentiment === 'Bearish' ? '#EF4444' : '#EAB308';

            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Meta Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4,
                      background: srcStyle.bg, color: srcStyle.text,
                      border: `1px solid ${srcStyle.border}`,
                      fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em'
                    }}>
                      {item.source}
                    </span>

                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} /> {item.time_ago || 'Recent'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.sentiment && (
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 800, color: sentColor,
                        background: `${sentColor}15`, border: `1px solid ${sentColor}35`,
                        padding: '2px 7px', borderRadius: 4
                      }}>
                        {item.sentiment}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Share link"
                      onClick={() => handleShare(item)}
                      style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}
                    >
                      <Share2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Headline Link */}
                <a
                  href={item.url || item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#F1F5F9', textDecoration: 'none', fontSize: '0.88rem',
                    fontWeight: 700, lineHeight: 1.45, display: 'inline-flex', alignItems: 'baseline', gap: 5
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#38BDF8'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#F1F5F9'}
                >
                  <span>{item.title}</span>
                  <ExternalLink size={12} color="#64748B" style={{ flexShrink: 0 }} />
                </a>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
