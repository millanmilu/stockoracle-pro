import React, { useState, useEffect } from 'react';
import './mit/mit.css';
import MitHeader from './mit/MitHeader';
import { MitAiHero } from './mit/MitAiHero';
import { MitSummary } from './mit/MitSummary';
import { MitNews } from './mit/MitNews';
import { MitSentiment } from './mit/MitSentiment';
import { MitDivergence } from './mit/MitDivergence';
import { MitFearGreed } from './mit/MitFearGreed';
import { MitEvents } from './mit/MitEvents';
import { MitSignal } from './mit/MitSignal';
import { MitConsensus } from './mit/MitConsensus';
import { MitCharts } from './mit/MitCharts';
import { useMitData } from './mit/useMitData';
import { useMitIntel } from './mit/useMitIntel';
import { useMitAi } from './mit/useMitAi';
import { LayoutDashboard, Newspaper, Gauge, Sparkles } from 'lucide-react';

/* StockOracle Pro · AI Market Intelligence Terminal (institutional workstation).
   Supports deep-dive sub-tabs: All Intelligence, News Radar, Sentiment & TA, AI Analyst. */
export default function MarketIntelligenceView({ initialTab }) {
  const normalizeTab = (t) => {
    if (!t) return 'all';
    const s = String(t).toLowerCase();
    if (s.includes('news')) return 'news';
    if (s.includes('sentiment')) return 'sentiment';
    if (s.includes('ai')) return 'ai';
    return 'all';
  };

  const [activeTab, setActiveTab] = useState(() => normalizeTab(initialTab));

  useEffect(() => {
    if (initialTab) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [initialTab]);

  const d = useMitData();
  const { articles, newsMeta, ta, info, hist, aiSum, loading, aiBusy } = d;
  const intel = useMitIntel({ articles, newsMeta, ta, info, hist, aiSum, live: d.live, symbol: d.symbol });
  const fused = useMitAi({ articles, newsMeta, ta, hist, aiSum, intel, score: intel.score, dChg: intel.dChg, symbol: d.symbol });

  const last = hist.length ? hist[hist.length - 1] : null;
  const prev = hist.length > 1 ? hist[hist.length - 2] : null;
  const px = d.live?.price ?? info?.current_price ?? info?.price ?? info?.ltp ?? last?.close ?? null;
  const chg = d.live?.change_pct ?? info?.change_pct ?? info?.changePercent ?? (last && prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0);
  const closes = hist.map((r) => r.close).filter((v) => v > 0);

  let vola = null;
  if (closes.length > 6) {
    const lr = closes.slice(-20).map((c, i, a) => (i ? Math.log(c / a[i - 1]) : 0));
    vola = Math.sqrt(lr.reduce((s, x) => s + x * x, 0) / Math.max(1, lr.length - 1)) * Math.sqrt(365) * 100;
  }

  const stats = {
    price: px,
    chgPct: chg,
    vol24: d.live?.volume ?? info?.volume ?? last?.volume ?? null,
    mcap: info?.market_cap ?? info?.marketCap ?? null,
    vola,
    regime: fused.ai.regime,
  };

  const tabs = [
    { id: 'all', label: 'All Intelligence', icon: <LayoutDashboard size={13} /> },
    { id: 'news', label: 'News Radar', icon: <Newspaper size={13} />, badge: articles.length },
    { id: 'sentiment', label: 'Sentiment & TA', icon: <Gauge size={13} /> },
    { id: 'ai', label: 'AI Analyst', icon: <Sparkles size={13} /> },
  ];

  return (
    <div style={{ padding: 'clamp(8px,1.4vw,14px)', maxWidth: 1720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9, width: '100%', boxSizing: 'border-box' }}>
      <MitHeader stats={stats} updatedAt={d.updatedAt} live={!!d.live} />

      {/* Sub-Tab Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(148,163,184,.14)', paddingBottom: 6, overflowX: 'auto' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`mit-chipbtn ${activeTab === tab.id ? 'on' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 11px',
              fontSize: '.68rem',
              fontWeight: 800,
              borderRadius: 5,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{ fontSize: '.56rem', background: 'rgba(129,140,248,.2)', color: '#818CF8', padding: '1px 5px', borderRadius: 8, marginLeft: 2 }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {d.err && (
        <div style={{ fontSize: '.68rem', color: '#F59E0B', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 5, padding: '5px 10px' }}>
          {d.err}
        </div>
      )}

      {/* Tab View Routing */}
      {activeTab === 'all' && (
        <div className="mit-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <MitNews
              articles={articles}
              loading={loading}
              newsMeta={newsMeta}
              onRefresh={d.reload}
              freshId={d.freshId}
              symbol={d.symbol}
              newsScope={d.newsScope}
              onScopeChange={d.setNewsScope}
            />
            <MitCharts articles={articles} ta={ta} />
          </div>
          <div className="mit-order-ai" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <MitAiHero
              ai={fused.ai}
              summary={fused.summary}
              intel={fused.sig.parts}
              loading={aiBusy || loading}
              onRefresh={d.refreshAI}
              updatedAt={d.updatedAt}
            />
            <MitSummary summary={fused.summary} loading={aiBusy || loading} onRegen={d.refreshAI} />
            <MitDivergence div={intel.div} />
          </div>
          <div className="mit-col-r" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <MitSentiment dist={intel.dist} trend={intel.trend} spark={intel.spark} loading={loading} />
            <MitFearGreed fg={intel.fg} />
            <MitSignal sig={fused.sig} />
            <MitConsensus consensus={fused.consensus} />
            <MitEvents events={fused.events} />
          </div>
        </div>
      )}

      {activeTab === 'news' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(0, 1fr)', gap: 10 }}>
          <MitNews
            articles={articles}
            loading={loading}
            newsMeta={newsMeta}
            onRefresh={d.reload}
            freshId={d.freshId}
            symbol={d.symbol}
            newsScope={d.newsScope}
            onScopeChange={d.setNewsScope}
            fullWidth={true}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MitSummary summary={fused.summary} loading={aiBusy || loading} onRegen={d.refreshAI} />
            <MitCharts articles={articles} ta={ta} />
            <MitEvents events={fused.events} />
          </div>
        </div>
      )}

      {activeTab === 'sentiment' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MitSentiment dist={intel.dist} trend={intel.trend} spark={intel.spark} loading={loading} />
            <MitFearGreed fg={intel.fg} />
            <MitCharts articles={articles} ta={ta} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MitDivergence div={intel.div} />
            <MitConsensus consensus={fused.consensus} />
            <MitSignal sig={fused.sig} />
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MitAiHero
              ai={fused.ai}
              summary={fused.summary}
              intel={fused.sig.parts}
              loading={aiBusy || loading}
              onRefresh={d.refreshAI}
              updatedAt={d.updatedAt}
            />
            <MitSummary summary={fused.summary} loading={aiBusy || loading} onRegen={d.refreshAI} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MitSignal sig={fused.sig} />
            <MitDivergence div={intel.div} />
            <MitConsensus consensus={fused.consensus} />
            <MitEvents events={fused.events} />
          </div>
        </div>
      )}

      <div style={{ fontSize: '.62rem', color: '#475569', textAlign: 'center', marginTop: 8 }}>
        StockOracle Pro · AI Market Intelligence Terminal — analytical signals & aggregated multi-source feeds, not financial advice.
      </div>
    </div>
  );
}
