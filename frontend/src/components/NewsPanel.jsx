import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

// ── AI News Summary Card ───────────────────────────────────────────────────────

const SENTIMENT_COLORS = {
  'Strongly Bullish': '#10B981',
  'Bullish': '#22c55e',
  'Neutral': '#eab308',
  'Bearish': '#f97316',
  'Strongly Bearish': '#ef4444',
};

function AiNewsSummary({ ticker }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setSummary(null);
    setLoading(true);
    api.get(`/api/stock/${ticker}/news-summary`)
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  const color = summary ? (SENTIMENT_COLORS[summary.sentiment] || '#eab308') : '#eab308';

  return (
    <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: collapsed ? 0 : 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={13} color="#818CF8" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI News Summary</span>
          {summary && (
            <span style={{ padding: '2px 8px', borderRadius: 10, background: `${color}22`, color, fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${color}44` }}>
              {summary.sentiment}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown size={14} color="#6B7280" /> : <ChevronUp size={14} color="#6B7280" />}
      </div>

      {!collapsed && (
        loading ? (
          <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>Analyzing headlines with AI…</div>
        ) : summary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.6 }}>{summary.summary}</p>
            {summary.risks && summary.risks.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {summary.risks.map((r, i) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', fontSize: '0.68rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ⚠ {r}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>
              Price Impact: <span style={{ color: summary.impact === 'Positive' ? '#10B981' : summary.impact === 'Negative' ? '#ef4444' : '#eab308', fontWeight: 700 }}>{summary.impact}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>AI summary unavailable. Add GEMINI_API_KEY to backend/.env</div>
        )
      )}
    </div>
  );
}

// ── Main NewsPanel ─────────────────────────────────────────────────────────────

export default function NewsPanel() {
  const { selectedSymbol } = useStore();
  const [news, setNews] = useState([]);
  const [sentimentScore, setSentimentScore] = useState(0);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data } = await api.get(`/api/stock/${selectedSymbol}/news`);
        if (data.items) {
          setNews(data.items.slice(0, 5));
          setSentimentScore(data.sentiment || 0);
        } else {
          setNews(data.slice(0, 5) || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchNews();
  }, [selectedSymbol]);

  // Transform sentiment (-1 to 1) into a gauge value (0 to 100)
  const normalizedValue = ((sentimentScore + 1) / 2) * 100;
  const data = [
    { name: 'Score', value: normalizedValue, color: sentimentScore > 0 ? '#22c55e' : (sentimentScore < 0 ? '#ef4444' : '#eab308') },
    { name: 'Empty', value: 100 - normalizedValue, color: '#333' }
  ];

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 24px)', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 800, color: '#F0F0FF' }}>Market Sentiment & News Analysis</h2>

      {/* AI News Summary — new addition */}
      <AiNewsSummary ticker={selectedSymbol} />

      {/* Half Donut Gauge */}
      <div style={{ height: '180px', width: '100%', position: 'relative' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={70}
              outerRadius={90}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ 
          position: 'absolute', 
          bottom: '8px', 
          width: '100%', 
          textAlign: 'center', 
          fontSize: '1.3rem', 
          fontWeight: 800,
          fontFamily: 'JetBrains Mono, monospace',
          color: data[0].color
        }}>
          {sentimentScore > 0 ? '+' : ''}{sentimentScore.toFixed(2)}
        </div>
      </div>

      {/* Headlines */}
      <h3 style={{ marginTop: '24px', color: '#94A3B8', fontSize: '0.9rem', fontWeight: 700 }}>Top Headlines</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
        {news.map((item, idx) => (
          <div key={idx} style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border, #333)' }}>
            <a href={item.url || item.link} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold' }}>
              {item.title}
            </a>
            <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '8px' }}>
              {item.source} • {new Date(item.published_at || item.published).toLocaleDateString()}
            </div>
          </div>
        ))}
        {news.length === 0 && <div style={{ color: '#888' }}>No news available right now.</div>}
      </div>
    </div>
  );
}

