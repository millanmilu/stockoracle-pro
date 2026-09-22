import React from 'react';
import { Zap, ChevronDown, ExternalLink } from 'lucide-react';
import { SRC_COLOR, sentColor, sentLabel, timeAgo } from './utils';

const IMP_C = { HIGH: '#F43F5E', MEDIUM: '#F59E0B', LOW: '#64748B' };
const fmtS = (v) => (v > 0 ? '+' : '') + Number(v).toFixed(2);

export function MitArticle({ a, open, onToggle, flash }) {
  const sc = sentColor(a._s);
  const displayTime = a.published_at ? timeAgo(a.published_at) : (a.time_ago || 'Recent');

  return (
    <article
      className={`mit-article-card ${flash ? 'mit-flash' : ''}`}
      style={{
        borderLeft: `3px solid ${sc}`,
      }}
    >
      {/* Top Meta Line: Source, Time, Event, Sentiment */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 17 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              fontSize: '.56rem',
              fontWeight: 800,
              color: SRC_COLOR[a.source] || '#94A3B8',
              background: (SRC_COLOR[a.source] || '#64748B') + '1A',
              border: `1px solid ${(SRC_COLOR[a.source] || '#64748B')}44`,
              padding: '1px 5px',
              borderRadius: 3,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {a.source || 'News'}
          </span>
          <span style={{ fontSize: '.58rem', color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {displayTime}
          </span>
          {a._evt && (
            <span
              style={{
                fontSize: '.54rem',
                color: '#64748B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 140,
              }}
            >
              · {a._evt}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: '.56rem',
            fontWeight: 800,
            color: sc,
            background: sc + '15',
            border: `1px solid ${sc}44`,
            padding: '1px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {sentLabel(a._s)} {fmtS(a._sc)}
        </span>
      </div>

      {/* Main Title Row: 2-line clamped link */}
      <a
        href={a.url || a.link}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#F1F5F9',
          textDecoration: 'none',
          fontSize: '.74rem',
          fontWeight: 600,
          lineHeight: 1.32,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 5,
        }}
        title={a.title}
      >
        <span className="mit-line-clamp-2" style={{ flex: 1 }}>
          {a.title}
        </span>
        <ExternalLink size={11} color="#64748B" style={{ marginTop: 2, flexShrink: 0 }} />
      </a>

      {/* Bottom Micro Bar: Importance, AI Relevance, Impact Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.58rem', fontWeight: 700, minHeight: 18 }}>
        <span
          style={{
            color: IMP_C[a._imp],
            background: IMP_C[a._imp] + '14',
            border: `1px solid ${IMP_C[a._imp]}44`,
            padding: '0 5px',
            borderRadius: 3,
            fontSize: '.52rem',
            lineHeight: '14px',
            textTransform: 'uppercase',
          }}
        >
          {a._imp}
        </span>

        <span style={{ color: '#94A3B8', fontSize: '.56rem', whiteSpace: 'nowrap' }}>
          Rel {a._rel}%
        </span>
        <div className="mit-bar" style={{ width: 36, height: 4 }}>
          <i style={{ width: a._rel + '%', background: '#818CF8' }} />
        </div>

        <button
          onClick={onToggle}
          className="mit-chipbtn"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '1px 6px',
            fontSize: '.56rem',
            height: 18,
          }}
        >
          <Zap size={9} />
          Impact {a._impact}%
          <ChevronDown
            size={10}
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </div>

      {/* Expanded Details: Description & Market Impact Breakdown */}
      {open && (
        <div
          style={{
            marginTop: 4,
            paddingTop: 6,
            borderTop: '1px solid rgba(148,163,184,.14)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {a.description && (
            <p
              style={{
                margin: 0,
                fontSize: '.70rem',
                color: '#CBD5E1',
                lineHeight: 1.45,
                background: 'rgba(15,23,42,.4)',
                padding: '6px 8px',
                borderRadius: 4,
                borderLeft: '2px solid rgba(129,140,248,.5)',
              }}
            >
              {a.description}
            </p>
          )}

          <div
            style={{
              background: 'rgba(99,102,241,.08)',
              border: '1px solid rgba(129,140,248,.25)',
              borderRadius: 5,
              padding: '7px 9px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            <div>
              <div style={{ fontSize: '.54rem', fontWeight: 800, color: '#64748B' }}>MARKET IMPACT</div>
              <div className="mit-bar" style={{ margin: '3px 0', height: 5 }}>
                <i style={{ width: a._impact + '%', background: sc }} />
              </div>
              <div style={{ fontSize: '.64rem', fontWeight: 800, color: sc }}>
                {a._impact}% · {a._impact >= 75 ? 'HIGH' : 'MEDIUM'}
              </div>
            </div>
            <div style={{ fontSize: '.60rem', color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Direction: <b style={{ color: sc }}>{sentLabel(a._s)}</b></span>
              <span>Horizon: <b style={{ color: '#E2E8F0' }}>{a._imp === 'HIGH' ? 'SHORT TERM' : 'MEDIUM TERM'}</b></span>
              <span>Confidence: <b style={{ color: '#E2E8F0' }}>{Math.min(96, a._rel + 4)}%</b></span>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
