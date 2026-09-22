import React, { useState } from 'react';
import { Newspaper, Search, RefreshCw, X, Radio, Layers } from 'lucide-react';
import { SOURCES_10, SRC_COLOR, sentLabel } from './utils';
import { MitArticle } from './MitArticle';

const PAGE = 14;

export function MitNews({
  articles,
  loading,
  newsMeta,
  onRefresh,
  freshId,
  symbol,
  newsScope,
  onScopeChange,
  fullWidth = false,
}) {
  const feedAge = (() => {
    if (!newsMeta.updatedAt) return null;
    const s = Math.max(0, (Date.now() - new Date(newsMeta.updatedAt).getTime()) / 1000);
    if (s < 75) return { t: 'FEED FRESH · LIVE', c: '#10B981' };
    if (s < 300) return { t: `FEED ${Math.floor(s / 60)}m AGO`, c: '#F59E0B' };
    return { t: 'FEED STALE · Click Refresh', c: '#F43F5E' };
  })();

  const [src, setSrc] = useState('All');
  const [sent, setSent] = useState('All');
  const [imp, setImp] = useState('All');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent'); // Default to recent for up-to-date view
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(null);

  const reset = () => {
    setSrc('All');
    setSent('All');
    setImp('All');
    setQ('');
    setSort('recent');
    setShown(PAGE);
  };

  const ql = q.trim().toLowerCase();
  const filtered = articles.filter((a) => {
    if (src !== 'All' && a.source !== src) return false;
    if (sent !== 'All' && sentLabel(a._s) !== sent) return false;
    if (imp !== 'All' && a._imp !== imp) return false;
    if (ql) {
      const matchTitle = String(a.title || '').toLowerCase().includes(ql);
      const matchDesc = String(a.description || '').toLowerCase().includes(ql);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  }).sort((a, b) => (sort === 'recent' ? a._ageH - b._ageH : sort === 'impact' ? b._impact - a._impact : b._rel - a._rel));

  const vis = filtered.slice(0, shown);

  // Available sources list combining standard ones and actual response sources
  const availableSources = ['All', ...new Set([...(newsMeta.sources || []).filter(s => s !== 'All Sources'), ...SOURCES_10])];

  return (
    <div className="mit-card" style={{ height: fullWidth ? '100%' : 'auto' }}>
      <div className="mit-card-h" style={{ gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          <span className="mit-card-t">
            <Newspaper size={13} color="#818CF8" />
            NEWS RADAR
            <span style={{ color: '#64748B', fontWeight: 600 }}>({newsMeta.total || articles.length})</span>
          </span>
          {feedAge && (
            <span
              style={{
                fontSize: '.54rem',
                fontWeight: 800,
                color: feedAge.c,
                background: feedAge.c + '14',
                border: `1px solid ${feedAge.c}44`,
                padding: '1px 5px',
                borderRadius: 3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                whiteSpace: 'nowrap',
              }}
            >
              <span className="mit-live-dot" style={{ width: 5, height: 5, background: feedAge.c }} />
              {feedAge.t}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', flexShrink: 0 }}>
          {onScopeChange && (
            <div style={{ display: 'flex', background: 'rgba(9,13,30,.8)', border: '1px solid rgba(148,163,184,.2)', borderRadius: 4, padding: 1 }}>
              <button
                onClick={() => onScopeChange('stock')}
                className={`mit-chipbtn ${newsScope === 'stock' ? 'on' : ''}`}
                style={{ fontSize: '.58rem', padding: '2px 6px', border: 'none', borderRadius: 3 }}
              >
                {symbol || 'Stock'}
              </button>
              <button
                onClick={() => onScopeChange('market')}
                className={`mit-chipbtn ${newsScope === 'market' ? 'on' : ''}`}
                style={{ fontSize: '.58rem', padding: '2px 6px', border: 'none', borderRadius: 3 }}
              >
                Market
              </button>
            </div>
          )}

          <button
            onClick={() => onRefresh(true)}
            className="mit-chipbtn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '.58rem',
              padding: '2px 7px',
              background: 'rgba(99,102,241,.12)',
              borderColor: 'rgba(129,140,248,.4)',
            }}
            title="Fetch brand new headlines from upstream RSS feeds"
          >
            <RefreshCw size={10} className={loading ? 'mit-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mit-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* Publisher Filter Pills: Single-line horizontal scroll */}
        <div className="mit-sources-bar">
          {availableSources.slice(0, 16).map((s) => (
            <button
              key={s}
              onClick={() => { setSrc(s); setShown(PAGE); }}
              className={`mit-chipbtn ${src === s ? 'on' : ''}`}
              style={{
                fontSize: '.58rem',
                padding: '2px 7px',
                height: 22,
                lineHeight: '16px',
                borderRadius: 4,
                ...(src === s || s === 'All' ? {} : { color: SRC_COLOR[s] || '#94A3B8' }),
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Filter & Search Bar */}
        {fullWidth ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1fr 1.2fr auto', gap: 6, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} color="#64748B" style={{ position: 'absolute', left: 8, top: 7 }} />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
                placeholder={`Search ${symbol || 'market'} headlines…`}
                className="mit-inp"
                style={{ paddingLeft: 24, paddingRight: q ? 22 : 8, height: 25, fontSize: '.65rem' }}
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  style={{ position: 'absolute', right: 6, top: 5, background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select value={sent} onChange={(e) => { setSent(e.target.value); setShown(PAGE); }} className="mit-sel" style={{ height: 25, fontSize: '.60rem' }}>
              {['All', 'BULLISH', 'NEUTRAL', 'BEARISH'].map((o) => (
                <option key={o} value={o}>{o === 'All' ? 'Sentiment: All' : o}</option>
              ))}
            </select>

            <select value={imp} onChange={(e) => { setImp(e.target.value); setShown(PAGE); }} className="mit-sel" style={{ height: 25, fontSize: '.60rem' }}>
              {['All', 'HIGH', 'MEDIUM', 'LOW'].map((o) => (
                <option key={o} value={o}>{o === 'All' ? 'Impact: All' : o}</option>
              ))}
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value)} className="mit-sel" style={{ height: 25, fontSize: '.60rem' }}>
              <option value="recent">Sort: Most Recent</option>
              <option value="impact">Sort: Market Impact</option>
              <option value="relevance">Sort: AI Relevance</option>
            </select>

            <button onClick={reset} className="mit-chipbtn" style={{ height: 25, fontSize: '.60rem', padding: '0 9px' }}>Reset</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Row 1: Search & Reset */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={11} color="#64748B" style={{ position: 'absolute', left: 8, top: 7 }} />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
                  placeholder={`Search ${symbol || 'market'} headlines…`}
                  className="mit-inp"
                  style={{ paddingLeft: 24, paddingRight: q ? 22 : 8, height: 25, fontSize: '.65rem' }}
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    style={{ position: 'absolute', right: 6, top: 5, background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {(q || src !== 'All' || sent !== 'All' || imp !== 'All' || sort !== 'recent') && (
                <button
                  onClick={reset}
                  className="mit-chipbtn"
                  style={{ height: 25, fontSize: '.58rem', padding: '0 8px', borderColor: 'rgba(244,63,94,.4)', color: '#F43F5E' }}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Row 2: 3 Inline Dropdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: 5 }}>
              <select
                value={sent}
                onChange={(e) => { setSent(e.target.value); setShown(PAGE); }}
                className="mit-sel"
                style={{ height: 23, fontSize: '.58rem', padding: '1px 4px' }}
              >
                <option value="All">Sent: All</option>
                <option value="BULLISH">Bullish</option>
                <option value="NEUTRAL">Neutral</option>
                <option value="BEARISH">Bearish</option>
              </select>

              <select
                value={imp}
                onChange={(e) => { setImp(e.target.value); setShown(PAGE); }}
                className="mit-sel"
                style={{ height: 23, fontSize: '.58rem', padding: '1px 4px' }}
              >
                <option value="All">Imp: All</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Med</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="mit-sel"
                style={{ height: 23, fontSize: '.58rem', padding: '1px 4px' }}
              >
                <option value="recent">Sort: Recent</option>
                <option value="impact">Sort: Impact</option>
                <option value="relevance">Sort: Relevance</option>
              </select>
            </div>
          </div>
        )}

        {/* Scrollable Article Feed */}
        <div
          className="mit-news-scroll"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            maxHeight: fullWidth ? 760 : 540,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {loading && articles.length === 0 && [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mit-skel" style={{ height: 50 }} />
          ))}

          {!loading && vis.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 10px', color: '#64748B', fontSize: '.74rem' }}>
              <div style={{ fontWeight: 800, color: '#94A3B8', fontSize: '.80rem' }}>
                No active headlines match the selected filters
              </div>
              <p style={{ margin: '5px 0 10px', fontSize: '.68rem', color: '#64748B' }}>
                Try switching to "Market" scope or reset the publisher and sentiment filters.
              </p>
              <button onClick={reset} className="mit-chipbtn" style={{ fontSize: '.60rem', padding: '3px 9px' }}>Reset filters</button>
            </div>
          )}

          {vis.map((a) => (
            <MitArticle
              key={a._i}
              a={a}
              open={open === a._i}
              onToggle={() => setOpen(open === a._i ? null : a._i)}
              flash={freshId > 0 && a._i === 0}
            />
          ))}

          {filtered.length > shown && (
            <button
              onClick={() => setShown((s) => s + PAGE)}
              className="mit-chipbtn"
              style={{ padding: '7px', marginTop: 3, width: '100%', textAlign: 'center', fontSize: '.64rem' }}
            >
              Load more headlines ({filtered.length - shown} remaining)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
