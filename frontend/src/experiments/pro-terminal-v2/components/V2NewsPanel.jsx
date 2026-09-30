// Pro Terminal V2 — News Panel

import React from 'react';
import { V2_COLORS } from '../utils/constants';
import { formatRelativeTime } from '../utils/formatters';

export default function V2NewsPanel({ news }) {
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: V2_COLORS.text.primary, marginBottom: 12 }}>
        Latest News
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {news.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '8px 0',
              borderBottom: `1px solid ${V2_COLORS.bg.border}`,
              cursor: 'pointer',
            }}
          >
            <div style={{
              fontSize: 11,
              color: V2_COLORS.text.primary,
              marginBottom: 4,
              lineHeight: 1.4,
            }}>
              {item.headline}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: V2_COLORS.text.muted }}>{item.source}</span>
              <span style={{ fontSize: 10, color: V2_COLORS.text.muted }}>{formatRelativeTime(item.time)}</span>
              <SentimentBadge sentiment={item.sentiment} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }) {
  const config = {
    positive: { label: 'Positive', color: V2_COLORS.positive },
    negative: { label: 'Negative', color: V2_COLORS.negative },
    neutral: { label: 'Neutral', color: V2_COLORS.neutral },
  }[sentiment] || { label: sentiment, color: V2_COLORS.neutral };

  return (
    <span style={{
      padding: '1px 6px',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 600,
      color: config.color,
      background: `${config.color}15`,
      textTransform: 'capitalize',
    }}>
      {config.label}
    </span>
  );
}
